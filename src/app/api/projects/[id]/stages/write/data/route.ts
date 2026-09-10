import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const f2State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const f2Data = f2State ? JSON.parse(f2State.data || "{}") : {};

  const f4Report = await prisma.artifact.findFirst({
    where: { projectId: params.id, stage: "F4", kind: "VALIDATION_REPORT" },
  });

  const f3Papers = await prisma.paperRef.findMany({
    where: { projectId: params.id, stage: "F3" },
    orderBy: { createdAt: "asc" },
  });

  const experiments = await prisma.experimentLog.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });

  const f6State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F6" } },
  });
  const f6Data = f6State ? JSON.parse(f6State.data || "{}") : {};

  return NextResponse.json({
    methodology: f4Report ? JSON.parse(f4Report.content)?.finalizedMethodology ?? "" : "",
    topic: f2Data.topic ?? null,
    gaps: f2Data.gaps ?? [],
    researchQuestions: f2Data.topic?.researchQuestions ?? [],
    papers: f3Papers.map((p) => ({
      title: p.title,
      authors: p.authors,
      year: p.year,
      extId: p.extId,
      url: p.url,
    })),
    experiments: experiments.map((e) => ({
      name: e.name,
      hypothesis: e.hypothesis,
      result: e.result,
      learning: e.learning,
    })),
    sections: f6Data.sections ?? {},
    references: f6Data.references ?? [],
  });
}
