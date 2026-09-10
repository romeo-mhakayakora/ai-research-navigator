import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorEnvelope } from "@/lib/utils";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json(errorEnvelope("NOT_FOUND", "Project not found"), { status: 404 });
  if (project.isDemo) {
    return NextResponse.json(errorEnvelope("FORBIDDEN", "The demo project cannot be deleted."), { status: 403 });
  }
  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: params.id });
}
