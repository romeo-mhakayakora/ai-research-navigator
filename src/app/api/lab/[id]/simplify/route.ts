import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chatComplete } from "@/lib/harness/provider/llm";
import { buildSimplifyPrompt, buildSectionContext } from "@/lib/harness/agents/f8-lab";
import { errorEnvelope } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await prisma.paperSession.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json(errorEnvelope("NOT_FOUND", "Session not found"), { status: 404 });
  const body = await req.json().catch(() => ({}));
  const scope = body.scope as string[] | undefined; // array of section indices, or all
  const sections = JSON.parse(s.sections || "[]");

  const wholePaper = !scope || scope.length === 0;
  const context = wholePaper ? s.fullText : buildSectionContext(sections, scope);
  if (!context || context.trim().length < 20) {
    return NextResponse.json({ error: { message: "No paper text available yet — split the paper into sections first." } }, { status: 400 });
  }

  try {
    const simplified = await chatComplete(
      [
        { role: "system", content: "You are Euler, a research assistant agent that simplifies papers for students." },
        { role: "user", content: buildSimplifyPrompt(context, wholePaper) },
      ],
      { maxTokens: 1200 }
    );
    return NextResponse.json({ simplified });
  } catch (e: any) {
    return NextResponse.json({ error: { message: e?.message ?? "Simplify failed" } }, { status: 502 });
  }
}