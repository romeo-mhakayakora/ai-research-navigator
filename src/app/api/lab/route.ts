import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = await prisma.paperSession.findMany({
    orderBy: { updatedAt: "desc" },
  });
  const items = sessions.map((s) => {
    let quizzes: any[] = [];
    try { quizzes = JSON.parse(s.quizzes); } catch { /* noop */ }
    const last = quizzes[quizzes.length - 1];
    return {
      id: s.id,
      title: s.title,
      meta: JSON.parse(s.meta || "{}"),
      sectionCount: JSON.parse(s.sections || "[]").length,
      quizCount: quizzes.length,
      lastScore: last ? `${last.score}/${last.maxScore}` : null,
      updatedAt: s.updatedAt,
      isDemo: s.isDemo,
    };
  });
  return NextResponse.json({ sessions: items });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  const title = String(body.title ?? "").trim().slice(0, 160);
  if (text.length < 40) {
    return NextResponse.json({ error: { message: "Paste at least a few sentences of the paper first." } }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: { message: "A paper title is required." } }, { status: 400 });
  }
  const session = await prisma.paperSession.create({
    data: {
      title,
      meta: JSON.stringify({ authors: String(body.authors ?? ""), year: Number(body.year ?? 0) || null, url: String(body.url ?? ""), source: "text" }),
      fullText: text.slice(0, 16000),
      sections: "[]",
      quizzes: "[]",
    },
  });
  return NextResponse.json({ sessionId: session.id }, { status: 201 });
}