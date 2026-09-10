"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LabShell, LabSessionMeta, LabHeader } from "@/components/lab-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function LabIndex() {
  const router = useRouter();
  const [sessions, setSessions] = useState<LabSessionMeta[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const d = await fetch("/api/lab").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d) setSessions(d.sessions ?? []);
  }
  useEffect(() => { load(); }, []);

  function handleFile(f: File | undefined) {
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      const txt = String(r.result).slice(0, 16000);
      setText(txt);
      if (!title && f.name) setTitle(f.name.replace(/\.\w+$/, "").replace(/[_-]/g, " ").slice(0, 120));
    };
    r.readAsText(f);
  }

  async function create() {
    if (text.trim().length < 40 || busy) return;
    setBusy(true); setError(null);
    const [a, y] = [window.prompt?.("Authors (optional)") ?? "", window.prompt?.("Year (optional)") ?? ""];
    void a; void y;
    const res = await fetch("/api/lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), text }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setError(j?.error?.message ?? "Could not create session."); return; }
    router.push(`/lab/${j.sessionId}`);
  }

  return (
    <LabShell
      activeId={undefined}
      sessions={sessions}
      onDeleteSession={async (id) => {
        await fetch(`/api/lab/${id}`, { method: "DELETE" }).catch(() => {});
        setSessions((list) => list.filter((s) => s.id !== id));
      }}
    >
      <LabHeader title="Paper Lab" subtitle="Read simplified sections, then test your understanding" />
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8">
        {/* hero */}
        <div className="animate-fade-up pt-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_0_32px_rgba(99,102,241,0.5)]">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-white">
            Paper Lab
          </h1>
          <p className="gradient-text mt-2 font-display text-base font-semibold tracking-wide">
            AI Reading Companion
          </p>
          <p className="mt-2 font-display text-xl font-medium text-neutral-200">
            Understand any paper — without the struggle.
          </p>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-neutral-400">
            An AI reading companion: upload a paper and Euler splits it into sections, rewrites each one in plain language, then quizzes you to prove you understood it.
          </p>
        </div>

        {/* what it does */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { t: "Read the easy version", d: "Plain-language rewrites of every section, grounded in the paper" },
            { t: "Zoom into what matters", d: "Simplify the whole paper or just one section" },
            { t: "Prove you understood", d: "A short quiz, graded against the paper, with a score" },
          ].map((f) => (
            <div key={f.t} className="glass-card p-4 text-left">
              <p className="text-sm font-medium text-neutral-200">{f.t}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="glass-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className="text-indigo-300"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg></span>
            Open a paper
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Paste the text, or choose a file. Euler will split it into sections so you can read an easy version
            and take a quiz on all or some of the paper.
          </p>
          <div className="mt-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Paper title (required)" />
          </div>
          <div className="mt-2">
            <input type="file" accept=".txt,.md,.pdf,.docx,.json" onChange={(e) => handleFile(e.target.files?.[0])} className="text-sm" />
            <span className="ml-2 text-xs text-neutral-400">.txt / .md / .pdf / .docx</span>
          </div>
          <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste the paper text here (at least a few sentences)…" className="mt-2" />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <Button className="mt-3 rounded-xl" onClick={create} disabled={busy || text.trim().length < 40}>
            {busy ? "Creating…" : "→ Open in Euler's Paper Lab"}
          </Button>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/50">
          <strong>How it works</strong>
          <ul className="mt-1.5 list-disc pl-5 space-y-1">
            <li><strong>Read</strong> — Euler simplifies the whole paper or any single section into plain language.</li>
            <li><strong>Quiz</strong> — test yourself on the whole paper or just the sections that matter to you: multiple choice, multi-select, and short written answers.</li>
            <li>Sessions save automatically — pick any past one from the sidebar to resume.</li>
          </ul>
        </div>
      </div>
    </LabShell>
  );
}