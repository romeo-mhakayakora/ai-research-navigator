import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorEnvelope } from "@/lib/utils";
import { getStageStates } from "@/lib/gating";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json(errorEnvelope("NOT_FOUND", "Project not found"), { status: 404 });
  const stages = await getStageStates(params.id);
  const artifacts = await prisma.artifact.findMany({ where: { projectId: params.id } });
  return NextResponse.json({ project, stages, artifacts });
}
