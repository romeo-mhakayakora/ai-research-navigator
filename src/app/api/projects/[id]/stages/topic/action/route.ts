import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TopicActionSchema, TopicBriefSchema, stageIdFromKey } from "@/lib/validation";
import { assertStageOpen, completeStage, GateError } from "@/lib/gating";
import { errorEnvelope } from "@/lib/utils";
import { chatComplete } from "@/lib/harness/provider/llm";

// Free-tier models often wrap JSON in prose or markdown fences; extract the
// first JSON object/array from the raw completion before parsing.
function parseLooseJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.search(/[[{]/);
    if (start >= 0) {
      const open = trimmed[start];
      const close = open === "{" ? "}" : "]";
      const end = trimmed.lastIndexOf(close);
      if (end > start) return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("No JSON object found in model output");
  }
}
import { F1_SYSTEM_PROMPT } from "@/lib/harness/agents/f1-topic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = TopicActionSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", `${issue.path.join(".")}: ${issue.message}`), {
      status: 400,
    });
  }
  try {
    await assertStageOpen(params.id, stageIdFromKey("topic"));
  } catch (e) {
    if (e instanceof GateError)
      return NextResponse.json(errorEnvelope("STAGE_LOCKED", "Finish the previous stage first."), { status: 403 });
    throw e;
  }
  const state = await prisma.stageState.findUniqueOrThrow({
    where: { projectId_stage: { projectId: params.id, stage: "F1" } },
  });
  const data = JSON.parse(state.data) as {
    intake?: { domain: string; background: string; level: string };
    candidates?: Array<{ id: string; title: string }>;
    finalTopicId?: string;
  };

  if (parsed.data.action === "propose") {
    // Advisor-style proposing: base candidates on the actual conversation,
    // not just the intake captured at project creation.
    const history = await prisma.message.findMany({
      where: { projectId: params.id, stage: "F1" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 20,
    });
    const transcript = history
      .map((m) => `${m.role === "USER" ? "USER" : "ASSISTANT"}: ${m.content}`)
      .join("\n");
    const contextBlock =
      transcript.length > 0
        ? `Intake (may be stale): ${JSON.stringify(data.intake)}.

Conversation so far:
${transcript}

Base the candidates STRICTLY on the user's statements in this conversation — especially their most recent stated interest. If the conversation conflicts with the intake, the conversation wins.`
        : `Domain context: ${JSON.stringify(data.intake)} (no conversation yet — use this).`;
    const baseMessages: Parameters<typeof chatComplete>[0] = [
      { role: "system", content: F1_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${contextBlock}

Respond with ONLY a JSON object — no prose, no markdown — in exactly this shape:
{"candidates":[{"id":"c1","title":"...","scope":"one sentence","novelty":"one sentence, conservative","fitNote":"one sentence tied to background/level","risks":["..."]}]}
Give 3 to 5 candidates. Example candidate: {"id":"c1","title":"Benchmarking data-augmentation effects on low-resource classification","scope":"Compare augmentation strategies on one low-resource text classification task.","novelty":"Few reproducible head-to-head comparisons exist for the chosen setting.","fitNote":"Scoped for a Master's student with basic ML background.","risks":["Dataset licensing","Limited compute"]}`,
      },
    ];
    let raw = "";
    try {
      raw = await chatComplete(baseMessages, { jsonMode: true, fixture: "candidates" });
    } catch (e) {
      return NextResponse.json(
        errorEnvelope("PROVIDER_ERROR", e instanceof Error ? e.message : "LLM call failed"),
        { status: 502 }
      );
    }
    let parsedRaw: unknown = null;
    try {
      parsedRaw = parseLooseJson(raw);
    } catch {
      parsedRaw = null;
    }
    let arr = (
      Array.isArray(parsedRaw)
        ? parsedRaw
        : ((parsedRaw as Record<string, unknown> | null)?.candidates ??
           (parsedRaw as Record<string, unknown> | null)?.topics ??
           (parsedRaw as Record<string, unknown> | null)?.proposals ??
           []) as Array<Record<string, unknown>>
    );
    // Free models sometimes answer conversationally despite the schema; retry
    // once with a hard reminder before giving up with a readable error.
    if (arr.length === 0) {
      try {
        raw = await chatComplete(
          [
            ...baseMessages,
            {
              role: "assistant",
              content: raw.slice(0, 500),
            },
            {
              role: "user",
              content: `That was not the required format. Reply with ONLY the JSON object {"candidates":[...]} containing 3 candidate topics. No other text.`,
            },
          ],
          { jsonMode: true, fixture: "candidates" }
        );
        parsedRaw = parseLooseJson(raw);
        arr = (
          Array.isArray(parsedRaw)
            ? parsedRaw
            : ((parsedRaw as Record<string, unknown>).candidates ??
               (parsedRaw as Record<string, unknown>).topics ??
               []) as Array<Record<string, unknown>>
        );
      } catch {
        // fall through to the empty-candidates handling below
      }
    }
    if (arr.length === 0) {
      return NextResponse.json(
        errorEnvelope("AGENT_OUTPUT_INVALID", "The model did not return topic candidates — try again."),
        { status: 502 }
      );
    }
    const candidates = arr.slice(0, 5).map((c, i) => ({
      id: String(c.id ?? `c${i + 1}`),
      title: String(c.title ?? ""),
      scope: String(c.scope ?? ""),
      novelty: String(c.novelty ?? ""),
      fitNote: String(c.fitNote ?? ""),
      risks: Array.isArray(c.risks) ? c.risks.map(String) : [],
    }));
    await prisma.stageState.update({
      where: { projectId_stage: { projectId: params.id, stage: "F1" } },
      data: { data: JSON.stringify({ ...data, candidates }) },
    });
    return NextResponse.json({ candidates });
  }

  if (parsed.data.action === "lock") {
    const candidateId = parsed.data.candidateId;
    const chosen = (data.candidates ?? []).find((c) => c.id === candidateId);
    if (!chosen)
      return NextResponse.json(errorEnvelope("NOT_FOUND", "Candidate not found"), { status: 404 });
    const existing = await prisma.artifact.findFirst({
      where: { projectId: params.id, stage: "F1", kind: "TOPIC_BRIEF" },
      orderBy: { version: "desc" },
    });
    if (existing && data.finalTopicId === chosen.id) {
      return NextResponse.json({ brief: JSON.parse(existing.content) });
    }
    const briefMessages: Parameters<typeof chatComplete>[0] = [
      { role: "system", content: F1_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Locked topic: ${chosen.title}.

Respond with ONLY a JSON object — no prose, no markdown — in exactly this shape:
{"title":"...","problem":"...","researchQuestions":["..."],"scopeBoundaries":["..."],"successCriteria":["..."],"estimatedDifficulty":"BTECH|MASTERS|PHD|RD"}
Keep every field concise (one to three sentences or 3-5 short list items). This is a compact topic brief, NOT a methodology or plan.`,
      },
    ];
    let briefRaw = "";
    try {
      briefRaw = await chatComplete(briefMessages, { jsonMode: true, fixture: "brief", maxTokens: 2048 });
      let briefParsed = TopicBriefSchema.safeParse(parseLooseJson(briefRaw));
      if (!briefParsed.success) {
        // One retry with a hard format reminder (models sometimes drift).
        briefRaw = await chatComplete(
          [
            ...briefMessages,
            { role: "user", content: `That was not the required format. Reply with ONLY the JSON object described above. No other text.` },
          ],
          { jsonMode: true, fixture: "brief", maxTokens: 2048 }
        );
        briefParsed = TopicBriefSchema.safeParse(parseLooseJson(briefRaw));
      }
      if (!briefParsed.success)
        return NextResponse.json(errorEnvelope("AGENT_OUTPUT_INVALID", "Brief validation failed — try locking again."), { status: 502 });
      const brief = briefParsed.data;
    if (existing) {
      await prisma.artifact.update({
        where: { id: existing.id },
        data: { content: JSON.stringify(brief), title: brief.title, version: existing.version + 1 },
      });
    } else {
      await prisma.artifact.create({
        data: {
          projectId: params.id,
          stage: "F1",
          kind: "TOPIC_BRIEF",
          title: brief.title,
          content: JSON.stringify(brief),
          version: 1,
        },
      });
    }
    await prisma.stageState.update({
      where: { projectId_stage: { projectId: params.id, stage: "F1" } },
      data: { data: JSON.stringify({ ...data, finalTopicId: chosen.id }) },
    });
    return NextResponse.json({ brief });
    } catch (e) {
      return NextResponse.json(
        errorEnvelope("PROVIDER_ERROR", e instanceof Error ? e.message : "LLM call failed"),
        { status: 502 }
      );
    }
  }

  if (!data.finalTopicId)
    return NextResponse.json(errorEnvelope("PRECONDITION_FAILED", "Lock a topic before completing F1."), {
      status: 409,
    });
  const briefExists = await prisma.artifact.findFirst({
    where: { projectId: params.id, stage: "F1", kind: "TOPIC_BRIEF" },
  });
  if (!briefExists)
    return NextResponse.json(errorEnvelope("PRECONDITION_FAILED", "Topic brief missing."), { status: 409 });
  const stages = await completeStage(params.id, "F1");
  // Carry the locked topic into F2 (Interview) so the next stage starts with it.
  await prisma.stageState.update({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
    data: {
      data: JSON.stringify({
        topic: {
          title: JSON.parse(briefExists.content).title ?? "",
          problem: JSON.parse(briefExists.content).problem ?? "",
        },
      }),
    },
  });
  return NextResponse.json({ stages });
}
