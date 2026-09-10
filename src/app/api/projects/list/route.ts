import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { STAGE_ORDER } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { stages: true },
  });

  const items = projects.map((p) => {
    const statusMap = new Map(p.stages.map((s) => [s.stage, s.status]));
    // Find the first ACTIVE stage (the current work); if none, the last COMPLETE one.
    let currentStage = STAGE_ORDER.find((s) => statusMap.get(s) === "ACTIVE");
    if (!currentStage) {
      currentStage = [...STAGE_ORDER].reverse().find((s) => statusMap.get(s) === "COMPLETE");
    }
    const completedCount = STAGE_ORDER.filter((s) => statusMap.get(s) === "COMPLETE").length;
    return {
      id: p.id,
      title: p.title,
      domain: p.domain,
      userLevel: p.userLevel,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      currentStage: currentStage ?? "F1",
      completedCount,
      totalStages: STAGE_ORDER.length,
      isDemo: p.isDemo,
    };
  });

  return NextResponse.json({ projects: items });
}
