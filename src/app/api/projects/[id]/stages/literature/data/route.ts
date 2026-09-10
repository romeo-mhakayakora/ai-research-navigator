import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const stageState = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const f2Data = stageState ? JSON.parse(stageState.data || "{}") : {};

  const f3State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F3" } },
  });
  const f3Data = f3State ? JSON.parse(f3State.data || "{}") : {};

  const papers = await prisma.paperRef.findMany({
    where: { projectId: params.id, stage: "F3" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const messages = await prisma.message.findMany({
    where: { projectId: params.id, stage: "F3" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const survey = await prisma.artifact.findFirst({
    where: { projectId: params.id, stage: "F3", kind: "LITERATURE_SURVEY" },
  });

  return NextResponse.json({
    topic: f2Data.topic ?? null,
    gaps: f2Data.gaps ?? [],
    researchQuestions: f2Data.researchQuestions ?? [],
    solutions: f3Data.solutions ?? [],
    savedPapers: papers.map((p) => ({
      extId: p.extId,
      title: p.title,
      authors: p.authors,
      year: p.year,
      url: p.url,
      abstract: p.abstract,
      solutionTag: p.solutionTag,
      notes: p.notes,
    })),
    survey: survey ? JSON.parse(survey.content) : null,
    messages: messages.map((m) => ({ role: m.role.toLowerCase(), content: m.content, createdAt: m.createdAt })),
  });
}
