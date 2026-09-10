import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const f2State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const f2Data = f2State ? JSON.parse(f2State.data || "{}") : {};

  const f3State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F3" } },
  });
  const f3Data = f3State ? JSON.parse(f3State.data || "{}") : {};

  const f4State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F4" } },
  });
  const f4Data = f4State ? JSON.parse(f4State.data || "{}") : {};

  const report = await prisma.artifact.findFirst({
    where: { projectId: params.id, stage: "F4", kind: "VALIDATION_REPORT" },
  });

  const messages = await prisma.message.findMany({
    where: { projectId: params.id, stage: "F4" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({
    topic: f2Data.topic ?? null,
    gaps: f2Data.gaps ?? [],
    userLevel: f2Data.userLevel ?? "",
    userResources: f2Data.userResources ?? "",
    researchQuestions: f2Data.researchQuestions ?? [],
    solutions: f3Data.solutions ?? [],
    iterations: f4Data.iterations ?? [],
    report: report ? JSON.parse(report.content) : null,
    messages: messages.map((m) => ({ role: m.role.toLowerCase(), content: m.content, createdAt: m.createdAt })),
  });
}
