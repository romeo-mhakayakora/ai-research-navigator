import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { stageIdFromKey } from "@/lib/validation";
import { assertStageOpen, completeStage, GateError } from "@/lib/gating";
import { errorEnvelope } from "@/lib/utils";
import { chatComplete } from "@/lib/harness/provider/llm";
import { searchArxiv } from "@/lib/harness/tools/arxiv";

// Free models wrap/prose their JSON; extract the first JSON object/array.
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

type GapItem = {
  concept: string;
  whyItMatters: string;
  currentUnderstanding: string;
  searchQuery: string;
};

export type GapReport = {
  knownAreas: string[];
  gaps: GapItem[];
  papers: Array<{
    title: string; authors: string[]; year: number; url: string; extId: string;
    abstract: string; reason: string;
  }>;
};

const ANALYZE_SCHEMA = `{"knownAreas":["..."],"gaps":[{"concept":"...","whyItMatters":"one sentence","currentUnderstanding":"what the user said they know","searchQuery":"3-6 word arXiv search phrase"}]}`;

const F2ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("questions") }), // generate the structured questionnaire
  z.object({
    action: z.literal("analyze"),
    answers: z.array(z.object({ id: z.string(), values: z.array(z.string().min(1)) })).min(1),
  }),
  z.object({ action: z.literal("complete") }),
]);

export type F2Question = {
  id: string;
  type: "text" | "multi";
  question: string;
  options?: string[];
};

