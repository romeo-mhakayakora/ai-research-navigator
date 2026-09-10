import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/use-sidebar";

export type LabSessionMeta = {
  id: string;
  title: string;
  quizCount: number;
  lastScore?: string | null;
  updatedAt: string;
  isDemo?: boolean;
};

export function LabShell({
  activeId,
  sessions,
  onDeleteSession,
  children,
}: {
  activeId?: string;
  sessions: LabSessionMeta[];
  onDeleteSession?: (id: string) => void;
  children: React.ReactNode;
}) {
  const { mode, setMode, hoverOpen, setHoverOpen } = useSidebar();
  const pinned = mode === "expanded";
  const wide = pinned || hoverOpen;

  function dateLabel(iso: string) {
    const d = new Date(iso);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const h = Math.floor(diffMin / 60);
    if (h < 24) return `${h}h ago`;
    return d.toLocaleDateString();
  }

  return (
    <div className="relative flex h-screen text-neutral-200">
      <aside
        onMouseEnter={() => { if (!pinned) setHoverOpen(true); }}
        onMouseLeave={() => { if (!pinned) setHoverOpen(false); }}
        aria-expanded={wide}
        aria-label="Paper Lab navigation"
        className={cn(
          "absolute inset-y-0 left-0 z-20 hidden flex-col border-r border-white/5 bg-neutral-950/70 backdrop-blur transition-[width] duration-200 sm:flex",
          wide ? "w-72" : "w-16"
        )}
      >
        <div className={cn("p-3", !wide && "px-2")}>
          <Link
            href="/lab"
            title={wide ? "New paper" : "New paper"}
            className="flex w-full items-center gap-2 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium shadow-sm transition-colors hover:border-indigo-500/50 hover:bg-white/[0.07]"
          >
            <span className="shrink-0 text-lg leading-none"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg></span>
            {wide && <span className="truncate">New paper</span>}
          </Link>
        </div>
        <div className="overflow-hidden whitespace-nowrap px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {wide ? "Reading sessions" : "· · ·"}
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 pb-2" aria-label="Paper reading sessions">
          {sessions.length === 0 && (
            <p className={cn(wide && "px-2 py-3 text-xs text-neutral-400")}>
              {wide ? "No sessions yet. Open a paper to start." : ""}
            </p>
          )}
          {sessions.map((p) => (
            <Link
              key={p.id}
              href={`/lab/${p.id}`}
              title={p.title}
              className={cn(
                "group flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                activeId === p.id && "bg-white/[0.07] font-medium",
                activeId !== p.id && "hover:bg-white/[0.05]"
              )}
            >
              <span className="mt-0.5 shrink-0 text-indigo-400"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg></span>
              {wide && (
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate font-medium text-neutral-700 group-hover:text-neutral-900 dark:text-neutral-200 dark:group-hover:text-white">
                      {p.title}
                    </span>
                    {!p.isDemo && onDeleteSession && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (window.confirm(`Delete "${p.title}"?`)) onDeleteSession(p.id);
                        }}
                        aria-label={`Delete ${p.title}`}
                        title="Delete session"
                        className="shrink-0 rounded-md p-1 text-neutral-500 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-400">
                    {p.quizCount ? `quiz ${p.lastScore} · ` : ""}{p.quizCount} quiz{p.quizCount === 1 ? "" : "s"} · {dateLabel(p.updatedAt)}
                  </span>
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-1 border-t border-white/5 p-2 text-xs text-neutral-500">
          {wide ? (
            <>
              <span className="truncate px-1">Euler · Paper Lab</span>
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
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          )}
        </div>
      </aside>

      <div className={cn("flex min-w-0 flex-1 flex-col pl-16 transition-[padding] duration-200", pinned && "sm:pl-72")}>
        {children}
      </div>
    </div>
  );
}

export function LabHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/5 px-6 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:border-indigo-500/50 hover:text-neutral-200"
        >
          ← Back to projects
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[15px] font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-gradient-to-r from-indigo-500/20 to-violet-500/20 px-2.5 py-1 text-xs font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
        Euler
      </span>
    </header>
  );
}