"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSidebar } from "@/components/use-sidebar";

const STAGE_ROUTE: Record<string, string> = {
  F1: "topic",
  F2: "gaps",
  F3: "literature",
  F4: "validate",
  F5: "build",
  F6: "write",
  F7: "publish",
};

const SUGGESTIONS = [
  "Federated learning for edge devices",
  "Explainable AI in medical diagnosis",
  "Precision agriculture with satellite imagery",
  "Small language models for low-resource languages",
];

interface ProjectItem {
  id: string;
  title: string;
  domain: string;
  userLevel: string;
  createdAt: string;
  updatedAt: string;
  currentStage: string;
  completedCount: number;
  totalStages: number;
  isDemo?: boolean;
}

export default function Home() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const { mode: sbMode, setMode: setSbMode, hoverOpen: sbHover, setHoverOpen: setSbHover } = useSidebar();
  const sbPinned = sbMode === "expanded";
  const sbWide = sbPinned || sbHover;

  useEffect(() => {
    fetch("/api/projects/list")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
  }, []);

  async function create(d?: string) {
    const value = (d ?? domain).trim();
    if (value.length < 2 || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: value }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error?.message ?? "Failed to create project");
      return;
    }
    router.push(`/project/${data.projectId}/topic`);
  }

  function resumeUrl(p: ProjectItem) {
    const route = STAGE_ROUTE[p.currentStage] ?? "topic";
    return `/project/${p.id}/${route}`;
  }

  async function deleteProject(e: React.MouseEvent, p: ProjectItem) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${p.title}"? This removes all stages, messages and artifacts.`)) return;
    await fetch(`/api/projects/${p.id}`, { method: "DELETE" }).catch(() => {});
    setProjects((list) => list.filter((x) => x.id !== p.id));
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  }

  return (
    <main className="relative flex h-screen overflow-hidden text-neutral-200">
      <aside
        onMouseEnter={() => { if (!sbPinned) setSbHover(true); }}
        onMouseLeave={() => { if (!sbPinned) setSbHover(false); }}
        aria-expanded={sbWide}
        aria-label="Research threads navigation"
        className={"relative z-10 hidden shrink-0 flex-col border-r border-white/5 bg-neutral-950/70 backdrop-blur transition-[width] duration-200 sm:flex " + (sbWide ? "w-72" : "w-16")}
      >
        <div className={"p-3 " + (sbWide ? "" : "px-2")}>
          <Link
            href="/"
            className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium shadow-sm transition-colors hover:border-indigo-500/50 hover:bg-white/[0.07]"
          >
            <span className="shrink-0 text-indigo-300"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg></span>
            {sbWide && <span className="truncate">New research chat</span>}
          </Link>
          <Link
            href="/lab"
            title="Paper Lab"
            className="mt-1.5 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium shadow-sm transition-colors hover:border-indigo-500/50 hover:bg-white/[0.07]"
          >
            <span className="shrink-0 text-indigo-300"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg></span>
            {sbWide && <span className="truncate">Paper Lab</span>}
          </Link>
        </div>
        <div className="overflow-hidden whitespace-nowrap px-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          {sbWide ? "Research threads" : "\u00b7\u00b7\u00b7"}
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 pb-2">
          {projects.length === 0 && (
            <p className="px-2 py-3 text-xs text-neutral-500">
              No threads yet. Start one to see it here.
            </p>
          )}
          {projects.map((p) => (
            <Link
              key={p.id}
              href={resumeUrl(p)}
              title={p.title}
              className="group relative flex items-start gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-white/[0.05]"
            >
              <span className="mt-0.5 shrink-0 text-indigo-400"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg></span>
              {sbWide && <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate font-medium text-neutral-300 group-hover:text-white">
                    {p.title}
                  </span>
                  {!p.isDemo && (
                    <button
                      onClick={(e) => deleteProject(e, p)}
                      aria-label={`Delete ${p.title}`}
                      title="Delete thread"
                      className="shrink-0 rounded-md p-1 text-neutral-500 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  )}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                  <span>
                    {p.currentStage} · {p.completedCount}/{p.totalStages} stages
                  </span>
                  <span>·</span>
                  <span>{formatDate(p.updatedAt)}</span>
                </span>
              </span>}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-1 border-t border-white/5 p-2 text-xs text-neutral-500">
          {sbWide ? (
            <>
              <span className="truncate px-1 font-medium">Euler</span>
              <button
                onClick={() => setSbMode(sbPinned ? "hover" : "expanded")}
                aria-label={sbPinned ? "Collapse sidebar to hover rail" : "Pin sidebar open"}
                title={sbPinned ? "Collapse to hover rail" : "Pin sidebar open"}
                className="shrink-0 rounded-lg px-2 py-1 text-sm hover:bg-white/10"
              >
                {sbPinned ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setSbMode("expanded")}
              aria-label="Pin sidebar open"
              title="Pin sidebar open"
              className="mx-auto rounded-lg px-2 py-1 text-sm hover:bg-white/10"
            >
              \u25b6
            </button>
          )}
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6">
        <div className="w-full max-w-2xl animate-fade-up py-10 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            F1–F7 pipeline is live · Paper Lab now open
          </div>
          <div className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_0_32px_rgba(99,102,241,0.5)]">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>
          </div>
          <h1 className="mt-5 font-display text-6xl font-bold tracking-tight text-white">
            Euler
          </h1>
          <p className="gradient-text mt-2 font-display text-xl font-semibold tracking-wide">
            AI Research Assistant Agent
          </p>
          <p className="mt-3 font-display text-2xl font-medium text-neutral-200">
            Your best research partner.
          </p>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-neutral-400">
            Euler takes you from a rough idea to a submission-ready paper — shaping your topic with you, grounding every claim in real literature, and guiding the writing stage by stage.
          </p>

          {/* what it helps with */}
          <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              { t: "Pick a topic that holds up", d: "Narrowed and stress-tested with you" },
              { t: "Ground it in real literature", d: "Actual papers, never invented" },
              { t: "Write with guidance", d: "Structured sections, ready to submit" },
            ].map((f) => (
              <div key={f.t} className="glass-card p-4 text-left">
                <p className="text-sm font-medium text-neutral-200">{f.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">{f.d}</p>
              </div>
            ))}
          </div>

          <p className="mt-9 text-sm text-neutral-500">
            share your research spark
          </p>
          <div className="glass-card mx-auto mt-2 flex max-w-xl items-end gap-2 p-2 text-left transition-[border-color,box-shadow] duration-200 focus-within:border-indigo-500/60 focus-within:shadow-[0_0_24px_rgba(99,102,241,0.2)]">
            <textarea
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  create();
                }
              }}
              rows={2}
              placeholder="What do you want to investigate?"
              className="max-h-40 min-h-[56px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-neutral-500"
            />
            <button
              onClick={() => create()}
              disabled={busy || domain.trim().length < 2}
              aria-label="Start researching"
              className="btn-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-150 active:scale-95 disabled:opacity-30 disabled:shadow-none"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg>
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-600">
            your threads · {projects.length} so far
          </p>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => create(s)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-neutral-400 transition-colors hover:border-indigo-500/50 hover:text-neutral-200"
              >
                {s}
              </button>
            ))}
          </div>

          {/* explore loop */}
          <div className="mt-8 flex items-center justify-center gap-6 text-sm">
            <span className="text-neutral-600">your threads live in the sidebar — pick up anytime</span>
            <Link href="/lab" className="text-neutral-400 underline-offset-4 transition-colors hover:text-neutral-200 hover:underline">
              open paper lab →
            </Link>
          </div>

          {/* capability strip */}
          <div className="mx-auto mt-10 max-w-xl border-t border-white/5 pt-6">
            <p className="text-sm text-neutral-400">One conversation, the whole research arc</p>
            <p className="mt-2 text-[13px] tracking-wide text-neutral-500">
              {["Topic", "Interview", "Literature", "Validate", "Build", "Write", "Publish"].map((s, i) => (
                <span key={s}>
                  {i > 0 && <span className="mx-1.5 text-neutral-700">·</span>}
                  {s}
                </span>
              ))}
            </p>
            <p className="mt-4 text-xs text-neutral-600">
              grounded in real papers · stage-by-stage gating
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
