import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chatComplete } from "@/lib/harness/provider/llm";
import { LAB_GRADE_PROMPT } from "@/lib/harness/agents/f8-lab";
import { parseLooseJson, errorEnvelope } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await prisma.paperSession.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json(errorEnvelope("NOT_FOUND", "Session not found"), { status: 404 });
  const body = await req.json().catch(() => ({}));
  const questions = (body.questions as any[]) ?? [];
  const userAnswers = (body.answers as any[]) ?? []; // [{ q: index, value }]
  const scope = (body.scope as string[]) ?? [];

  if (questions.length === 0) return NextResponse.json({ error: { message: "No questions to grade" } }, { status: 400 });

  const maxScore = questions.length;
  let score = 0;
  const results = [];
  const answerMap = new Map(userAnswers.map((a) => [Number(a.q), a.value]));

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const mine = answerMap.get(i);
    let correct = false;
    let feedback = "";
    if (q.type === "mcq" && Number(mine) === Number(q.answer)) { correct = true; score++; }
    else if (q.type === "multi" && Array.isArray(mine) && Array.isArray(q.answer)) {
      const mySet = new Set(mine.map(Number));
      const ansSet = new Set(q.answer.map(Number));
      if (mySet.size === ansSet.size && Array.from(mySet).every((x) => ansSet.has(x))) { correct = true; score++; }
    } else if (q.type === "short" && typeof mine === "string" && mine.trim()) {
      try {
        const res = await chatComplete(
          [
            { role: "system", content: LAB_GRADE_PROMPT },
            {
              role: "user",
              content: `QUESTION: ${q.question}\nCORRECT ANSWER: ${q.answer}\nEXPLANATION: ${q.explanation}\n\nSTUDENT ANSWER: ${mine}`,
            },
          ],
          { maxTokens: 400 }
        );
        const j = parseLooseJson(res);
        const sc = Number(j.score) || 0;
        score += Math.min(2, Math.max(0, sc)) === 2 ? 1 : Math.min(2, Math.max(0, sc)) === 1 ? 0.5 : 0;
        feedback = String(j.feedback ?? "") + (j.evidence ? `\nEvidence: ${j.evidence}` : "");
      } catch { score += 0; feedback = "Could not grade automatically."; }
    }
    results.push({ index: i, correct, correctAnswer: q.answer, explanation: q.explanation, feedback });
  }

  const record = {
    scope,
    date: new Date().toISOString(),
    questionCount: questions.length,
    score: Math.round(score * 100) / 100,
    maxScore: questions.length,
    results,
  };

  let quizzes: any[] = [];
  try { quizzes = JSON.parse(s.quizzes || "[]"); } catch { /* noop */ }
  quizzes.push(record);
  await prisma.paperSession.update({ where: { id: params.id }, data: { quizzes: JSON.stringify(quizzes) } });

  return NextResponse.json({ score: record.score, maxScore: record.maxScore, results });
}