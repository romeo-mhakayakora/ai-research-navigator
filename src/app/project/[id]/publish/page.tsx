"use client";
import { useEffect, useState } from "react";
import { WorkspaceShell, ThreadHeader } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Venue = {
  name: string;
  type: string;
  deadlinePattern: string;
  acceptanceBand: string;
  fit: string;
  risk: string;
};

type CheckItem = { label: string; done: boolean };

export default function PublishPage({ params }: { params: { id: string } }) {
  const [state, setState] = useState<{
    stages: Array<{ stage: string; status: string }>;
    project: { domain: string; title: string };
  } | null>(null);

  const [topic, setTopic] = useState<{ title?: string } | null>(null);
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [methodology, setMethodology] = useState("");
  const [paperCount, setPaperCount] = useState(0);
  const [experimentCount, setExperimentCount] = useState(0);
  const [sectionCount, setSectionCount] = useState(0);
  const [referenceCount, setReferenceCount] = useState(0);
  const [hasRefs, setHasRefs] = useState(false);

  const [paperType, setPaperType] = useState("conference");
  const [openAccess, setOpenAccess] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState("");
  const [checklist, setChecklist] = useState<CheckItem[]>([]);
  const [submitted, setSubmitted] = useState<{ venue: string; date: string } | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/projects/${params.id}/state`);
    if (res.ok) setState(await res.json());
    const d = await fetch(`/api/projects/${params.id}/stages/publish/data`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d) {
      setTopic(d.topic ?? null);
      setTitle(d.title ?? "");
      setAbstract(d.abstract ?? "");
      setMethodology(d.methodology ?? "");
      setPaperCount(d.paperCount ?? 0);
      setExperimentCount(d.experimentCount ?? 0);
      setSectionCount(Object.keys(d.sections ?? {}).length);
      setReferenceCount(d.referenceCount ?? 0);
      setHasRefs(Boolean(d.hasReferencesSection));
      setVenues(d.venues ?? []);
      setSelectedVenue(d.selectedVenue ?? "");
      setChecklist(d.checklist ?? []);
      setSubmitted(d.submitted ?? null);
      if (d.prefs) {
        setPaperType(d.prefs.paperType ?? "conference");
        setOpenAccess(Boolean(d.prefs.openAccess));
      }
    }
  }
  useEffect(() => { load(); }, [params.id]);

  async function recommend() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/projects/${params.id}/stages/publish/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recommend", paperType, openAccess }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j?.error?.message ?? "Recommendation failed."); return; }
      setVenues(j.venues ?? []);
      setPaperType(j.prefs?.paperType ?? paperType);
      load();
    } finally { setBusy(false); }
  }

  async function toggleCheck(index: number) {
    const res = await fetch(`/api/projects/${params.id}/stages/publish/action`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggleCheck", index }),
    });
    if (res.ok) setChecklist((await res.json()).checklist ?? []);
  }

  async function selectVenue(name: string) {
    setSelectedVenue(name);
    await fetch(`/api/projects/${params.id}/stages/publish/action`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "selectVenue", name }),
    });
  }

  async function complete() {
    const res = await fetch(`/api/projects/${params.id}/stages/publish/action`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", venue: selectedVenue }),
    });
    const j = await res.json().catch(() => null);
    if (res.ok) load();
    else setError(j?.error?.message ?? "Cannot complete yet.");
  }

  const doneCount = checklist.filter((c) => c.done).length;
  const warnings: string[] = [];
  if (!title) warnings.push("Paper title not drafted (F6).");
  if (!abstract) warnings.push("Abstract not drafted (F6).");
  if (!hasRefs) warnings.push("References section not saved (F6 → References tab).");
  if (sectionCount < 3) warnings.push(`Only ${sectionCount} draft section(s) — aim for at least 3.`);
  if (!selectedVenue) warnings.push("No venue selected yet.");

  if (!state) {
    return (
      <WorkspaceShell projectId={params.id} projectTitle="Publish" stages={[]} active="publish">
        <p className="text-sm text-neutral-500">Loading…</p>
      </WorkspaceShell>
    );
  }
  const myStatus = state.stages.find((s) => s.stage === "F7")?.status ?? "LOCKED";

  return (
    <WorkspaceShell projectId={params.id} projectTitle={state.project.title} stages={state.stages} active="publish">
      <ThreadHeader title="F7 · Publish" subtitle={state.project.title} />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        {topic?.title && (
          <p className="rounded-xl bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
            📄 Your paper: <strong>{title || topic.title}</strong>
          </p>
        )}

        <Card>
          <CardHeader><CardTitle>🔍 Venue recommender</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-neutral-500">
              Title and abstract are pulled from your F6 draft. Suggestions are AI-generated from real venues — always verify dates on the official site.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                Type:
                <select value={paperType} onChange={(e) => setPaperType(e.target.value)} className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-600">
                  <option value="conference">Conference</option>
                  <option value="journal">Journal</option>
                  <option value="workshop">Workshop</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={openAccess} onChange={(e) => setOpenAccess(e.target.checked)} />
                Prefer open access
              </label>
              <Button onClick={recommend} disabled={busy}>{busy ? "Recommending…" : "✨ Recommend venues"}</Button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {venues.length > 0 && (
              <div className="space-y-2">
                {venues.map((v) => (
                  <div key={v.name} className={"rounded-xl border p-3 text-sm " + (selectedVenue === v.name ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-neutral-200 dark:border-neutral-700")}>
                    <div className="flex items-center justify-between gap-2">
                      <strong>{v.name}</strong>
                      <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs capitalize dark:bg-neutral-700">{v.type}</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">📅 {v.deadlinePattern} · 🎯 {v.acceptanceBand}</p>
                    <p className="mt-1"><span className="font-medium">Fit:</span> {v.fit}</p>
                    {v.risk && <p className="mt-0.5 text-amber-700 dark:text-amber-400"><span className="font-medium">Risk:</span> {v.risk}</p>}
                    <Button variant={selectedVenue === v.name ? "default" : "outline"} onClick={() => selectVenue(v.name)} className="mt-2">
                      {selectedVenue === v.name ? "✓ Selected" : "Select this venue"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {checklist.length > 0 && (
          <Card>
            <CardHeader><CardTitle>✅ Submission checklist ({doneCount}/{checklist.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {checklist.map((c, i) => (
                <label key={i} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <input type="checkbox" checked={c.done} onChange={() => toggleCheck(i)} className="mt-1" />
                  <span className={c.done ? "text-neutral-400 line-through" : ""}>{c.label}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>📋 Pre-submission review</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <ul className="space-y-1">
              <li>📄 Draft sections: <strong>{sectionCount}</strong> · references saved: <strong>{referenceCount}</strong></li>
              <li>📚 Literature papers: <strong>{paperCount}</strong> · experiments logged: <strong>{experimentCount}</strong></li>
              <li>🧪 Methodology: <strong>{methodology ? "finalized (F4)" : "missing"}</strong></li>
              <li>🏛️ Selected venue: <strong>{selectedVenue || "none yet"}</strong></li>
            </ul>
            {warnings.length > 0 ? (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
                <p className="font-medium">⚠️ Before you submit:</p>
                <ul className="mt-1 list-disc pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            ) : (
              <p className="mt-3 font-medium text-emerald-600">🎉 Everything looks ready — good luck!</p>
            )}
            {submitted && (
              <p className="mt-2 text-xs text-neutral-500">
                Marked submitted to {submitted.venue} on {new Date(submitted.date).toLocaleDateString()}.
              </p>
            )}
          </CardContent>
        </Card>

        <Button className="w-full rounded-xl" onClick={complete} disabled={myStatus === "COMPLETE" || !selectedVenue}>
          🚀 Mark submitted — finish Stage 7
        </Button>
      </div>
    </WorkspaceShell>
  );
}
