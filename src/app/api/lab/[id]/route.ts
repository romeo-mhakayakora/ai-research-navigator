import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chatComplete } from "@/lib/harness/provider/llm";
import { LAB_SPLIT_PROMPT } from "@/lib/harness/agents/f8-lab";
import { parseLooseJson, errorEnvelope } from "@/lib/utils";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await prisma.paperSession.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json(errorEnvelope("NOT_FOUND", "Session not found"), { status: 404 });
  if (s.isDemo) {
    return NextResponse.json(errorEnvelope("FORBIDDEN", "The demo session cannot be deleted."), { status: 403 });
  }
  await prisma.paperSession.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: params.id });
}

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await prisma.paperSession.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json(errorEnvelope("NOT_FOUND", "Session not found"), { status: 404 });
  const sections = JSON.parse(s.sections || "[]");
  return NextResponse.json({
    id: s.id,
    title: s.title,
    meta: JSON.parse(s.meta || "{}"),
    sectionCount: sections.length,
    sections: sections.map((x: any) => ({ index: x.index, heading: x.heading })),
    fullTextSplit: sections.length ? null : s.fullText.slice(0, 2000),
  });
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await prisma.paperSession.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json(errorEnvelope("NOT_FOUND", "Session not found"), { status: 404 });
  try {
    const raw = await chatComplete(
      [
        { role: "system", content: LAB_SPLIT_PROMPT },
        { role: "user", content: s.fullText },
      ],
      { maxTokens: 4000 }
    );
    const parsed = parseLooseJson(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed.sections;
    if (!Array.isArray(arr) || arr.length === 0) throw new Error("Model returned no sections");
    const sections = arr.slice(0, 12).map((x: any, i: number) => ({
      index: i,
      heading: String(x.heading ?? `Section ${i + 1}`).slice(0, 120),
      text: String(x.text ?? "").slice(0, 6000),
    }));
    await prisma.paperSession.update({ where: { id: params.id }, data: { sections: JSON.stringify(sections) } });
    return NextResponse.json({ sections: sections.map((x) => ({ index: x.index, heading: x.heading })) });
  } catch (e: any) {
    return NextResponse.json({ error: { message: e?.message ?? "Splitting failed" } }, { status: 502 });
  }
}