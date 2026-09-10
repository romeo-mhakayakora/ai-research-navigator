"use client";
import { useEffect, useState } from "react";
import { LabShell, LabSessionMeta, LabHeader } from "@/components/lab-shell";
import { Button } from "@/components/ui/button";

type Sec = { index: number; heading: string };
type Question = { type: "mcq" | "multi" | "short"; question: string; options?: string[]; answer: any; explanation: string };

export default function LabSessionPage({ params }: { params: { id: string } }) {
  const [sessions, setSessions] = useState<LabSessionMeta[]>([]);
  const [secs, setSecs] = useState<Sec[]>([]);
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState<any>({});
  const [splitDone, setSplitDone] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [mode, setMode] = useState<"read" | "quiz" | "results">("read");
  const [busy, setBusy] = useState(false);
  const [simplified, setSimplified] = useState<Record<string, string>>({});
  const [simplifying, setSimplifying] = useState<string | null>(null);
  const [scopeSel, setScopeSel] = useState<number[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qScope, setQScope] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ score: number; maxScore: number; results: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSessions() {
    const d = await fetch("/api/lab").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d) setSessions(d.sessions ?? []);
  }
  async function load() {
    const d = await fetch(`/api/lab/${params.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d) {
      setTitle(d.title); setMeta(d.meta ?? {}); setSecs(d.sections ?? []);
      setSplitDone(d.sectionCount > 0);
    }
    if (!d) setError("Session not found.");
    await loadSessions();
  }
  useEffect(() => { load(); }, [params.id]);

  async function split() {
    setSplitting(true); setError(null);
    const r = await fetch(`/api/lab/${params.id}`, { method: "POST" });
    const j = await r.json();
    setSplitting(false);
    if (!r.ok) { setError(j?.error?.message ?? "Could not split the paper."); return; }
    setSecs(j.sections ?? []); setSplitDone(true);
    setScopeSel((j.sections ?? []).map((x: Sec) => x.index));
  }

  async function simplify(scope: number[] | "all") {
    setError(null);
    setBusy(true);
    const key = scope === "all" ? "all" : scope.join(",");
    setSimplifying(key);
    const r = await fetch(`/api/lab/${params.id}/simplify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: scope === "all" ? undefined : scope }),
    });
    const j = await r.json();
    setBusy(false); setSimplifying(null);
    if (!r.ok) { setError(j?.error?.message ?? "Simplify failed."); return; }
    setSimplified((x) => ({ ...x, [key]: j.simplified }));
  }

  async function genQuiz(all: boolean) {
    const scope = all ? [] : scopeSel;
    setBusy(true); setError(null);
    const r = await fetch(`/api/lab/${params.id}/quiz`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setError(j?.error?.message ?? "Quiz generation failed."); return; }
    setQuestions(j.questions ?? []); setQScope(all ? [] : scope); setStep(0); setAnswers({});
    setMode("quiz"); setResult(null);
  }

  function setAnswer(value: any) { setAnswers((a) => ({ ...a, [step]: value })); }
  const answered = questions.length > 0 && answers[step] !== undefined;

  async function submit() {
    setBusy(true);
    const r = await fetch(`/api/lab/${params.id}/grade`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: qScope, questions, answers: Object.entries(answers).map(([q, value]) => ({ q: Number(q), value })) }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setError(j?.error?.message ?? "Grading failed."); return; }
    setResult({ score: j.score, maxScore: j.maxScore, results: j.results });
    setMode("results");
    loadSessions();
  }

  const q = questions[step];
