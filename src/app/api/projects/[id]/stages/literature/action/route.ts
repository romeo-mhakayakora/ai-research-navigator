import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertStageOpen, completeStage, GateError } from "@/lib/gating";
import { errorEnvelope } from "@/lib/utils";
import { searchArxiv } from "@/lib/harness/tools/arxiv";
import { chatComplete } from "@/lib/harness/provider/llm";
import { F3_SYSTEM_PROMPT, buildSearchPrompt } from "@/lib/harness/agents/f3-literature";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const gate = await assertStageOpen(params.id, "F3").catch((e) => e);
  if (gate instanceof GateError)
    return NextResponse.json(errorEnvelope("STAGE_LOCKED", gate.message), { status: 403 });

  const f2State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const f2Data = f2State ? JSON.parse(f2State.data || "{}") : {};
  const topic = f2Data.topic ?? { title: "", researchQuestions: [] };
  const gaps: string[] = f2Data.gaps ?? [];

  if (action === "search") {
    try {
      const searchPrompt = buildSearchPrompt({
        topicTitle: topic.title ?? "",
        researchQuestions: topic.researchQuestions ?? [],
        gaps,
      });

      // Run searches for each gap + research question
      const searchQueries = [
        ...(topic.researchQuestions ?? []),
        ...gaps,
      ].filter(Boolean).slice(0, 6);

      const allPapers = new Map<string, any>();
      for (const q of searchQueries) {
        try {
          const papers = await searchArxiv(q, 3);
          for (const p of papers) {
            if (p.extId && !allPapers.has(p.extId)) {
              allPapers.set(p.extId, p);
            }
          }
        } catch {
          // skip failed searches
        }
      }

      const paperList = Array.from(allPapers.values());
      if (paperList.length === 0) {
        return NextResponse.json({ solutions: [], papers: [] });
      }

      // Ask LLM to group papers by solution
      const paperContext = paperList.map((p, i) =>
        `[${i}] extId: ${p.extId}\ntitle: ${p.title}\nauthors: ${p.authors.slice(0, 3).join(", ")}\nabstract: ${p.abstract.slice(0, 400)}`
      ).join("\n\n");

      const userPrompt = `${searchPrompt}\n\nPAPERS FOUND:\n${paperContext}\n\nGroup these papers by the solution/approach they propose. Return JSON with solutions array.`;

      const result = await chatComplete(
        [{ role: "system", content: F3_SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
        { maxTokens: 2048 }
      );

      let parsed: { solutions: any[] };
      try {
        parsed = JSON.parse(result);
      } catch {
        // Try to extract JSON from prose
        const match = result.match(/\{[\s\S]*"solutions"[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else return NextResponse.json({ solutions: [], papers: paperList });
      }

      // Save papers to DB
      for (const paper of paperList) {
        await prisma.paperRef.upsert({
          where: { projectId_extId: { projectId: params.id, extId: paper.extId } },
          update: {
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            url: paper.url,
            abstract: paper.abstract,
            stage: "F3",
            venue: paper.venue ?? "arXiv",
            source: "arxiv",
          },
          create: {
            projectId: params.id,
            extId: paper.extId,
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            url: paper.url,
            abstract: paper.abstract,
            stage: "F3",
            venue: paper.venue ?? "arXiv",
            source: "arxiv",
          },
        });
      }

      // Save solutions to stage state
      await prisma.stageState.upsert({
        where: { projectId_stage: { projectId: params.id, stage: "F3" } },
        update: { data: JSON.stringify({ solutions: parsed.solutions ?? [] }) },
        create: {
          projectId: params.id,
          stage: "F3",
          status: "ACTIVE",
          data: JSON.stringify({ solutions: parsed.solutions ?? [] }),
        },
      });

      return NextResponse.json({
        solutions: parsed.solutions ?? [],
        papers: paperList,
      });
    } catch (e: any) {
      return NextResponse.json({ error: { message: e?.message ?? "Search failed" } }, { status: 502 });
    }
  }

  if (action === "saveNotes") {
    const { extId, notes, solutionTag } = body;
    if (!extId) return NextResponse.json({ error: { message: "extId required" } }, { status: 400 });
    await prisma.paperRef.updateMany({
      where: { projectId: params.id, extId },
      data: { notes: notes ?? "", solutionTag: solutionTag ?? null },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "complete") {
    const f3State = await prisma.stageState.findUnique({
      where: { projectId_stage: { projectId: params.id, stage: "F3" } },
    });
    const f3Data = f3State ? JSON.parse(f3State.data || "{}") : {};
    if (!f3Data.solutions?.length) {
      return NextResponse.json({ error: { message: "Search for solutions first before completing." } }, { status: 400 });
    }

    await prisma.artifact.upsert({
      where: { projectId_stage_kind: { projectId: params.id, stage: "F3", kind: "LITERATURE_SURVEY" } },
      update: { content: JSON.stringify({ solutions: f3Data.solutions, completedAt: new Date().toISOString() }) },
      create: {
        projectId: params.id,
        stage: "F3",
        kind: "LITERATURE_SURVEY",
        title: "Literature Survey",
        content: JSON.stringify({ solutions: f3Data.solutions, completedAt: new Date().toISOString() }),
      },
    });

    await completeStage(params.id, "F3");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: { message: "Unknown action" } }, { status: 400 });
}
