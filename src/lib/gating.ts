import { prisma } from "@/lib/db";
import { STAGE_ORDER, type StageId } from "@/lib/validation";

export class GateError extends Error {
  code = "STAGE_LOCKED";
}

export async function getStageStates(projectId: string) {
  const states = await prisma.stageState.findMany({ where: { projectId } });
  const testUnlock = process.env.TEST_UNLOCK_STAGES === "1";
  const map = new Map(states.map((s) => [s.stage, s]));
  return STAGE_ORDER.map((stage) => {
    const status = (map.get(stage)?.status ?? "LOCKED") as "LOCKED" | "ACTIVE" | "COMPLETE";
    return {
      stage,
      status: testUnlock && status === "LOCKED" ? ("ACTIVE" as const) : status,
    };
  });
}

export async function assertStageOpen(projectId: string, stage: StageId) {
  // Testing mode: bypass gating so every stage can be tried independently.
  if (process.env.TEST_UNLOCK_STAGES === "1") {
    const s = await prisma.stageState.findUnique({
      where: { projectId_stage: { projectId, stage } },
    });
    if (s) return s;
    return { stage, status: "ACTIVE" } as never;
  }
  const state = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId, stage } },
  });
  if (!state || state.status === "LOCKED") throw new GateError(`Stage ${stage} is locked`);
  return state;
}

export async function completeStage(projectId: string, stage: StageId) {
  const idx = STAGE_ORDER.indexOf(stage);
  await prisma.stageState.update({
    where: { projectId_stage: { projectId, stage } },
    data: { status: "COMPLETE" },
  });
  const next = STAGE_ORDER[idx + 1];
  if (next) {
    await prisma.stageState.update({
      where: { projectId_stage: { projectId, stage: next } },
      data: { status: "ACTIVE" },
    });
  }
  return getStageStates(projectId);
}
