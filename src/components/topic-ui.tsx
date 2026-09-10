"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CandidateTopic } from "@/lib/validation";

export type ThreadMessage = { role: "user" | "assistant"; content: string };

function Avatar({ role }: { role: string }) {
  if (role === "user")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-neutral-300 ring-1 ring-white/10"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" /></svg></span>
    );
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>
    </span>
  );
}

/** ChatGPT-style thread: centered column, avatar rows, composer pill at bottom. */
export function ChatThread({
  projectId,
  stage,
  welcome,
  placeholder,
  belowThread,
  onSent,
  initialMessages,
  readOnly,
}: {
  projectId: string;
  stage: string;
  welcome: string;
  placeholder?: string;
  belowThread?: React.ReactNode;
  onSent?: () => void;
  initialMessages?: ThreadMessage[];
  readOnly?: boolean;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(
    initialMessages && initialMessages.length > 0
      ? initialMessages
      : [{ role: "assistant", content: welcome }]
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    onSent?.();
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/stages/${stage}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        const msg =
          res.status === 403
            ? "This stage is locked — finish the previous stage first."
            : "The assistant is unavailable right now (connection failed). Please try again.";
        setMessages((m) => [...m, { role: "assistant", content: msg }]);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let current = "";
      let gotToken = false;
      let streamError: string | null = null;
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const eventLine = part.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          let payload: { token?: string; code?: string; message?: string };
          try {
            payload = JSON.parse(dataLine.slice(5).trim());
          } catch {
            continue;
          }
          if (eventLine?.includes("event: token") && typeof payload.token === "string") {
            gotToken = true;
            current += payload.token;
            const snapshot = current;
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { role: "assistant", content: snapshot };
              return copy;
            });
          } else if (eventLine?.includes("event: error")) {
            streamError = payload.message ?? payload.code ?? "PROVIDER_ERROR";
          }
        }
      }
      if (streamError && !gotToken) {
        const msg =
          streamError === "STAGE_LOCKED"
            ? "This stage is locked — finish the previous stage first."
            : `The assistant hit a problem (${streamError}). Please try again — your message is saved.`;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: msg };
          return copy;
        });
      } else if (streamError && gotToken) {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: current + `\n\n(stream ended early: ${streamError})`,
          };
          return copy;
        });
      } else if (!gotToken) {
        // Stream closed with no tokens and no error event — never leave an empty bubble.
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: "I didn't get a reply back. Please try again — your message is saved.",
          };
          return copy;
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
          {messages.map((m, i) => (
            <div key={i} className="flex gap-4">
              <Avatar role={m.role} />
              <div className="min-w-0 flex-1 pt-1">
                <div className="text-[13px] font-semibold text-neutral-500">
                  {m.role === "user" ? "You" : "Euler"}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-[15px] leading-7">
                  {m.content}
                  {busy && i === messages.length - 1 && m.role === "assistant" && (
                    <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-neutral-400 align-middle" />
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
          {belowThread}
        </div>
      </div>
      {!readOnly && (
        <div className="border-t border-white/5 bg-neutral-950/80 px-6 pb-5 pt-3 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-sm focus-within:border-indigo-500/60">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={placeholder ?? "Message Euler…"}
                className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-neutral-400"
              />
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center btn-gradient rounded-xl transition-opacity disabled:opacity-30 disabled:shadow-none"
              >
                {busy ? "…" : "↑"}
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-neutral-400">
              The assistant guides your research step by step — it never invents papers or statistics.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function IntakeCard({ onSubmit }: { onSubmit: (v: { background: string; level: string }) => void }) {
  const [background, setBackground] = useState("");
  const [level, setLevel] = useState("MASTERS");
  return (
    <div className="mx-auto mt-10 w-full max-w-2xl glass-card p-6">
      <h2 className="text-lg font-semibold">Tell the assistant about yourself</h2>
      <p className="mt-1 text-sm text-neutral-500">
        This starts the interview — the assistant will ask clarifying questions, then propose topics.
      </p>
      <div className="mt-4 space-y-3">
        <Textarea
          placeholder="Your background: coursework, tools, prior projects"
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          rows={3}
        />
        <select
          className="h-10 w-full rounded-xl border border-neutral-300 bg-transparent px-3 text-sm dark:border-neutral-600"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          aria-label="Your level"
        >
          {["BTECH", "MASTERS", "PHD", "LECTURER", "RD"].map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <Button className="w-full rounded-xl" onClick={() => onSubmit({ background, level })}>
          Start interview →
        </Button>
      </div>
    </div>
  );
}

export function CandidateCards({
  candidates,
  onLock,
}: {
  candidates: CandidateTopic[];
  onLock: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string>("");
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Candidate topics — pick one
      </h3>
      <div className="space-y-3">
        {candidates.map((c) => (
          <label
            key={c.id}
            className={`block cursor-pointer rounded-2xl border p-5 transition-colors ${
              selected === c.id
                ? "border-emerald-500 ring-1 ring-emerald-500"
                : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700"
            }`}
          >
            <input type="radio" name="candidate" className="sr-only" checked={selected === c.id} onChange={() => setSelected(c.id)} />
            <div className="font-semibold">{c.title}</div>
            <p className="mt-1 text-sm text-neutral-500">{c.scope}</p>
            <p className="mt-1 text-sm"><strong>Novelty:</strong> {c.novelty}</p>
            <p className="mt-1 text-sm"><strong>Fit:</strong> {c.fitNote}</p>
            {c.risks.length > 0 && <p className="mt-1 text-sm text-neutral-400">Risks: {c.risks.join("; ")}</p>}
          </label>
        ))}
        <Button className="w-full rounded-xl" disabled={!selected} onClick={() => selected && onLock(selected)}>
          Lock topic
        </Button>
      </div>
    </div>
  );
}
