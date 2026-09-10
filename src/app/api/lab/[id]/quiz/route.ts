import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chatComplete } from "@/lib/harness/provider/llm";
import { LAB_QUIZ_PROMPT, buildSectionContext } from "@/lib/harness/agents/f8-lab";
import { parseLooseJson, errorEnvelope } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await prisma.paperSession.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json(errorEnvelope("NOT_FOUND", "Session not found"), { status: 404 });
  const body = await req.json().catch(() => ({}));
  const scope = body.scope as string[] | undefined;
  const sections = JSON.parse(s.sections || "[]");

  const wholePaper = !scope || scope.length === 0;
  const context = wholePaper ? s.fullText : buildSectionContext(sections, scope);
  if (!context || context.trim().length < 20) {
    return NextResponse.json({ error: { message: "No paper text available yet." } }, { status: 400 });
  }

  try {
    const raw = await chatComplete(
      [
        { role: "system", content: LAB_QUIZ_PROMPT },
        {
          role: "user",
          content: `PAPER TEXT (${wholePaper ? "whole paper" : "selected sections"}):\n\n${context}`,
        },
      ],
      { maxTokens: 3000 }
    );
    const parsed = parseLooseJson(raw);
    const questions = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(questions) || questions.length === 0) throw new Error("Model returned no questions");
    const slim = questions.slice(0, 12).map((q: any) => ({
      type: ["mcq", "multi", "short"].includes(q.type) ? q.type : "mcq",
      question: String(q.question ?? ""),
      options: Array.isArray(q.options) ? q.options.slice(0, 6).map(String) : undefined,
      answer: q.answer,
      explanation: String(q.explanation ?? ""),
    }));
    return NextResponse.json({ scope: scope ?? [], questions: slim });
  } catch (e: any) {
    return NextResponse.json({ error: { message: e?.message ?? "Quiz generation failed" } }, { status: 502 });
  }
}