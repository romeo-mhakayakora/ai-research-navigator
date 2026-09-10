import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertStageOpen, completeStage, GateError } from "@/lib/gating";
import { errorEnvelope } from "@/lib/utils";
import { chatComplete } from "@/lib/harness/provider/llm";
import {
  F7_SYSTEM_PROMPT,
  buildVenuePrompt,
  CHECKLIST_TEMPLATES,
} from "@/lib/harness/agents/f7-publish";

type Venue = {
  name: string;
  type: string;
  deadlinePattern: string;
  acceptanceBand: string;
  fit: string;
  risk: string;
};

function parseLooseJson(raw: string): any {
  const t = raw.trim();
  try {
    return JSON.parse(t);
  } catch { /* fall through */ }
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch { /* fall through */ }
  }
  const start = t.search(/[\[{]/);
  if (start >= 0) {
    const endIdx = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
    if (endIdx > start) {
      try {
        return JSON.parse(t.slice(start, endIdx + 1));
      } catch { /* fall through */ }
    }
  }
  throw new Error("Model returned non-JSON output");
}

async function loadF7(projectId: string) {
  const s = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId, stage: "F7" } },
  });
  return s ? JSON.parse(s.data || "{}") : {};
}

async function saveF7(projectId: string, data: any) {
  await prisma.stageState.upsert({
    where: { projectId_stage: { projectId, stage: "F7" } },
    update: { data: JSON.stringify(data) },
    create: { projectId, stage: "F7", status: "ACTIVE", data: JSON.stringify(data) },
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const gate = await assertStageOpen(params.id, "F7").catch((e) => e);
  if (gate instanceof GateError)
    return NextResponse.json(errorEnvelope("STAGE_LOCKED", gate.message), { status: 403 });

  const f7Data = await loadF7(params.id);

  if (action === "recommend") {
    const paperType = String(body.paperType ?? "conference");
    const openAccess = Boolean(body.openAccess);

    const f2State = await prisma.stageState.findUnique({
      where: { projectId_stage: { projectId: params.id, stage: "F2" } },
    });
    const f2Data = f2State ? JSON.parse(f2State.data || "{}") : {};

    const f6State = await prisma.stageState.findUnique({
      where: { projectId_stage: { projectId: params.id, stage: "F6" } },
    });
    const sections = f6State ? JSON.parse(f6State.data || "{}").sections ?? {} : {};

    const project = await prisma.project.findUnique({ where: { id: params.id } });

    const prompt = buildVenuePrompt({
      title: sections.title ?? "",
      abstract: sections.abstract ?? "",
      topicTitle: f2Data.topic?.title ?? "",
      paperType,
      openAccess,
      experienceLevel: project?.userLevel ?? "",
    });

    let lastErr = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await chatComplete(
          [
            { role: "system", content: F7_SYSTEM_PROMPT },
            {
              role: "user",
              content:
                attempt === 0
                  ? prompt
                  : prompt + "\n\nREMINDER: reply with ONLY the JSON array, no prose or fences.",
            },
          ],
          { maxTokens: 2000 }
        );
        const parsed = parseLooseJson(raw);
        const arr = Array.isArray(parsed) ? parsed : parsed.venues;
        if (!Array.isArray(arr) || arr.length === 0) throw new Error("Model returned no venues");
        const venues: Venue[] = arr.slice(0, 8).map((v: any) => ({
          name: String(v.name ?? "Unknown venue"),
          type: String(v.type ?? paperType),
          deadlinePattern: String(v.deadlinePattern ?? "Check the official site for dates"),
          acceptanceBand: String(v.acceptanceBand ?? "Varies — check official site"),
          fit: String(v.fit ?? ""),
          risk: String(v.risk ?? ""),
        }));

        const prefs = { paperType, openAccess };
        const checklist =
          f7Data.prefs?.paperType === paperType && Array.isArray(f7Data.checklist)
            ? f7Data.checklist
            : (CHECKLIST_TEMPLATES[paperType] ?? CHECKLIST_TEMPLATES.conference).map((label) => ({
                label,
                done: false,
              }));
        await saveF7(params.id, { ...f7Data, venues, prefs, checklist });
        return NextResponse.json({ venues, prefs });
      } catch (e: any) {
        lastErr = e?.message ?? "Recommendation failed";
      }
    }
    return NextResponse.json({ error: { message: lastErr } }, { status: 502 });
  }

  if (action === "toggleCheck") {
    const index = Number(body.index);
    const checklist = Array.isArray(f7Data.checklist) ? f7Data.checklist : [];
    if (!Number.isInteger(index) || index < 0 || index >= checklist.length) {
      return NextResponse.json({ error: { message: "Invalid checklist index" } }, { status: 400 });
    }
    checklist[index] = { ...checklist[index], done: !checklist[index].done };
    await saveF7(params.id, { ...f7Data, checklist });
    return NextResponse.json({ checklist });
  }

  if (action === "selectVenue") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: { message: "Venue name required" } }, { status: 400 });
    await saveF7(params.id, { ...f7Data, selectedVenue: name });
    return NextResponse.json({ ok: true, selectedVenue: name });
  }

  if (action === "complete") {
    const venue = String(body.venue ?? f7Data.selectedVenue ?? "").trim();
    if (!venue) {
      return NextResponse.json({ error: { message: "Pick a venue before completing." } }, { status: 400 });
    }
    const checklist = Array.isArray(f7Data.checklist) ? f7Data.checklist : [];
    const doneCount = checklist.filter((c: any) => c.done).length;
    const submitted = { venue, date: new Date().toISOString(), checklistDone: doneCount, checklistTotal: checklist.length };
    await saveF7(params.id, { ...f7Data, selectedVenue: venue, submitted });

    await prisma.artifact.upsert({
      where: { projectId_stage_kind: { projectId: params.id, stage: "F7", kind: "SUBMISSION_RECORD" } },
      update: { content: JSON.stringify(submitted), title: `Submission — ${venue}` },
      create: {
        projectId: params.id,
        stage: "F7",
        kind: "SUBMISSION_RECORD",
        title: `Submission — ${venue}`,
        content: JSON.stringify(submitted),
      },
    });

    await completeStage(params.id, "F7");
    return NextResponse.json({ ok: true, submitted });
  }

  return NextResponse.json({ error: { message: "Unknown action" } }, { status: 400 });
}
