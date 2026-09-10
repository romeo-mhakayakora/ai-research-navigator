import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CreateProjectSchema } from "@/lib/validation";
import { errorEnvelope } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(errorEnvelope("VALIDATION_ERROR", `${issue.path.join(".")}: ${issue.message}`), {
      status: 400,
    });
  }
  const { title, domain, background, level } = parsed.data;
  const project = await prisma.project.create({
    data: { title: title ?? domain, domain, userLevel: level },
  });
  // Seed the home-page interest as the first F1 chat message so the
  // assistant already has context — the user is never asked twice.
  await prisma.message.create({
    data: { projectId: project.id, stage: "F1", role: "USER", content: domain },
  });
  const stages: Array<"F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7"> = ["F1", "F2", "F3", "F4", "F5", "F6", "F7"];
  await prisma.stageState.createMany({
    data: stages.map((stage) => ({
      projectId: project.id,
      stage,
      status: stage === "F1" ? "ACTIVE" : "LOCKED",
      data: stage === "F1" ? JSON.stringify({ intake: { domain, background, level }, clarQuestionCount: 0 }) : "{}",
    })),
  });
  return NextResponse.json({ projectId: project.id }, { status: 201 });
}
