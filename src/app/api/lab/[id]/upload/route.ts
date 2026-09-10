import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorEnvelope } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await prisma.paperSession.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json(errorEnvelope("NOT_FOUND", "Session not found"), { status: 404 });
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: { message: "No file provided" } }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return NextResponse.json({ error: { message: "File too large (max 15MB)" } }, { status: 400 });

    let text = "";
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      const mod = (await import("pdf-parse")) as any;
      const PDFParse = mod.PDFParse ?? mod.default?.PDFParse ?? mod.default;
      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      await parser.destroy();
      text = String(result?.text ?? "").replace(/\s+/g, " ").trim();
    } else if (lower.endsWith(".docx")) {
      const mammoth = (await import("mammoth")) as any;
      const parsed = await mammoth.extractRawText({ buffer: buf });
      text = (parsed?.value ?? "").replace(/\s+/g, " ").trim();
    } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      text = buf.toString("utf-8").replace(/\s+/g, " ").trim();
    } else {
      return NextResponse.json({ error: { message: "Supported: .pdf, .docx, .txt, .md" } }, { status: 400 });
    }
    if (text.length < 40) return NextResponse.json({ error: { message: "Could not extract enough text from that file." } }, { status: 400 });

    // Replace/augment the session text with the uploaded full text.
    await prisma.paperSession.update({
      where: { id: params.id },
      data: { fullText: text.slice(0, 16000), sections: "[]", meta: JSON.stringify({ ...JSON.parse(s.meta || "{}"), source: "pdf" }) },
    });
    return NextResponse.json({ ok: true, chars: text.length });
  } catch (e: any) {
    return NextResponse.json({ error: { message: e?.message ?? "Upload parse failed" } }, { status: 502 });
  }
}