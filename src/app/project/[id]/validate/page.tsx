"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceShell, ThreadHeader } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = { role: "user" | "assistant"; content: string };

function ChatPanel({ projectId, initialMessages = [], readOnly = false }: { projectId: string; initialMessages?: ChatMessage[]; readOnly?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/stages/validate/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        setError("Chat unavailable — try again.");
        setBusy(false);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let current = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(5).trim());
            if (payload.error) {
              setError(payload.error);
              if (payload.error.includes("limit reached")) {
                setBusy(false);
                return;
              }
            }
            if (payload.token) {
              current += payload.token;
              setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: current }]);
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      setError("Chat failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
      <h3 className="font-semibold">💬 Discuss your idea</h3>
      <p className="mt-1 text-xs text-neutral-500">{readOnly ? "Validation conversation (read-only)." : "Limited back-and-forth — use this to clarify feedback or refine your approach. Max 10 messages."}</p>
      <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-neutral-400">Ask about the attack feedback, discuss alternatives, or clarify suggestions…</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-neutral-100 dark:bg-neutral-800" : "mr-8 bg-emerald-50 dark:bg-emerald-950/30"}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="mr-8 rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30">…</div>}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {!readOnly && (
        <div className="mt-3 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask a question or discuss your idea…"
            rows={2}
            className="flex-1"
          />
          <Button onClick={send} disabled={busy || input.trim().length < 2} className="self-end rounded-xl">
            {busy ? "…" : "↑"}
          </Button>
        </div>
      )}
    </div>
  );
}

type AttackResult = {
  novelty: { score: string; closestPriorWork: string; differentiation: string };
  feasibility: { score: string; concerns: string[]; missing: string[] };
  logic: { gaps: string[]; unaddressedQuestions: string[] };
  scope: string;
  evaluation: string;
  redFlags: string[];
  verdict: string;
  suggestions: string[];
};

type Iteration = {
  methodology: string;
  attack: AttackResult;
  at: string;
};

