import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertStageOpen, completeStage, GateError } from "@/lib/gating";
import { errorEnvelope } from "@/lib/utils";
import { searchArxiv } from "@/lib/harness/tools/arxiv";
import { chatComplete } from "@/lib/harness/provider/llm";
import { F4_SYSTEM_PROMPT, buildAttackPrompt } from "@/lib/harness/agents/f4-validate";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const gate = await assertStageOpen(params.id, "F4").catch((e) => e);
  if (gate instanceof GateError)
    return NextResponse.json(errorEnvelope("STAGE_LOCKED", gate.message), { status: 403 });

  // Load context from F2 and F3
  const f2State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const f2Data = f2State ? JSON.parse(f2State.data || "{}") : {};
  const topic = f2Data.topic ?? { title: "", researchQuestions: [] };
  const gaps: string[] = f2Data.gaps ?? [];
  const userLevel: string = f2Data.userLevel ?? "";
  const userResources: string = f2Data.userResources ?? "";

  const f3State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F3" } },
  });
  const f3Data = f3State ? JSON.parse(f3State.data || "{}") : {};

  if (action === "attack") {
    const methodology = body.methodology as string;
    if (!methodology || methodology.trim().length < 10) {
      return NextResponse.json({ error: { message: "Describe your proposed methodology first (at least a few sentences)." } }, { status: 400 });
    }

    try {
      // Search arXiv for similar papers (novelty check)
      const searchQuery = topic.title ?? "";
      let similarPapers: any[] = [];
      if (searchQuery) {
        try {
          const papers = await searchArxiv(searchQuery, 5);
          similarPapers = papers.map((p) => ({
            title: p.title,
            authors: p.authors,
            year: p.year,
            extId: p.extId,
          }));
        } catch {
          // continue without papers
        }
      }

      const attackPrompt = buildAttackPrompt({
        topicTitle: topic.title ?? "",
        researchQuestions: topic.researchQuestions ?? [],
        gaps,
        userLevel,
        userResources,
        methodology,
        similarPapers,
      });

      const result = await chatComplete(
        [{ role: "system", content: F4_SYSTEM_PROMPT }, { role: "user", content: attackPrompt }],
        { maxTokens: 2048 }
      );

      let parsed: any;
      try {
        parsed = JSON.parse(result);
      } catch {
        const match = result.match(/\{[\s\S]*"novelty"[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else return NextResponse.json({ error: { message: "Could not parse validation — try again." } }, { status: 502 });
      }

      // Save iteration to stage state
      const f4State = await prisma.stageState.findUnique({
        where: { projectId_stage: { projectId: params.id, stage: "F4" } },
      });
      const f4Data = f4State ? JSON.parse(f4State.data || "{}") : {};
      const iterations = f4Data.iterations ?? [];
      iterations.push({ methodology, attack: parsed, at: new Date().toISOString() });

      await prisma.stageState.upsert({
        where: { projectId_stage: { projectId: params.id, stage: "F4" } },
        update: { data: JSON.stringify({ ...f4Data, iterations }) },
        create: {
          projectId: params.id,
          stage: "F4",
          status: "ACTIVE",
          data: JSON.stringify({ iterations }),
        },
      });

      return NextResponse.json({ attack: parsed });
    } catch (e: any) {
      return NextResponse.json({ error: { message: e?.message ?? "Validation failed" } }, { status: 502 });
    }
  }

  if (action === "finalize") {
    const methodology = body.methodology as string;
    if (!methodology) {
      return NextResponse.json({ error: { message: "No finalized methodology to store." } }, { status: 400 });
    }

    const f4State = await prisma.stageState.findUnique({
      where: { projectId_stage: { projectId: params.id, stage: "F4" } },
    });
    const f4Data = f4State ? JSON.parse(f4State.data || "{}") : {};

    const report = {
      finalizedMethodology: methodology,
      iterations: f4Data.iterations ?? [],
      topic: topic.title,
      completedAt: new Date().toISOString(),
    };

    await prisma.artifact.upsert({
      where: { projectId_stage_kind: { projectId: params.id, stage: "F4", kind: "VALIDATION_REPORT" } },
      update: { content: JSON.stringify(report) },
      create: {
        projectId: params.id,
        stage: "F4",
        kind: "VALIDATION_REPORT",
        title: "Idea Validation Report",
        content: JSON.stringify(report),
      },
    });

    await completeStage(params.id, "F4");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: { message: "Unknown action" } }, { status: 400 });
}
