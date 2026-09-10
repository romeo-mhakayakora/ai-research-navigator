import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ChatBodySchema, stageIdFromKey } from "@/lib/validation";
import { assertStageOpen, GateError } from "@/lib/gating";
import { streamChat } from "@/lib/harness/provider/llm";
import { F2_SYSTEM_PROMPT } from "@/lib/harness/agents/f2-gaps";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = ChatBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(`event: error\ndata: ${JSON.stringify({ code: "VALIDATION_ERROR" })}\n\n`, {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  try {
    await assertStageOpen(params.id, stageIdFromKey("gaps"));
  } catch (e) {
    if (e instanceof GateError)
      return new Response(`event: error\ndata: ${JSON.stringify({ code: "STAGE_LOCKED" })}\n\n`, {
        status: 403,
        headers: { "Content-Type": "text/event-stream" },
      });
    throw e;
  }
  const stageState = await prisma.stageState.findUniqueOrThrow({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const stateData = JSON.parse(stageState.data) as {
    topic?: { title?: string; problem?: string };
  };
  const topicTitle = stateData.topic?.title ?? "your locked topic";
  const topicProblem = stateData.topic?.problem ?? "";

  const history = await prisma.message.findMany({
    where: { projectId: params.id, stage: "F2" },
    orderBy: { createdAt: "asc" },
    take: 24,
  });
  await prisma.message.create({
    data: { projectId: params.id, stage: "F2", role: "USER", content: parsed.data.message },
  });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: string) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${data}\n\n`));
      try {
        const messages = [
          {
            role: "system" as const,
            content: `${F2_SYSTEM_PROMPT}\n\nLocked topic: ${topicTitle}${topicProblem ? `\nTopic problem: ${topicProblem}` : ""}`,
          },
          ...history.map((m) => ({ role: m.role.toLowerCase() as "user" | "assistant", content: m.content })),
          { role: "user" as const, content: parsed.data.message },
        ];
        let full = "";
        for await (const token of streamChat(messages, { maxTokens: 1024 })) {
          full += token;
          send("token", JSON.stringify({ token }));
        }
        await prisma.message.create({
          data: { projectId: params.id, stage: "F2", role: "ASSISTANT", content: full },
        });
        send("done", JSON.stringify({}));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "PROVIDER_ERROR";
        send("error", JSON.stringify({ code: "PROVIDER_ERROR", message: msg }));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}