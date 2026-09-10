import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const f2State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const f2Data = f2State ? JSON.parse(f2State.data || "{}") : {};

  const f3Papers = await prisma.paperRef.findMany({
    where: { projectId: params.id, stage: "F3" },
    orderBy: { createdAt: "asc" },
  });

  const f4Report = await prisma.artifact.findFirst({
    where: { projectId: params.id, stage: "F4", kind: "VALIDATION_REPORT" },
  });

  const experiments = await prisma.experimentLog.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });

  const f6State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F6" } },
  });
  const f6Data = f6State ? JSON.parse(f6State.data || "{}") : {};
  const sections = f6Data.sections ?? {};

  const f7State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F7" } },
  });
  const f7Data = f7State ? JSON.parse(f7State.data || "{}") : {};

  const project = await prisma.project.findUnique({ where: { id: params.id } });

  return NextResponse.json({
    topic: f2Data.topic ?? null,
    gaps: f2Data.gaps ?? [],
    researchQuestions: f2Data.topic?.researchQuestions ?? [],
    methodology: f4Report ? JSON.parse(f4Report.content)?.finalizedMethodology ?? "" : "",
    experimentCount: experiments.length,
    paperCount: f3Papers.length,
    sections,
    title: sections.title ?? "",
    abstract: sections.abstract ?? "",
    referenceCount: (f6Data.references ?? []).length,
    hasReferencesSection: Boolean(sections.references),
    userLevel: project?.userLevel ?? "",
    venues: f7Data.venues ?? [],
    prefs: f7Data.prefs ?? { paperType: "conference", openAccess: false },
    checklist: f7Data.checklist ?? [],
    selectedVenue: f7Data.selectedVenue ?? "",
    submitted: f7Data.submitted ?? null,
  });
}
