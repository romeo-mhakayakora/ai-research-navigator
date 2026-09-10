"use client";
import { useEffect, useState } from "react";
import { WorkspaceShell, ThreadHeader } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const BUILTIN = ["title", "abstract", "introduction", "background", "methodology", "results", "discussion", "conclusion"];

type Match = { extId: string; reason: string; title: string; authors: string; year: number; url: string };
type RefItem = { authors: string; year: string; title: string; venue: string; url: string; cited: boolean };

function parseDocxClient(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (let i = 0; i < bytes.length; i += 32768) {
          bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 32768)));
        }
        const hits = bin.match(/<w:t[^>]*>([^<]{1,500})<\/w:t>/g) ?? [];
        const joined = hits.map((t) => t.replace(/<\/?w:t[^>]*>/g, "")).join(" ").replace(/\s+/g, " ").trim();
        resolve(joined);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsArrayBuffer(file);
  });
}

export default function WritePage({ params }: { params: { id: string } }) {
  const [state, setState] = useState<{ stages: Array<{ stage: string; status: string }>; project: { domain: string; title: string } } | null>(null);
  const [sections, setSections] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"draft" | "references">("draft");
  const [selected, setSelected] = useState("abstract");
  const [customName, setCustomName] = useState("");
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paperCount, setPaperCount] = useState(0);
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [references, setReferences] = useState<RefItem[]>([]);
  const [refBusy, setRefBusy] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const allSections = [...BUILTIN, ...customOrder];

  async function load() {
    const res = await fetch(`/api/projects/${params.id}/state`);
    if (res.ok) setState(await res.json());
    const d = await fetch(`/api/projects/${params.id}/stages/write/data`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d) {
      setSections(d.sections ?? {});
      setPaperCount((d.papers ?? []).length);
      const cust = Object.keys(d.sections ?? {}).filter((k: string) => !BUILTIN.includes(k));
      setCustomOrder(cust);
    }
  }
  useEffect(() => { load(); }, [params.id]);
  useEffect(() => { setDraft(sections[selected] ?? ""); }, [selected]);


  async function generate() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/projects/${params.id}/stages/write/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", section: selected }),
      });
      if (res.ok) {
        const j = await res.json();
        setDraft(j.content);
        setSections((s) => ({ ...s, [selected]: j.content }));
      } else {
        const e = await res.json().catch(() => null);
        setError(e?.error?.message ?? "Generation failed.");
      }
    } finally { setBusy(false); }
  }

  async function save() {
    await fetch(`/api/projects/${params.id}/stages/write/action`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveSection", section: selected, content: draft }),
    });
    setSections((s) => ({ ...s, [selected]: draft }));
  }

  function addCustomSection() {
    const name = customName.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
    if (!name || allSections.includes(name)) return;
    setCustomOrder((o) => [...o, name]);
    setCustomName("");
    setSelected(name);
    setDraft("");
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setRefError(null);
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith(".txt") || lower.endsWith(".md")) {
        setText(await file.text());
      } else if (lower.endsWith(".pdf") || lower.endsWith(".docx")) {
        setRefBusy(true);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", lower.endsWith(".pdf") ? "pdf" : "docx");
        const r = await fetch(`/api/projects/${params.id}/stages/write/upload`, { method: "POST", body: fd });
        const j = await r.json();
        if (!r.ok) setRefError(j?.error?.message ?? "File parse failed.");
        else if ((j.text ?? "").length < 20) setRefError("Could not extract text — paste it manually.");
        else setText(j.text ?? "");
        setRefBusy(false);
      } else {
        setRefError("Supported formats: .txt, .md, .pdf, .docx");
      }
    } catch {
      setRefError("Could not read that file.");
      setRefBusy(false);
    }
  }

  async function identify() {
    if (text.trim().length < 20) { setRefError("Paste at least a few sentences first."); return; }
    setRefBusy(true); setRefError(null);
    try {
      const res = await fetch(`/api/projects/${params.id}/stages/write/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "identifyReferences", text: text.slice(0, 4000) }),
      });
      const j = await res.json();
      if (!res.ok) { setRefError(j?.error?.message ?? "Identification failed."); return; }
      setMatches(j.matches ?? []);
      setReferences((j.matches ?? []).map((m: Match) => ({
        authors: m.authors, year: String(m.year), title: m.title,
        venue: "arXiv - " + m.extId, url: m.url, cited: true,
      })));
    } finally { setRefBusy(false); }
  }

  function referencesBlock() {
    return references.filter((r) => r.cited).map((r, i) => "[" + (i + 1) + "] " + r.authors + " (" + r.year + "). " + r.title + ". " + r.venue + ". " + r.url).join("\n");
  }

  async function copyRefs() {
    try { await navigator.clipboard.writeText(referencesBlock()); } catch { /* noop */ }
  }

  async function saveReferences() {
    await fetch(`/api/projects/${params.id}/stages/write/action`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveReferences", references }),
    });
    load();
  }

  async function complete() {
    const res = await fetch(`/api/projects/${params.id}/stages/write/action`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    if (res.ok) load();
    else { const e = await res.json().catch(() => null); setError(e?.error?.message ?? "Cannot complete yet."); }
  }

  if (!state) {
    return (
      <WorkspaceShell projectId={params.id} projectTitle="Paper Writing" stages={[]} active="write">
        <p className="text-sm text-neutral-500">Loading…</p>
      </WorkspaceShell>
    );
  }
  const myStatus = state.stages.find((s) => s.stage === "F6")?.status ?? "LOCKED";

  return (
    <WorkspaceShell projectId={params.id} projectTitle={state.project.title} stages={state.stages} active="write">
      <ThreadHeader title="F6 · Paper Writing" subtitle={state.project.title} />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        <p className="text-sm text-neutral-500">
          {paperCount} paper{paperCount === 1 ? "" : "s"} from your literature survey available as citation sources.
        </p>
        <div className="flex gap-2">
          <Button variant={tab === "draft" ? "default" : "outline"} onClick={() => setTab("draft")}>📝 Draft sections</Button>
          <Button variant={tab === "references" ? "default" : "outline"} onClick={() => setTab("references")}>📚 References</Button>
        </div>
        {tab === "draft" && (
          <Card>
            <CardHeader><CardTitle>Sections</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {allSections.map((s) => (
                  <button key={s} onClick={() => setSelected(s)}
                    className={"rounded-full px-3 py-1 text-xs capitalize " + (selected === s ? "bg-neutral-900 text-white" : "border border-neutral-300")}>
                    {s}{sections[s] ? " ✓" : ""}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="New section name, e.g. related work" />
                <Button onClick={addCustomSection}>+ Add section</Button>
              </div>
              <h3 className="font-semibold capitalize">{selected}</h3>
              <Textarea rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write or generate this section…" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button onClick={generate} disabled={busy}>{busy ? "Generating…" : "✨ Generate draft"}</Button>
                <Button variant="outline" onClick={save}>Save section</Button>
              </div>
            </CardContent>
          </Card>
        )}
        {tab === "references" && (
          <Card>
            <CardHeader><CardTitle>📚 References — identify papers you used</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-neutral-500">Paste your text or upload .txt / .md / .pdf / .docx. The assistant finds which papers your content draws on.</p>
              <input type="file" accept=".txt,.md,.pdf,.docx" onChange={(e) => handleFile(e.target.files?.[0])} className="text-sm" />
              <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your draft content here…" />
              {refError && <p className="text-sm text-red-600">{refError}</p>}
              <Button onClick={identify} disabled={refBusy}>{refBusy ? "Identifying…" : "🔍 Identify references"}</Button>
              {matches.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Matched papers</h4>
                  {matches.map((m) => (
                    <div key={m.extId} className="rounded-xl border p-3 text-sm">
                      <a href={m.url} target="_blank" rel="noreferrer" className="font-medium underline">{m.title}</a>
                      <span className="block text-xs text-neutral-500">{m.authors} · {m.year} — {m.reason}</span>
                    </div>
                  ))}
                </div>
              )}
              {references.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Reference list</h4>
                  <pre className="whitespace-pre-wrap rounded-xl bg-neutral-100 p-3 text-xs dark:bg-neutral-800">{referencesBlock()}</pre>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={copyRefs}>Copy</Button>
                    <Button variant="outline" onClick={saveReferences}>Save references</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <Button className="w-full rounded-xl" onClick={complete} disabled={myStatus === "COMPLETE"}>
          Finish Stage 6 → Continue to Publish
        </Button>
      </div>
    </WorkspaceShell>
  );
}
