import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const f2State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const f2Data = f2State ? JSON.parse(f2State.data || "{}") : {};

  const f4State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F4" } },
  });
  const f4Data = f4State ? JSON.parse(f4State.data || "{}") : {};

  const f4Report = await prisma.artifact.findFirst({
    where: { projectId: params.id, stage: "F4", kind: "VALIDATION_REPORT" },
  });

  const f5State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F5" } },
  });
  const f5Data = f5State ? JSON.parse(f5State.data || "{}") : {};

  const experiments = await prisma.experimentLog.findMany({
    where: { projectId: params.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({
    methodology: f4Report ? JSON.parse(f4Report.content)?.finalizedMethodology ?? "" : "",
    iterations: f4Data.iterations ?? [],
    topic: f2Data.topic ?? null,
    gaps: f2Data.gaps ?? [],
    userLevel: f2Data.userLevel ?? "",
    userResources: f2Data.userResources ?? "",
    researchQuestions: f2Data.researchQuestions ?? [],
    chat: f5Data.chat ?? [],
    experiments: experiments.map((e) => ({
      id: e.id,
      name: e.name,
      hypothesis: e.hypothesis,
      result: e.result,
      learning: e.learning,
      createdAt: e.createdAt,
    })),
  });
}
