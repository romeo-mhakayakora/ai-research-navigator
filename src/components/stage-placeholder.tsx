"use client";
import { useEffect, useState } from "react";
import { WorkspaceShell, ThreadHeader, LockExplainer } from "@/components/workspace-shell";

const PAGES = ["gaps", "literature", "validate", "build", "write", "publish"] as const;
const IDS: Record<string, string> = { gaps: "F2", literature: "F3", validate: "F4", build: "F5", write: "F6", publish: "F7" };
const LABELS: Record<string, string> = {
  gaps: "F2 — Interview & Gap Analysis",
  literature: "F3 — Literature Survey & Paper Q&A",
  validate: "F4 — Research Idea Validation",
  build: "F5 — Implementation and Experiment",
  write: "F6 — Paper Writing Assistant",
  publish: "F7 — Publication Venue Recommender",
};

export function StagePlaceholder({ projectId, stageKey }: { projectId: string; stageKey: string }) {
  const [data, setData] = useState<{
    stages: Array<{ stage: string; status: string }>;
    project: { title: string; domain: string };
  } | null>(null);
  useEffect(() => {
    fetch(`/api/projects/${projectId}/state`).then(async (r) => {
      if (r.ok) setData(await r.json());
    });
  }, [projectId]);
  if (!data) return <main className="p-8">Loading…</main>;
  const status = data.stages.find((s) => s.stage === IDS[stageKey])?.status ?? "LOCKED";
  return (
    <WorkspaceShell projectId={projectId} projectTitle={data.project.title} stages={data.stages} active={stageKey}>
      <ThreadHeader title={LABELS[stageKey]} subtitle={`Project: ${data.project.domain}`} />
      {status === "LOCKED" ? (
        <LockExplainer stage={LABELS[stageKey]} />
      ) : (
        <div className="mx-auto mt-24 max-w-md text-center">
          <div className="text-4xl">🛠️</div>
          <h2 className="mt-3 text-lg font-semibold">{LABELS[stageKey]}</h2>
          <p className="mt-2 text-sm text-neutral-500">
            This stage is unlocked. Its full chat experience lands in the next milestones — one stage at a time.
          </p>
        </div>
      )}
    </WorkspaceShell>
  );
}