return (
    <LabShell activeId={params.id} sessions={sessions}>
      <LabHeader title={title} subtitle={`Paper Lab · ${meta.authors ?? "unknown authors"}`} />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        {!splitDone && (
          <div className="rounded-2xl border border-neutral-200 p-6 text-center dark:border-neutral-700">
            <h2 className="text-lg font-semibold">Analyze this paper</h2>
            <p className="mt-1 text-sm text-neutral-500">Euler will split it into its main sections (Abstract, Method, Results, …) so you can read and quiz section by section.</p>
            <Button className="mt-4 rounded-xl" onClick={split} disabled={splitting}>{splitting ? "Analyzing…" : "✨ Split into sections"}</Button>
          </div>
        )}

        {splitDone && (
          <>
            <div className="flex gap-2">
              <Button variant={mode === "read" ? "default" : "outline"} onClick={() => setMode("read")}>📖 Read</Button>
              <Button variant={mode === "quiz" || mode === "results" ? "default" : "outline"} onClick={() => setMode("quiz")}>🧠 Quiz</Button>
            </div>

            {mode === "read" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-700">
                  <h3 className="font-semibold">Simplified whole paper</h3>
                  <p className="mt-1 text-xs text-neutral-500">Problem → Approach → Results → Limitations.</p>
                  {simplified.all && <div className="prose mt-2 whitespace-pre-wrap text-sm">{simplified.all}</div>}
                  {!simplified.all && (
                    <Button onClick={() => simplify("all")} disabled={simplifying === "all"} className="mt-2">
                      {simplifying === "all" ? "Simplifying…" : "✨ Simplify whole paper"}
                    </Button>
                  )}
                </div>
                {secs.map((s) => {
                  const has = Boolean(simplified[String(s.index)]);
                  return (
                    <div key={s.index} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-700">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="flex-1 font-semibold">{s.heading || `Section ${s.index + 1}`}</h3>
                        {!has && <Button variant="outline" size="sm" onClick={() => simplify([s.index])} disabled={simplifying === String(s.index)}>✨ Simplify</Button>}
                      </div>
                      {has && <div className="prose mt-1.5 text-sm whitespace-pre-wrap">{simplified[String(s.index)]}</div>}
                      {has && <Button variant="ghost" size="sm" className="mt-1" onClick={() => { const x = { ...simplified }; delete x[String(s.index)]; setSimplified(x); }}>Hide</Button>}
                    </div>
                  );
                })}
              </div>
            )}

            {mode === "quiz" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
                  <h3 className="font-semibold">🎯 Scope the quiz</h3>
                  <div className="mt-3 flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm"><input type="radio" name="scope" checked={qScope.length === 0} onChange={() => setQScope([])} /> Whole paper</label>
                    <div className="pt-1 text-xs font-medium text-neutral-500">Or pick sections:</div>
                    {secs.map((s) => (
                      <label key={s.index} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={qScope.includes(s.index)} onChange={() => setQScope((cur) => cur.includes(s.index) ? cur.filter((i) => i !== s.index) : [...cur, s.index])} />
                        {s.heading || `Section ${s.index + 1}`}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">{qScope.length ? `${qScope.length} section(s) selected · up to 12 questions` : "Whole paper · up to 12 questions"}</p>
                  <Button className="mt-3 rounded-xl" onClick={() => genQuiz(qScope.length === 0)} disabled={busy}>
                    {busy ? "Generating…" : "✨ Generate quiz"}
                  </Button>
                </div>
              {questions.length > 0 && (
                  <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">Question {step + 1} of {questions.length}</span>
                    </div>
                    <p className="mt-3 text-[15px] font-medium">{q.question}</p>
                    {q.type === "mcq" && q.options?.map((opt, i) => (
                      <label key={i} className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
                        <input type="radio" name="mcq" checked={answers[step] === i} onChange={() => setAnswer(i)} />
                        {opt}
                      </label>
                    ))}
                    {q.type === "multi" && q.options?.map((opt, i) => (
                      <label key={i} className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
                        <input type="checkbox" checked={(answers[step] ?? []).includes(i)} onChange={() => { const cur = answers[step] ?? []; setAnswer(cur.includes(i) ? cur.filter((x: number) => x !== i) : [...cur, i]); }} />
                        {opt}
                      </label>
                    ))}
                    {q.type === "short" && (
                      <textarea rows={4} value={answers[step] ?? ""} onChange={(e) => setAnswer(e.target.value)} placeholder="Write your answer…" className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent p-2.5 text-sm outline-none dark:border-neutral-600" />
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← Back</Button>
                      {step < questions.length - 1
                        ? <Button disabled={!answered} onClick={() => setStep((s) => s + 1)}>Next →</Button>
                        : <Button disabled={!answered || busy} onClick={submit}>{busy ? "Grading…" : "Submit answers"}</Button>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === "results" && result && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-700 dark:bg-neutral-800/50">
                <h3 className="text-xl font-semibold">{result.score} / {result.maxScore}</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {result.score >= result.maxScore * 0.8 ? "Strong understanding — well done." : result.score >= result.maxScore * 0.5 ? "Good — a few areas to revisit." : "Re-read the paper and try again — Euler is happy to explain any section."}
                </p>
                <div className="mt-4 space-y-3">
                  {result.results.map((r, i) => (
                    <div key={i} className="rounded-xl border p-3 text-sm dark:border-neutral-700">
                      <div className="flex items-center gap-2"><span>{r.correct ? "✅" : "❌"}</span><span className="flex-1 font-medium">{questions[i].question}</span></div>
                      {!r.correct && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Correct: {Array.isArray(r.correctAnswer) ? r.correctAnswer.map((x: number) => questions[i].options?.[x]).join(", ") : questions[i].type === "mcq" ? questions[i].options?.[Number(r.correctAnswer)] : r.correctAnswer}</p>}
                      {r.explanation && <p className="mt-1 text-xs text-neutral-500">{r.explanation}</p>}
                      {r.feedback && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{r.feedback}</p>}
                    </div>
                  ))}
                </div>
                <Button className="mt-4 rounded-xl" onClick={() => { setMode("quiz"); setQuestions([]); }}>Retake</Button>
              </div>
            )}
          </>
        )}
      </div>
    </LabShell>
  );
}