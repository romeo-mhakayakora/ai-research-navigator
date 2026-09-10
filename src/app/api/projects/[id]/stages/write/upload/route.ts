import { NextRequest, NextResponse } from "next/server";
import { assertStageOpen, GateError } from "@/lib/gating";
import { errorEnvelope } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await assertStageOpen(params.id, "F6").catch((e) => e);
  if (gate instanceof GateError)
    return NextResponse.json(errorEnvelope("STAGE_LOCKED", gate.message), { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = (form.get("kind") as string) ?? "";
    if (!file) {
      return NextResponse.json({ error: { message: "No file provided" } }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) {
      return NextResponse.json({ error: { message: "File too large (max 15MB)" } }, { status: 400 });
    }

    let text = "";
    if (kind === "pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const mod = (await import("pdf-parse")) as any;
      const PDFParse = mod.PDFParse ?? mod.default?.PDFParse ?? mod.default;
      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      await parser.destroy();
      text = String(result?.text ?? "").replace(/\s+/g, " ").trim();
      // Guard: pdf v2 throws PasswordException for encrypted PDFs
    } else if (file.name.toLowerCase().endsWith(".docx")) {
      const mammoth = (await import("mammoth")) as any;
      const parsed = await mammoth.extractRawText({ buffer: buf });
      text = (parsed?.value ?? "").replace(/\s+/g, " ").trim();
    } else {
      text = buf.toString("utf-8").replace(/\s+/g, " ").trim();
    }

    return NextResponse.json({ text, chars: text.length });
  } catch (e: any) {
    return NextResponse.json({ error: { message: e?.message ?? "Upload parse failed" } }, { status: 502 });
  }
}