export default function ValidatePage({ params }: { params: { id: string } }) {
  const [state, setState] = useState<{
    stages: Array<{ stage: string; status: string }>;
    project: { domain: string; title: string };
  } | null>(null);
  const [data, setData] = useState<{
    topic: { title?: string; researchQuestions?: string[] };
    gaps: string[];
    userLevel: string;
    userResources: string;
    iterations: Iteration[];
    report: any;
    messages?: ChatMessage[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [methodology, setMethodology] = useState("");
  const [attacking, setAttacking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/projects/${params.id}/state`);
    if (res.ok) setState(await res.json());
    const d = await fetch(`/api/projects/${params.id}/stages/validate/data`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (d) setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, [params.id]);

  async function attack() {
    if (methodology.trim().length < 10 || attacking) return;
    setAttacking(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${params.id}/stages/validate/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attack", methodology }),
      });
      if (res.ok) {
        const j = await res.json();
        setData((d) => ({ ...d!, iterations: [...(d?.iterations ?? []), { methodology, attack: j.attack, at: new Date().toISOString() }] }));
      } else {
        const e = await res.json().catch(() => null);
        setError(e?.error?.message ?? "Attack failed — try again.");
      }
    } finally {
      setAttacking(false);
    }
  }

  async function finalize() {
    if (!methodology || methodology.trim().length < 10) return;
    const res = await fetch(`/api/projects/${params.id}/stages/validate/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finalize", methodology }),
    });
    if (res.ok) {
      window.location.href = `/project/${params.id}/build`;
    } else {
      const e = await res.json().catch(() => null);
      setError(e?.error?.message ?? "Could not finalize.");
    }
  }

  if (!state || loading) return <main className="p-8">Loading…</main>;
  const myStatus = state.stages.find((s) => s.stage === "F4")?.status;
  const isComplete = myStatus === "COMPLETE";

  return (
    <WorkspaceShell projectId={params.id} projectTitle={state.project.title} stages={state.stages} active="validate">
      <ThreadHeader title="Idea Validation" subtitle={`Stage 4 of 7 · ${state.project.domain}`} />
      <div className="mx-auto w-full max-w-4xl space-y-6 px-6 pb-10">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-800/40">
          <h3 className="font-semibold">📄 Locked Topic</h3>
          <p className="mt-1 text-sm font-medium">{data?.topic?.title ?? "(none)"}</p>
          {data?.topic?.researchQuestions?.length && (
            <div className="mt-2 text-sm">
              <strong>Research questions:</strong>
              <ul className="list-disc pl-5">
                {data.topic.researchQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
          {data?.gaps && data.gaps.length > 0 && (
            <div className="mt-3 text-sm">
              <strong>Gaps to address:</strong>
              <ul className="list-disc pl-5">{data.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          )}
          <div className="mt-3 text-sm text-neutral-500">
            Your level: {data?.userLevel ?? "—"} · Resources: {data?.userResources ?? "—"}
          </div>
        </div>

        {!isComplete && (
          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
            <h3 className="font-semibold">💡 Propose your methodology</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Describe your proposed approach — the agent will attack it, find weaknesses, and help you refine it.
            </p>
            <Textarea
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              placeholder="Describe your proposed methodology: what you will build, how you will test it, what data you will use, how you will evaluate success…"
              rows={6}
              className="mt-3"
            />
            <div className="mt-3 flex gap-2">
              <Button onClick={attack} disabled={attacking || methodology.trim().length < 10} className="rounded-xl">
                {attacking ? "Attacking…" : "⚔️ Attack my idea"}
              </Button>
              <Button onClick={finalize} variant="outline" disabled={methodology.trim().length < 10} className="rounded-xl">
                ✅ Finalize & continue
              </Button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {data?.iterations && data.iterations.length > 0 && (
          <div className="space-y-5">
            <h3 className="font-semibold">⚔️ Attack iterations</h3>
            {data.iterations.map((iter, i) => (
              <div key={i} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
                <div className="text-xs text-neutral-400">Iteration {i + 1}</div>
                <p className="mt-1 text-sm font-medium italic">"{(iter.methodology ?? "").slice(0, 200)}{(iter.methodology ?? "").length > 200 ? "…" : ""}"</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                    <div className="text-xs font-semibold uppercase text-neutral-400">Novelty</div>
                    <div className="mt-1 text-sm font-medium">{iter.attack?.novelty?.score ?? "—"}</div>
                    <p className="mt-1 text-xs text-neutral-500">{iter.attack?.novelty?.differentiation ?? ""}</p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                    <div className="text-xs font-semibold uppercase text-neutral-400">Feasibility</div>
                    <div className="mt-1 text-sm font-medium">{iter.attack?.feasibility?.score ?? "—"}</div>
                    <p className="mt-1 text-xs text-neutral-500">{iter.attack?.feasibility?.concerns?.[0] ?? ""}</p>
                  </div>
                </div>
                {((iter.attack?.redFlags ?? []) as string[]).length > 0 && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/40">
                    <div className="text-xs font-semibold text-red-700">🚩 Red flags</div>
                    <ul className="mt-1 list-disc pl-5 text-xs text-red-700">
                      {((iter.attack?.redFlags ?? []) as string[]).map((f: string, j: number) => <li key={j}>{f}</li>)}
                    </ul>
                  </div>
                )}
                {((iter.attack?.suggestions ?? []) as string[]).length > 0 && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
                    <div className="text-xs font-semibold text-emerald-700">💡 Suggestions</div>
                    <ul className="mt-1 list-disc pl-5 text-xs text-emerald-700">
                      {((iter.attack?.suggestions ?? []) as string[]).map((s: string, j: number) => <li key={j}>{s}</li>)}
                    </ul>
                  </div>
                )}
                <div className="mt-2 text-xs font-medium">
                  Verdict: <span className={
                    iter.attack?.verdict === "proceed" ? "text-emerald-600" :
                    iter.attack?.verdict === "refine" ? "text-amber-600" : "text-red-600"
                  }>{iter.attack?.verdict ?? "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Limited chat — supplement to attack flow */}
        {(data?.messages?.length ?? 0) > 0 && (
          <ChatPanel projectId={params.id} initialMessages={data!.messages!} readOnly={isComplete} />
        )}
        {data?.iterations && data.iterations.length > 0 && !isComplete && (data?.messages?.length ?? 0) === 0 && (
          <ChatPanel projectId={params.id} />
        )}

        {data?.report && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/40">
            <h3 className="font-semibold">✅ Validated Methodology</h3>
            <p className="mt-2 text-sm leading-6">{data.report.finalizedMethodology ?? data.report.methodology ?? "Methodology validated — see iterations above."}</p>
            {data.report.completedAt ? (
              <p className="mt-2 text-xs text-neutral-500">Completed {new Date(data.report.completedAt).toLocaleString()}</p>
            ) : null}
            <Button className="mt-4 w-full rounded-xl" onClick={() => window.location.href = `/project/${params.id}/build`}>
              Continue to Build →
            </Button>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