const QUESTIONNAIRE_SCHEMA = `{"questions":[{"id":"q1","type":"text","question":"..."},{"id":"q2","type":"multi","question":"...","options":["option A","option B","option C","None of these"]}],"questionsCount":12}`;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = F2ActionSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", `${issue.path.join(".")}: ${issue.message}`), {
      status: 400,
    });
  }
  try {
    await assertStageOpen(params.id, stageIdFromKey("gaps"));
  } catch (e) {
    if (e instanceof GateError)
      return NextResponse.json(errorEnvelope("STAGE_LOCKED", "Finish the previous stage first."), { status: 403 });
    throw e;
  }

  const stageState = await prisma.stageState.findUniqueOrThrow({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const stateData = JSON.parse(stageState.data) as {
    topic?: { title?: string; problem?: string };
    questions?: F2Question[];
    answers?: Array<{ id: string; values: string[] }>;
    report?: GapReport;
  };

  if (parsed.data.action === "questions") {
    if (stateData.questions?.length) {
      return NextResponse.json({ questions: stateData.questions });
    }
    const raw = await chatComplete(
      [
        {
          role: "system",
          content: `You are Euler, a research assistant agent and the Knowledge Interviewer. Given a researcher's locked topic and their level, generate a STRUCTURED questionnaire that measures exactly what they know versus what they must know to execute the topic.

Respond with ONLY a JSON object — no prose, no markdown — in exactly this shape:
${QUESTIONNAIRE_SCHEMA}

Rules:
- 8 to 14 questions (never more than 20), ordered foundational-first.
- Mix two types: "text" (descriptive, open answer about what they know/have done) and "multi" (self-assessment with 4-6 concrete checkbox options covering skills/concepts related to the topic, always including a final "None of these" style option).
- Every question must be answerable WITHOUT the assistant — no follow-ups, no ambiguity.
- Cover: relevant fundamentals, methods/tools (e.g. training, fine-tuning, evaluation), math/theory prerequisites, prior literature exposure, and practical experience.
- Questions must stay strictly within the scope of the locked topic. Do not invent papers.`,
        },
        {
          role: "user",
          content: `Locked topic: ${stateData.topic?.title ?? ""}\nTopic problem: ${stateData.topic?.problem ?? ""}\nResearcher level: see topic context. Generate the questionnaire JSON.`,
        },
      ],
      { jsonMode: true, maxTokens: 3000, fixture: "questions" }
    );
    let parsedRaw: unknown;
    try {
      parsedRaw = parseLooseJson(raw);
    } catch {
      return NextResponse.json(errorEnvelope("AGENT_OUTPUT_INVALID", "The model did not return a valid questionnaire — try again."), { status: 502 });
    }
    const obj = (parsedRaw ?? {}) as Record<string, unknown>;
    const rawQuestions = (Array.isArray(obj.questions) ? obj.questions : []) as Array<Record<string, unknown>>;
    const questions: F2Question[] = rawQuestions
      .map((q, i) => {
        const type = q.type === "multi" ? "multi" : "text";
        return {
          id: String(q.id ?? `q${i + 1}`),
          type: type as F2Question["type"],
          question: String(q.question ?? ""),
          ...(type === "multi"
            ? { options: (Array.isArray(q.options) ? q.options : []).map(String).slice(0, 6) }
            : {}),
        };
      })
      .filter((q) => q.question.length > 0)
      .slice(0, 20);
    if (questions.length === 0) {
      return NextResponse.json(errorEnvelope("AGENT_OUTPUT_INVALID", "The model returned no questions — try again."), { status: 502 });
    }
    await prisma.stageState.update({
      where: { projectId_stage: { projectId: params.id, stage: "F2" } },
      data: { data: JSON.stringify({ ...stateData, questions }) },
    });
    return NextResponse.json({ questions });
  }

  if (parsed.data.action === "analyze") {
    // Structured answers replace the free chat — no drift possible.
    const byId = new Map((stateData.questions ?? []).map((q) => [q.id, q]));
    const qaTranscript = parsed.data.answers
      .filter((a) => byId.has(a.id) && a.values.length > 0)
      .map((a) => {
        const q = byId.get(a.id)!;
        return a.values.length === 1 && q.type === "text"
          ? `Q: ${q.question}\nA: ${a.values[0]}`
          : `Q: ${q.question}\nA (selected): ${a.values.join("; ")}`;
      })
      .join("\n\n");
    if (qaTranscript.length === 0) {
      return NextResponse.json(errorEnvelope("PRECONDITION_FAILED", "Answer at least one question before analyzing."), { status: 422 });
    }
    const answered = new Set(parsed.data.answers.filter((a) => a.values.length > 0).map((a) => a.id));
    const total = stateData.questions?.length ?? 0;
    if (total > 0 && answered.size < Math.min(total, 4)) {
      return NextResponse.json(errorEnvelope("PRECONDITION_FAILED", `Answer at least 4 questions first (${answered.size}/${total} answered).`), { status: 422 });
    }
    return await runAnalysis(params, stateData, qaTranscript, parsed.data.answers);
  }

  // complete: require a gap report, then unlock F3 (Literature) carrying the topic + gaps.
  if (!stateData.report) {
    return NextResponse.json(errorEnvelope("PRECONDITION_FAILED", "Run the gap analysis before completing F2."), {
      status: 409,
    });
  }
  const stages = await completeStage(params.id, "F2");
  await prisma.stageState.update({
    where: { projectId_stage: { projectId: params.id, stage: "F3" } },
    data: {
      data: JSON.stringify({
        topic: stateData.topic ?? {},
        gaps: stateData.report.gaps.map((g) => g.concept),
      }),
    },
  });
  return NextResponse.json({ stages });
}

async function runAnalysis(
  params: { id: string },
  stateData: { topic?: { title?: string; problem?: string }; report?: GapReport },
  qaTranscript: string,
  answers: Array<{ id: string; values: string[] }>
) {
  const raw = await chatComplete(
    [
      {
        role: "system",
        content: `You are Euler, a research assistant agent and the Gap Analyst. Given a researcher's questionnaire answers about their locked topic, produce a precise knowledge-gap report.

Respond with ONLY a JSON object — no prose, no markdown — in exactly this shape:
${ANALYZE_SCHEMA}

Rules: knownAreas = topics the user clearly already knows (based on their answers). gaps = 3 to 6 MISSING concepts the user must learn to execute the topic, ordered foundational-first. searchQuery = a short arXiv search phrase that would find survey/introductory papers for that concept. currentUnderstanding = quote or paraphrase what the user said they know about that concept. Base everything strictly on the answers — do not invent knowledge the user did not reveal.`,
      },
      {
        role: "user",
        content: `Locked topic: ${stateData.topic?.title ?? ""}\nTopic problem: ${stateData.topic?.problem ?? ""}\n\nQuestionnaire answers:\n${qaTranscript}`,
      },
    ],
    { jsonMode: true, maxTokens: 2048, fixture: "gaps" }
  );
  let reportRaw: unknown;
  try {
    reportRaw = parseLooseJson(raw);
  } catch {
    return NextResponse.json(errorEnvelope("AGENT_OUTPUT_INVALID", "The model did not return a valid gap report — try again."), { status: 502 });
  }
  const obj = (reportRaw ?? {}) as Record<string, unknown>;
  const gaps = (Array.isArray(obj.gaps) ? obj.gaps : []) as GapItem[];
  const knownAreas = (Array.isArray(obj.knownAreas) ? obj.knownAreas : []).map(String);
  const cleanedGaps = gaps
    .map((g) => ({
      concept: String(g.concept ?? ""),
      whyItMatters: String(g.whyItMatters ?? ""),
      currentUnderstanding: String(g.currentUnderstanding ?? ""),
      searchQuery: String(g.searchQuery ?? g.concept ?? "").slice(0, 120),
    }))
    .filter((g) => g.concept.length > 0)
    .slice(0, 6);
  if (cleanedGaps.length === 0) {
    return NextResponse.json(errorEnvelope("AGENT_OUTPUT_INVALID", "The model returned no gaps — try again."), { status: 502 });
  }
  return await persistReport(params, stateData, { knownAreas, gaps: cleanedGaps, papers: [] }, true, answers);
}

async function persistReport(
  params: { id: string },
  stateData: { topic?: { title?: string; problem?: string }; report?: GapReport; answers?: Array<{ id: string; values: string[] }> },
  report: GapReport,
  searchPapers: boolean,
  answers?: Array<{ id: string; values: string[] }>
) {
  // Ground papers in REAL arXiv results — one search per gap, dedup by extId.
  const papers: GapReport["papers"] = [];
  if (searchPapers) {
    const seen = new Set<string>();
    for (const gap of report.gaps) {
      try {
        const results = await searchArxiv(gap.searchQuery || gap.concept, 2);
        for (const p of results) {
          if (seen.has(p.extId) || papers.length >= 10) continue;
          seen.add(p.extId);
          papers.push({
            title: p.title, authors: p.authors, year: p.year, url: p.url,
            extId: p.extId, abstract: p.abstract, reason: gap.concept,
          });
        }
      } catch {
        // arXiv hiccup on one query shouldn't fail the whole report.
      }
    }
  }
  const finalReport: GapReport = { ...report, papers };
  await prisma.$transaction([
    prisma.paperRef.deleteMany({ where: { projectId: params.id, stage: "F2" } }),
    ...finalReport.papers.map((p) =>
      prisma.paperRef.create({
        data: {
          projectId: params.id,
          stage: "F2",
          title: p.title,
          authors: p.authors.join(", "),
          year: p.year,
          venue: "arXiv",
          abstract: p.abstract,
          url: p.url,
          source: "arxiv",
          extId: p.extId,
          reason: p.reason,
        },
      })
    ),
    prisma.stageState.update({
      where: { projectId_stage: { projectId: params.id, stage: "F2" } },
      data: { data: JSON.stringify({ ...stateData, answers, report: finalReport }) },
    }),
  ]);
  const existingArtifact = await prisma.artifact.findFirst({
    where: { projectId: params.id, stage: "F2", kind: "GAP_REPORT" },
  });
  const artifactTitle = `Gap report — ${stateData.topic?.title ?? ""}`;
  if (existingArtifact) {
    await prisma.artifact.update({
      where: { id: existingArtifact.id },
      data: { content: JSON.stringify(finalReport), title: artifactTitle, version: existingArtifact.version + 1 },
    });
  } else {
    await prisma.artifact.create({
      data: {
        projectId: params.id,
        stage: "F2",
        kind: "GAP_REPORT",
        title: artifactTitle,
        content: JSON.stringify(finalReport),
      },
    });
  }
  return NextResponse.json({ report: finalReport });
}