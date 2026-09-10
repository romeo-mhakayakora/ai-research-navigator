import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const messages = await prisma.message.findMany({
    where: { projectId: params.id, stage: "F1" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const brief = await prisma.artifact.findFirst({
    where: { projectId: params.id, stage: "F1", kind: "TOPIC_BRIEF" },
  });
  const stageState = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F1" } },
  });
  const data = stageState ? JSON.parse(stageState.data) : {};
  return NextResponse.json({
    messages: messages.map((m) => ({ role: m.role.toLowerCase(), content: m.content, createdAt: m.createdAt })),
    brief: brief ? JSON.parse(brief.content) : null,
    finalTopicId: data.finalTopicId ?? null,
    candidates: data.candidates ?? [],
  });
}
