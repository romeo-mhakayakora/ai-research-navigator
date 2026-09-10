"use client";
import { useEffect, useState } from "react";
import { WorkspaceShell, ThreadHeader } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Question = { id: string; type: "text" | "multi"; question: string; options?: string[] };

type Gap = {
  concept: string;
  whyItMatters: string;
  currentUnderstanding: string;
  searchQuery: string;
};
type GapReport = {
  knownAreas: string[];
  gaps: Gap[];
  papers: Array<{
    title: string; authors: string[]; year: number; url: string; extId: string;
    abstract: string; reason: string;
  }>;
};

type ThreadMsg = { role: "user" | "assistant"; content: string };

function Thread({ messages, emptyHint }: { messages: ThreadMsg[]; emptyHint: string }) {
  if (!messages || messages.length === 0)
    return <p className="text-xs text-neutral-400">{emptyHint}</p>;
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto">
      {messages.map((m, i) => (
        <div key={i} className={`rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-neutral-100 dark:bg-neutral-800" : "mr-8 bg-emerald-50 dark:bg-emerald-950/30"}`}>
          {m.content}
        </div>
      ))}
    </div>
  );
}

export default function GapsPage({ params }: { params: { id: string } }) {
  const [state, setState] = useState<{
    stages: Array<{ stage: string; status: string }>;
    project: { domain: string; title: string };
  } | null>(null);
  const [topic, setTopic] = useState<{ title?: string; problem?: string } | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GapReport | null>(null);
  const [messages, setMessages] = useState<ThreadMsg[]>([]);

  async function load() {
    const res = await fetch(`/api/projects/${params.id}/state`);
    if (res.ok) setState(await res.json());
    const d = await fetch(`/api/projects/${params.id}/stages/gaps/data`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d) {
      setMessages((d.messages ?? []) as ThreadMsg[]);
      setTopic(d.topic ?? null);
      setQuestions(d.questions ?? null);
      setReport(d.report ?? null);
      if (d.answers) setAnswers(Object.fromEntries(d.answers.map((a: { id: string; values: string[] }) => [a.id, a.values])));
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [params.id]);

  async function generateQuestions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${params.id}/stages/gaps/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "questions" }),
      });
      if (res.ok) setQuestions((await res.json()).questions);
      else {
        const e = await res.json().catch(() => null);
        setError(e?.error?.message ?? "Could not generate the questionnaire - try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const answeredCount = questions ? questions.filter((q) => (answers[q.id] ?? []).length > 0).length : 0;
  const current = questions?.[step];
  const currentAnswered = current ? (answers[current.id] ?? []).length > 0 : false;

  function setValue(id: string, values: string[]) {
    setAnswers((a) => ({ ...a, [id]: values }));
  }

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${params.id}/stages/gaps/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze",
          answers: questions!.map((q) => ({ id: q.id, values: answers[q.id] ?? [] })),
        }),
      });
      if (res.ok) {
        setReport((await res.json()).report);
      } else {
        const e = await res.json().catch(() => null);
        setError(e?.error?.message ?? "Analysis failed - try again.");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function complete() {
    const res = await fetch(`/api/projects/${params.id}/stages/gaps/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    if (res.ok) {
      load();
      window.location.href = `/project/${params.id}/literature`;
    }
  }

  if (!state || loading) return <main className="p-8">Loading…</main>;
  const myStatus = state.stages.find((s) => s.stage === "F2")?.status;
  return (
    <WorkspaceShell projectId={params.id} projectTitle={state.project.title} stages={state.stages} active="gaps">
      <ThreadHeader title="Interview — Knowledge Gaps" subtitle={`Stage 2 of 7 · ${topic?.title ?? state.project.domain}`} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-8">
        <div className="mx-auto w-full max-w-3xl">
          {error && (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
              ⚠️ {error}
            </p>
          )}

          {messages.length > 0 && (
            <div className="mb-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
              <h3 className="font-semibold">💬 Interview conversation</h3>
              <div className="mt-3"><Thread messages={messages} emptyHint="" /></div>
            </div>
          )}

          {!questions && !report && (
            <div className="rounded-2xl border border-neutral-200 p-8 text-center dark:border-neutral-700">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">✦</div>
              <h2 className="mt-4 text-xl font-semibold">Structured knowledge interview</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
                No drifting chat here. I'll build you a structured questionnaire (at most 20 questions) about exactly what you know and what you'll need for{" "}
                <strong>{topic?.title ?? "your topic"}</strong>. Descriptive questions get a text box; skills questions get checkboxes.
              </p>
              <Button className="mt-6 rounded-xl px-8" onClick={generateQuestions} disabled={loading}>
                {loading ? "Building your questionnaire…" : "Generate my questionnaire →"}
              </Button>
            </div>
          )}

          {questions && !report && current && (
            <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-700">
              <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
                <span>Question {step + 1} of {questions.length}</span>
                <span>{answeredCount}/{questions.length} answered</span>
              </div>
              <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
              </div>
              <h3 className="text-lg font-medium leading-7">{current.question}</h3>
              {current.type === "text" ? (
                <Textarea
                  className="mt-4 min-h-32 rounded-xl"
                  placeholder="Type your answer… (be specific — this directly shapes your gap report)"
                  value={(answers[current.id] ?? [""])[0] ?? ""}
                  onChange={(e) => setValue(current.id, e.target.value ? [e.target.value] : [])}
                />
              ) : (
                <div className="mt-4 space-y-2">
                  {(current.options ?? []).map((opt) => {
                    const selected = (answers[current.id] ?? []).includes(opt);
                    return (
                      <label
                        key={opt}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${
                          selected
                            ? "border-emerald-500 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
                            : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-600"
                          checked={selected}
                          onChange={() => {
                            const cur = answers[current.id] ?? [];
                            setValue(current.id, selected ? cur.filter((v) => v !== opt) : [...cur, opt]);
                          }}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="mt-6 flex items-center justify-between">
                <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  ← Back
                </Button>
                {step < questions.length - 1 ? (
                  <Button className="rounded-xl" disabled={!currentAnswered} onClick={() => setStep((s) => s + 1)}>
                    Next →
                  </Button>
                ) : (
                  <Button className="rounded-xl" disabled={answeredCount < 4 || analyzing} onClick={analyze}>
                    {analyzing ? "Analyzing your gaps…" : `🔍 Analyze my gaps (${answeredCount}/${questions.length} answered)`}
                  </Button>
                )}
              </div>
              {step === questions.length - 1 && answeredCount < 4 && (
                <p className="mt-3 text-center text-xs text-neutral-500">Answer at least 4 questions to run the analysis.</p>
              )}
            </div>
          )}

          {report && (
            <div className="space-y-4">
              {(report.knownAreas ?? []).length > 0 && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <h3 className="font-semibold">✅ What you already know</h3>
                  <ul className="mt-2 list-disc pl-5 text-sm leading-6">{(report.knownAreas ?? []).map((k, i) => <li key={i}>{k}</li>)}</ul>
                </div>
              )}
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/40">
                <h3 className="font-semibold">📚 Concepts to learn (foundational first)</h3>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6">
                  {(report.gaps ?? []).map((g, i) => (
                    <li key={i}>
                      <strong>{g.concept}</strong> — {g.whyItMatters}
                      {g.currentUnderstanding && <span className="block text-xs text-neutral-500">Your level: {g.currentUnderstanding}</span>}
                    </li>
                  ))}
                </ol>
              </div>
              {(report.papers ?? []).length > 0 && (
                <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-700">
                  <h3 className="font-semibold">🔗 Papers to cover these gaps (live arXiv results)</h3>
                  <ul className="mt-3 space-y-3">
                    {(report.papers ?? []).map((paper) => (
                      <li key={paper.extId} className="rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-700">
                        <a href={paper.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">{paper.title}</a>
                        <span className="mt-1 block text-xs text-neutral-500">
                          {(paper.authors ?? []).slice(0, 3).join(", ")}{(paper.authors ?? []).length > 3 ? " et al." : ""} · {paper.year} · for: {paper.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button className="w-full rounded-xl" onClick={complete} disabled={myStatus === "COMPLETE"}>
                Finish Stage 2 → Continue to Literature
              </Button>
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}

