"use client";
import { useEffect, useRef, useState } from "react";
import { WorkspaceShell, ThreadHeader } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Experiment = { id: string; name: string; hypothesis: string; result: string; learning: string; createdAt: string };

export default function BuildPage({ params }: { params: { id: string } }) {
  const [state, setState] = useState<{
    stages: Array<{ stage: string; status: string }>;
    project: { domain: string; title: string };
  } | null>(null);
  const [data, setData] = useState<{
    methodology: string;
    topic: { title?: string };
    gaps: string[];
    userLevel: string;
    userResources: string;
    chat: ChatMessage[];
    experiments: Experiment[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showExpForm, setShowExpForm] = useState(false);
  const [expName, setExpName] = useState("");
  const [expHypothesis, setExpHypothesis] = useState("");
  const [expResult, setExpResult] = useState("");
  const [expLearning, setExpLearning] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch(`/api/projects/${params.id}/state`);
    if (res.ok) setState(await res.json());
    const d = await fetch(`/api/projects/${params.id}/stages/build/data`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (d) setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, [params.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.chat, chatBusy]);

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    setChatInput("");
    setChatBusy(true);
    setChatError(null);
    try {
      const res = await fetch(`/api/projects/${params.id}/stages/build/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", message: text }),
      });
      if (!res.ok || !res.body) {
        setChatError("Chat unavailable — try again.");
        setChatBusy(false);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let current = "";
      setData((d) => ({ ...d!, chat: [...(d?.chat ?? []), { role: "user", content: text }, { role: "assistant", content: "" }] }));
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
            if (payload.error) setChatError(payload.error);
            if (payload.token) {
              current += payload.token;
              setData((d) => ({ ...d!, chat: [...(d?.chat ?? []).slice(0, -1), { role: "assistant", content: current }] }));
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setChatError("Chat failed — try again.");
    } finally {
      setChatBusy(false);
    }
  }

  async function logExperiment() {
    if (!expName || !expHypothesis) return;
    const res = await fetch(`/api/projects/${params.id}/stages/build/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logExperiment", name: expName, hypothesis: expHypothesis, result: expResult, learning: expLearning }),
    });
    if (res.ok) {
      setExpName("");
      setExpHypothesis("");
      setExpResult("");
      setExpLearning("");
      setShowExpForm(false);
      load();
    }
  }

  async function complete() {
    await fetch(`/api/projects/${params.id}/stages/build/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    window.location.href = `/project/${params.id}/write`;
  }

  if (!state || loading) return <main className="p-8">Loading…</main>;
  const myStatus = state.stages.find((s) => s.stage === "F5")?.status;
  const isComplete = myStatus === "COMPLETE";

  return (
    <WorkspaceShell projectId={params.id} projectTitle={state.project.title} stages={state.stages} active="build">
      <ThreadHeader title="Implementation and Experiment" subtitle={`Stage 5 of 7 · ${state.project.domain}`} />
      <div className="mx-auto w-full max-w-4xl space-y-6 px-6 pb-10">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-800/40">
          <h3 className="font-semibold">📄 Validated Methodology</h3>
          <p className="mt-1 text-sm leading-6">{data?.methodology || "(none)"}</p>
          {data?.gaps && data.gaps.length > 0 && (
            <div className="mt-3 text-sm">
              <strong>Gaps to address:</strong>
              <ul className="list-disc pl-5">{data.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
          <h3 className="font-semibold">💬 Discuss implementation</h3>
          {!isComplete ? (
            <p className="mt-1 text-xs text-neutral-500">Debug, brainstorm, design experiments — your advisor won't do the work for you.</p>
          ) : (
            <p className="mt-1 text-xs text-neutral-500">Coaching conversation from this stage (read-only).</p>
          )}
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {(data?.chat?.length ?? 0) === 0 && (
                <p className="text-xs text-neutral-400">Stuck? Describe what you're working on, what's blocking you, or what you've tried…</p>
              )}
              {data?.chat?.map((m, i) => (
                <div key={i} className={`rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-neutral-100 dark:bg-neutral-800" : "mr-8 bg-emerald-50 dark:bg-emerald-950/30"}`}>
                  {m.content}
                </div>
              ))}
              {chatBusy && <div className="mr-8 rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30">…</div>}
              <div ref={bottomRef} />
            </div>
            {chatError && <p className="mt-2 text-xs text-red-600">{chatError}</p>}
            {!isComplete && (
              <div className="mt-3 flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  placeholder="Describe what you're working on, what's stuck, or what you need help with…"
                  rows={2}
                  className="flex-1"
                />
                <Button onClick={sendChat} disabled={chatBusy || chatInput.trim().length < 2} className="self-end rounded-xl">
                  {chatBusy ? "…" : "↑"}
                </Button>
              </div>
            )}
          </div>

        {/* Experiments */}
        <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">🧪 Experiments</h3>
            {!isComplete && (
              <Button onClick={() => setShowExpForm(!showExpForm)} variant="outline" className="rounded-xl">
                {showExpForm ? "Cancel" : "+ Log experiment"}
              </Button>
            )}
          </div>

          {showExpForm && (
            <div className="mt-3 space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
              <input value={expName} onChange={(e) => setExpName(e.target.value)} placeholder="Experiment name" className="h-9 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-sm dark:border-neutral-600" />
              <Textarea value={expHypothesis} onChange={(e) => setExpHypothesis(e.target.value)} placeholder="Hypothesis" rows={2} />
              <Textarea value={expResult} onChange={(e) => setExpResult(e.target.value)} placeholder="Result (fill in after running)" rows={2} />
              <Textarea value={expLearning} onChange={(e) => setExpLearning(e.target.value)} placeholder="What you learned" rows={2} />
              <Button onClick={logExperiment} disabled={!expName || !expHypothesis} className="rounded-xl">Save experiment</Button>
            </div>
          )}

          {data?.experiments && data.experiments.length > 0 ? (
            <div className="mt-3 space-y-3">
              {data.experiments.map((exp) => (
                <div key={exp.id} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                  <div className="font-medium text-sm">{exp.name}</div>
                  <div className="mt-1 text-xs text-neutral-500"><strong>Hypothesis:</strong> {exp.hypothesis}</div>
                  {exp.result && <div className="mt-1 text-xs text-neutral-500"><strong>Result:</strong> {exp.result}</div>}
                  {exp.learning && <div className="mt-1 text-xs text-neutral-500"><strong>Learning:</strong> {exp.learning}</div>}
                </div>
              ))}
            </div>
          ) : (
            !showExpForm && <p className="mt-3 text-xs text-neutral-400">No experiments logged yet.</p>
          )}
        </div>

        {/* Complete */}
        {!isComplete && (
          <Button onClick={complete} className="w-full rounded-xl">
            Finish Stage 5 → Continue to Write Paper
          </Button>
        )}
        {isComplete && (
          <p className="text-center text-sm text-emerald-600">
            ✅ Implementation complete — <a href={`/project/${params.id}/write`} className="underline">Continue to Write Paper</a>
          </p>
        )}
      </div>
    </WorkspaceShell>
  );
}

