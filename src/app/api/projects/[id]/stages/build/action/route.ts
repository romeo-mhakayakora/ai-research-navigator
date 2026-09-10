import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertStageOpen, completeStage, GateError } from "@/lib/gating";
import { errorEnvelope } from "@/lib/utils";
import { streamChat, ChatMessage } from "@/lib/harness/provider/llm";
import { F5_SYSTEM_PROMPT, buildContextPrompt } from "@/lib/harness/agents/f5-implement";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const gate = await assertStageOpen(params.id, "F5").catch((e) => e);
  if (gate instanceof GateError)
    return NextResponse.json(errorEnvelope("STAGE_LOCKED", gate.message), { status: 403 });

  // Load context from F2, F3, and F4
  const f2State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const f2Data = f2State ? JSON.parse(f2State.data || "{}") : {};

  const f4Report = await prisma.artifact.findFirst({
    where: { projectId: params.id, stage: "F4", kind: "VALIDATION_REPORT" },
  });
  const methodology = f4Report ? JSON.parse(f4Report.content)?.finalizedMethodology ?? "" : "";

  const f3State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F3" } },
  });
  const f3Data = f3State ? JSON.parse(f3State.data || "{}") : {};
  const literatureSummary = (f3Data.solutions ?? [])
    .map((s: any) => `${s.name}: ${s.description}`)
    .join("\n");

  const f5State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F5" } },
  });
  const f5Data = f5State ? JSON.parse(f5State.data || "{}") : {};
  const chatHistory: ChatMessage[] = (f5Data.chat ?? []) as ChatMessage[];

  if (action === "chat") {
    const message = body.message as string;
    if (!message || message.trim().length < 2) {
      return new Response(
        "data: " + JSON.stringify({ error: "Message too short" }) + "\n\n",
        {
          status: 400,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    }

    const contextPrompt = buildContextPrompt({
      methodology,
      topicTitle: f2Data.topic?.title ?? "",
      researchQuestions: f2Data.topic?.researchQuestions ?? [],
      gaps: f2Data.gaps ?? [],
      userLevel: f2Data.userLevel ?? "",
      userResources: f2Data.userResources ?? "",
      literatureSummary,
    });

    const messages = [
      { role: "system" as const, content: contextPrompt },
      { role: "system" as const, content: F5_SYSTEM_PROMPT },
      ...chatHistory.slice(-8),
      { role: "user" as const, content: message },
    ];

    chatHistory.push({ role: "user", content: message });

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        let assistantText = "";
        try {
          for await (const chunk of streamChat(messages, { maxTokens: 512 })) {
            assistantText += chunk;
            controller.enqueue(enc.encode("data: " + JSON.stringify({ token: chunk }) + "\n\n"));
          }
          chatHistory.push({ role: "assistant", content: assistantText });
          await prisma.stageState.upsert({
            where: { projectId_stage: { projectId: params.id, stage: "F5" } },
            update: { data: JSON.stringify({ ...f5Data, chat: chatHistory }) },
            create: {
              projectId: params.id,
              stage: "F5",
              status: "ACTIVE",
              data: JSON.stringify({ chat: chatHistory }),
            },
          });
          controller.enqueue(enc.encode("data: " + JSON.stringify({ done: true }) + "\n\n"));
        } catch (e: any) {
          controller.enqueue(enc.encode("data: " + JSON.stringify({ error: e?.message ?? "Chat failed" }) + "\n\n"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  if (action === "logExperiment") {
    const { name, hypothesis, result, learning } = body;
    if (!name || !hypothesis) {
      return NextResponse.json({ error: { message: "Name and hypothesis required" } }, { status: 400 });
    }
    const exp = await prisma.experimentLog.create({
      data: {
        projectId: params.id,
        name,
        hypothesis,
        result: result ?? "",
        learning: learning ?? "",
      },
    });
    return NextResponse.json({
      ok: true,
      experiment: { id: exp.id, name: exp.name, hypothesis: exp.hypothesis, result: exp.result, learning: exp.learning },
    });
  }

  if (action === "updateExperiment") {
    const { id, result, learning } = body;
    if (!id) return NextResponse.json({ error: { message: "id required" } }, { status: 400 });
    await prisma.experimentLog.update({
      where: { id },
      data: { result: result ?? "", learning: learning ?? "" },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "deleteExperiment") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: { message: "id required" } }, { status: 400 });
    await prisma.experimentLog.delete({ where: { id } }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (action === "complete") {
    await completeStage(params.id, "F5");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: { message: "Unknown action" } }, { status: 400 });
}
