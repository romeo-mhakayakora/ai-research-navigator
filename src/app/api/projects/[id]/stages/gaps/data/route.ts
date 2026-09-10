import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stageIdFromKey } from "@/lib/validation";
import { assertStageOpen, GateError } from "@/lib/gating";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await assertStageOpen(params.id, stageIdFromKey("gaps"));
  } catch (e) {
    if (e instanceof GateError)
      return NextResponse.json({ error: { code: "STAGE_LOCKED", message: "Stage is locked" } }, { status: 403 });
    throw e;
  }
  const stageState = await prisma.stageState.findUniqueOrThrow({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const messages = await prisma.message.findMany({
    where: { projectId: params.id, stage: "F2" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const data = JSON.parse(stageState.data) as {
    topic?: { title?: string; problem?: string };
    questions?: Array<{ id: string; type: string; question: string; options?: string[] }>;
    answers?: Array<{ id: string; values: string[] }>;
    report?: unknown;
  };
  return NextResponse.json({
    topic: data.topic ?? null,
    questions: data.questions ?? null,
    answers: data.answers ?? null,
    report: data.report ?? null,
    messages: messages.map((m) => ({ role: m.role.toLowerCase(), content: m.content, createdAt: m.createdAt })),
  });
}