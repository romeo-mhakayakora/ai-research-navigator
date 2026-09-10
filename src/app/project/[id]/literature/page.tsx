"use client";
import { useEffect, useState } from "react";
import { WorkspaceShell, ThreadHeader } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";

type Paper = {
  extId: string;
  title: string;
  authors: string[];
  year: number;
  url: string;
  abstract: string;
  notes?: string;
};

type Solution = {
  name: string;
  description: string;
  howItAddresses: string;
  paperExtIds: string[];
};

type ThreadMsg = { role: "user" | "assistant"; content: string };

function Thread({ messages, emptyHint }: { messages: ThreadMsg[]; emptyHint: string }) {
  if (!messages || messages.length === 0)
    return <p className="text-xs text-neutral-400">{emptyHint}</p>;
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto">
      {messages.map((m, i) => (
        <div key={i} className={`rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-neutral-100 dark:bg-neutral-800" : "mr-8 bg-emerald-50 dark:bg-emerald-950/30"}`}>
          <span className="whitespace-pre-wrap">{m.content}</span>
        </div>
      ))}
    </div>
  );
}

export default function LiteraturePage({ params }: { params: { id: string } }) {
  const [state, setState] = useState<{
    stages: Array<{ stage: string; status: string }>;
    project: { domain: string; title: string };
  } | null>(null);
  const [data, setData] = useState<{
    topic: { title?: string; researchQuestions?: string[] };
    gaps: string[];
    solutions: Solution[];
    savedPapers: Paper[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<ThreadMsg[]>([]);

  async function load() {
    const res = await fetch(`/api/projects/${params.id}/state`);
    if (res.ok) setState(await res.json());
    const d = await fetch(`/api/projects/${params.id}/stages/literature/data`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (d) {
      setData(d);
      setMessages(d.messages ?? []);
      const n: Record<string, string> = {};
      for (const p of d.savedPapers ?? []) {
        if (p.notes) n[p.extId] = p.notes;
      }
      setNotes(n);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [params.id]);

  async function search() {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${params.id}/stages/literature/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search" }),
      });
      if (res.ok) {
        const j = await res.json();
        setData((d) => ({ ...d!, solutions: j.solutions ?? [], savedPapers: j.papers ?? d!.savedPapers }));
      } else {
        const e = await res.json().catch(() => null);
        setError(e?.error?.message ?? "Search failed — try again.");
      }
    } finally {
      setSearching(false);
    }
  }

  async function saveNote(extId: string) {
    await fetch(`/api/projects/${params.id}/stages/literature/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveNotes", extId, notes: notes[extId] ?? "" }),
    });
  }

  async function complete() {
    const res = await fetch(`/api/projects/${params.id}/stages/literature/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    if (res.ok) {
      window.location.href = `/project/${params.id}/validate`;
    } else {
      const e = await res.json().catch(() => null);
      setError(e?.error?.message ?? "Could not complete.");
    }
  }

  if (!state || loading) return <main className="p-8">Loading…</main>;
  const myStatus = state.stages.find((s) => s.stage === "F3")?.status;
  const isComplete = myStatus === "COMPLETE";
  const normAuthors = (a: unknown): string[] => Array.isArray(a) ? a as string[] : String(a ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const paperMap = new Map((data?.savedPapers ?? []).map((p) => [p.extId, { ...p, authors: normAuthors(p.authors) }]));
  const solutions = data?.solutions;
  const gaps = data?.gaps;
  const researchQuestions = data?.topic?.researchQuestions;

  return (
    <WorkspaceShell projectId={params.id} projectTitle={state.project.title} stages={state.stages} active="literature">
      <ThreadHeader title="Literature Survey" subtitle={`Stage 3 of 7 · ${state.project.domain}`} />
      <div className="mx-auto w-full max-w-4xl space-y-6 px-6 pb-10">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-800/40">
          <h3 className="font-semibold">📄 Locked Topic</h3>
          <p className="mt-1 text-sm font-medium">{data?.topic?.title ?? "(none)"}</p>
          {researchQuestions?.length && researchQuestions.length > 0 && (
            <div className="mt-2 text-sm">
              <strong>Research questions:</strong>
              <ul className="list-disc pl-5">
                {researchQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
          {gaps && gaps.length > 0 && (
            <div className="mt-3 text-sm">
              <strong>Gaps to address:</strong>
              <ul className="list-disc pl-5">
                {gaps.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}
        </div>

        {messages.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
            <h3 className="font-semibold">💬 Search conversation</h3>
            <div className="mt-3"><Thread messages={messages} emptyHint="" /></div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Solutions proposed by the research community</h2>
          {!isComplete && (
            <Button onClick={search} disabled={searching} className="rounded-xl">
              {searching ? "Searching arXiv…" : "🔍 Search for solutions"}
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
          {solutions?.length === 0 && !searching && (
          <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            No solutions yet. Click “Search for solutions” to find papers from arXiv grouped by approach.
          </p>
        )}
        {data?.solutions && data.solutions.length > 0 && (
          <div className="space-y-5">
            {data.solutions.map((sol, i) => {
              const papers = sol.paperExtIds.map((id) => paperMap.get(id)).filter(Boolean) as Paper[];
              return (
                <div key={i} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-700">
                  <h3 className="text-base font-semibold">{sol.name}</h3>
                  <p className="mt-1 text-sm text-neutral-600">{sol.description}</p>
                  <p className="mt-1 text-sm"><strong>How it addresses the problem:</strong> {sol.howItAddresses}</p>
                  <div className="mt-3 space-y-3">
                    {papers.map((paper) => (
                      <div key={paper.extId} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                        <a href={paper.url} target="_blank" rel="noreferrer" className="text-sm font-medium underline underline-offset-2">{paper.title}</a>
                        <p className="mt-0.5 text-xs text-neutral-500">{paper.authors.slice(0, 3).join(", ")}{paper.authors.length > 3 ? " et al." : ""} · {paper.year}</p>
                        <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{paper.abstract}</p>
                        {!isComplete && (
                          <textarea
                            value={notes[paper.extId] ?? ""}
                            onChange={(e) => setNotes((n) => ({ ...n, [paper.extId]: e.target.value }))}
                            onBlur={() => saveNote(paper.extId)}
                            placeholder="Add notes…"
                            rows={2}
                            className="mt-2 w-full rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-600"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {solutions && solutions.length > 0 && !isComplete && (
          <Button onClick={complete} className="w-full rounded-xl">Finish Stage 3 → Continue to Validate</Button>
        )}
        {isComplete && (
          <p className="text-center text-sm text-emerald-600">✅ Literature survey complete — <a href={`/project/${params.id}/validate`} className="underline">Continue to Validate</a></p>
        )}
      </div>
    </WorkspaceShell>
  );
}

