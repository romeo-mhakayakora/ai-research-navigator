import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertStageOpen, GateError } from "@/lib/gating";
import { errorEnvelope } from "@/lib/utils";
import { streamChat, type ChatMessage } from "@/lib/harness/provider/llm";

const MAX_CHAT_MESSAGES = 10;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const message = body.message as string;

  const gate = await assertStageOpen(params.id, "F4").catch((e) => e);
  if (gate instanceof GateError)
    return NextResponse.json(errorEnvelope("STAGE_LOCKED", gate.message), { status: 403 });

  if (!message || message.trim().length < 2) {
    return new Response("data: " + JSON.stringify({ error: "Message too short" }) + "\n\n", {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // Load context
  const f2State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const f2Data = f2State ? JSON.parse(f2State.data || "{}") : {};
  const topic = f2Data.topic ?? { title: "", researchQuestions: [] };

  const f4State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F4" } },
  });
  const f4Data = f4State ? JSON.parse(f4State.data || "{}") : {};
  const iterations = f4Data.iterations ?? [];
  const chatHistory: ChatMessage[] = f4Data.chat ?? [];

  // Limit chat history
  if (chatHistory.length >= MAX_CHAT_MESSAGES) {
    return new Response("data: " + JSON.stringify({ error: "Chat limit reached — finalize your methodology or start a new iteration." }) + "\n\n", {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // Build context for the chat
  const lastAttack = iterations[iterations.length - 1];
  const contextPrompt = `You are a research methodology advisor. The user is discussing their research idea with you. Be concise and focused — help them refine their methodology, not chat endlessly.

Research topic: ${topic.title ?? "(none)"}
Research questions: ${(topic.researchQuestions ?? []).join("; ")}

${lastAttack ? `Last attack feedback: ${JSON.stringify(lastAttack.attack)}` : "No attack yet — encourage them to propose a methodology first."}

Keep responses under 150 words. Ask clarifying questions. Suggest concrete improvements. Do not repeat the attack — this is a discussion.`;

  const messages = [
    { role: "system" as const, content: contextPrompt },
    ...chatHistory.slice(-6), // Last 6 messages for context
    { role: "user" as const, content: message },
  ];

  // Save user message
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
        // Save assistant message
        chatHistory.push({ role: "assistant", content: assistantText });
        await prisma.stageState.upsert({
          where: { projectId_stage: { projectId: params.id, stage: "F4" } },
          update: { data: JSON.stringify({ ...f4Data, chat: chatHistory }) },
          create: {
            projectId: params.id,
            stage: "F4",
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
