import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/use-sidebar";

export const STAGES = [
  { key: "topic", label: "Topic Selection", id: "F1", hint: "Narrow your domain into a scoped topic" },
  { key: "gaps", label: "Interview", id: "F2", hint: "Interview to find your knowledge gaps" },
  { key: "literature", label: "Literature Survey", id: "F3", hint: "Papers, summaries, Q&A" },
  { key: "validate", label: "Idea Validation", id: "F4", hint: "Evaluate your idea" },
  { key: "build", label: "Implementation and Experiment", id: "F5", hint: "Implementation guidance and experiment design" },
  { key: "write", label: "Write Paper", id: "F6", hint: "Draft sections" },
  { key: "publish", label: "Publish", id: "F7", hint: "Find a venue" },
];

function StageIcon({ index, status }: { index: number; status: string }) {
  if (status === "COMPLETE")
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-[11px] font-bold text-white"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></span>
    );
  if (status === "ACTIVE")
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
        {index + 1}
      </span>
    );
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-bold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      {index + 1}
    </span>
  );
}

export function WorkspaceShell({
  projectId,
  projectTitle,
  stages,
  active,
  sidebarExtra,
  children,
}: {
  projectId: string;
  projectTitle?: string;
  stages: Array<{ stage: string; status: string }>;
  active: string;
  sidebarExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const statusOf = (id: string) => stages.find((s) => s.stage === id)?.status ?? "LOCKED";
  // Collapsible sidebar: full width when pinned, hover-expand rail otherwise.
  const { mode, setMode, hoverOpen, setHoverOpen, mobileOpen, setMobileOpen } = useSidebar();
  const pinned = mode === "expanded";
  const wide = pinned || hoverOpen;
  return (
    <div className="relative flex h-screen text-neutral-200">
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        className="absolute left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-neutral-900 text-lg sm:hidden"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></svg>
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-neutral-950/90 backdrop-blur p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                {projectTitle ?? "Research project"}
              </span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-lg px-2 py-1 text-lg hover:bg-white/10">×</button>
            </div>
            {STAGES.map((s) => {
              const st = statusOf(s.id);
              const locked = st === "LOCKED";
              return (
                <Link
                  key={s.key}
                  href={locked ? "#" : `/project/${projectId}/${s.key}`}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                    s.key === active && "bg-white/[0.07] font-medium",
                    locked && "pointer-events-none opacity-45"
                  )}
                >
                  <StageIcon index={STAGES.indexOf(s)} status={st} />
                  <span className="min-w-0 flex-1 truncate">
                    {s.label}
                    {locked && <span className="ml-1.5 text-xs"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <aside
        onMouseEnter={() => { if (!pinned) setHoverOpen(true); }}
        onMouseLeave={() => { if (!pinned) setHoverOpen(false); }}
        aria-expanded={wide}
        aria-label="Research stages navigation"
        className={cn(
          "absolute inset-y-0 left-0 z-20 hidden flex-col border-r border-white/5 bg-neutral-950/70 backdrop-blur transition-[width] duration-200 sm:flex",
          wide ? "w-72" : "w-16"
        )}
      >
        <div className={cn("p-3", !wide && "px-2")}>
          <Link
            href="/"
            title="New research chat"
            className="flex w-full items-center gap-2 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium shadow-sm transition-colors hover:border-indigo-500/50 hover:bg-white/[0.07]"
          >
            <span className="shrink-0 text-lg leading-none"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg></span>
            {wide && <span className="truncate">New research chat</span>}
          </Link>
        </div>
        <div className="overflow-hidden whitespace-nowrap px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {wide ? (projectTitle ?? "Research project") : "\u00b7\u00b7\u00b7"}
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 pb-2" aria-label="Research stages">
          {STAGES.map((s, i) => {
            const st = statusOf(s.id);
            const locked = st === "LOCKED";
            const isActive = s.key === active;
            return (
              <Link
                key={s.key}
                href={locked ? "#" : `/project/${projectId}/${s.key}`}
                aria-disabled={locked}
                onFocus={() => { if (!pinned) setHoverOpen(true); }}
                title={wide ? (locked ? "Complete the previous stage to unlock" : s.hint) : `${s.label}${locked ? " (locked)" : ""} — ${s.hint}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-white/[0.07] font-medium"
                    : "hover:bg-white/[0.05]",
                  locked && "pointer-events-none opacity-45"
                )}
              >
                <StageIcon index={i} status={st} />
                {wide && (
                  <span className="min-w-0 flex-1 truncate">
                    {s.label}
                    {locked && <span className="ml-1.5 text-xs"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></span>}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        {sidebarExtra && wide && <div className="overflow-hidden">{sidebarExtra}</div>}
        <div className="flex items-center justify-between gap-1 border-t border-white/5 p-2 text-xs text-neutral-500">
          {wide ? (
            <>
              <span className="truncate px-1">Euler</span>
              <button
                onClick={() => setMode(pinned ? "hover" : "expanded")}
                aria-label={pinned ? "Collapse sidebar to hover rail" : "Pin sidebar open"}
                title={pinned ? "Collapse to hover rail" : "Pin sidebar open"}
                className="shrink-0 rounded-lg px-2 py-1 text-sm hover:bg-white/10"
              >
                {pinned ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setMode("expanded")}
              aria-label="Pin sidebar open"
              title="Pin sidebar open"
              className="mx-auto rounded-lg px-2 py-1 text-sm hover:bg-white/10"
            >
              \u25b6
            </button>
          )}
        </div>
      </aside>

      {/* ── Main column ─────────────────────────── */}
      <div className={cn("flex min-w-0 flex-1 flex-col pl-16 transition-[padding] duration-200", pinned && "sm:pl-72")}>{children}</div>
    </div>
  );
}

/** Slim top bar inside the thread column, like ChatGPT's model-picker row. */
export function ThreadHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-white/5 px-6 py-3">
      <div>
        <h1 className="font-display text-[15px] font-semibold">{title}</h1>
        {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      </div>
      <span className="rounded-full bg-gradient-to-r from-indigo-500/20 to-violet-500/20 px-2.5 py-1 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
        Euler
      </span>
    </header>
  );
}

export function LockExplainer({ stage }: { stage: string }) {
  return (
    <div className="mx-auto mt-24 max-w-md rounded-2xl glass-card p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] text-neutral-400"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></div>
      <h2 className="mt-3 text-lg font-semibold">This stage is locked</h2>
      <p className="mt-2 text-sm text-neutral-500">
        Complete the previous stage to unlock <strong>{stage}</strong>. Progress is enforced on the server.
      </p>
    </div>
  );
}
