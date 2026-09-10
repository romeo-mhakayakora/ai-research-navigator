"use client";
import { useEffect, useState } from "react";
import { WorkspaceShell, ThreadHeader } from "@/components/workspace-shell";
import { ChatThread, CandidateCards } from "@/components/topic-ui";
import { Button } from "@/components/ui/button";
import type { CandidateTopic, TopicBrief } from "@/lib/validation";
import type { ThreadMessage } from "@/components/topic-ui";

type TopicData = {
  messages: ThreadMessage[];
  brief: TopicBrief | null;
  finalTopicId: string | null;
  candidates: CandidateTopic[];
};

export default function TopicPage({ params }: { params: { id: string } }) {
  const [state, setState] = useState<{
    stages: Array<{ stage: string; status: string }>;
    project: { domain: string; title: string };
  } | null>(null);
  const [data, setData] = useState<TopicData | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch(`/api/projects/${params.id}/state`);
    if (res.ok) setState(await res.json());
    const d = await fetch(`/api/projects/${params.id}/stages/topic/data`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (d) setData(d);
    setLoading(false);
  }
  useEffect(() => { load(); }, [params.id]);

  async function propose() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${params.id}/stages/topic/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "propose" }),
      });
      if (res.ok) {
        const j = await res.json();
        setData((d) => ({ ...d!, candidates: j.candidates }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function lock(id: string) {
    const res = await fetch(`/api/projects/${params.id}/stages/topic/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock", candidateId: id }),
    });
    if (res.ok) {
      const j = await res.json();
      setData((d) => ({ ...d!, brief: j.brief, finalTopicId: id }));
    }
  }

  async function complete() {
    const res = await fetch(`/api/projects/${params.id}/stages/topic/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    if (res.ok) {
      load();
      window.location.href = `/project/${params.id}/gaps`;
    }
  }

  if (!state || loading) return <main className="p-8">Loading…</main>;
  const myStatus = state.stages.find((s) => s.stage === "F1")?.status;
  // hasHistory is always true for new projects: creation seeds the home-page
  // interest as the first F1 message, so land directly in the thread.
  const welcome = `Hi! I'm Euler, your research assistant agent. Got it — you're interested in "${state.project.domain}". I'll ask a couple of quick questions to scope it into a sharp, achievable research topic. ${data?.messages?.length ? "" : "Tell me which sub-area excites you most, or ask me anything about the domain."}`;

  return (
    <WorkspaceShell projectId={params.id} projectTitle={state.project.title} stages={state.stages} active="topic">
      <ThreadHeader title="Topic Selection" subtitle={`Stage 1 of 7 · ${state.project.domain}`} />
      <ChatThread
          projectId={params.id}
          stage="topic"
          welcome={welcome}
          initialMessages={data?.messages}
          readOnly={myStatus === "COMPLETE"}
          belowThread={
            <>
              {busy && <p className="pb-2 text-center text-sm text-neutral-400">Finding candidate topics…</p>}
              {data != null && data.candidates.length > 0 && data.brief == null && (
                <CandidateCards candidates={data.candidates} onLock={lock} />
              )}
              {data?.brief && (
                <div className="mx-auto w-full max-w-3xl px-6 pb-10">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/40">
                    <h3 className="font-semibold">📄 {data.brief.title}</h3>
                    <p className="mt-2 text-sm leading-6">{data.brief.problem}</p>
                    <div className="mt-2 text-sm">
                      <strong>Research questions:</strong>
                      <ul className="list-disc pl-5">{data.brief.researchQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                    </div>
                    <Button className="mt-4 w-full rounded-xl" onClick={complete} disabled={myStatus === "COMPLETE"}>
                      Finish Stage 1 → Continue to Interview
                    </Button>
                  </div>
                </div>
              )}
            </>
          }
        />
    </WorkspaceShell>
  );
}
