import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertStageOpen, completeStage, GateError } from "@/lib/gating";
import { errorEnvelope } from "@/lib/utils";
import { chatComplete } from "@/lib/harness/provider/llm";
import { F6_SYSTEM_PROMPT, buildSectionPrompt } from "@/lib/harness/agents/f6-write";

import { searchArxiv } from "@/lib/harness/tools/arxiv";

const SECTIONS = ["title", "abstract", "introduction", "background", "methodology", "results", "discussion", "conclusion"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const gate = await assertStageOpen(params.id, "F6").catch((e) => e);
  if (gate instanceof GateError)
    return NextResponse.json(errorEnvelope("STAGE_LOCKED", gate.message), { status: 403 });

  // Load context
  const f2State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F2" } },
  });
  const f2Data = f2State ? JSON.parse(f2State.data || "{}") : {};

  const f4Report = await prisma.artifact.findFirst({
    where: { projectId: params.id, stage: "F4", kind: "VALIDATION_REPORT" },
  });
  const methodology = f4Report ? JSON.parse(f4Report.content)?.finalizedMethodology ?? "" : "";

  const f3Papers = await prisma.paperRef.findMany({
    where: { projectId: params.id, stage: "F3" },
    orderBy: { createdAt: "asc" },
  });

  const experiments = await prisma.experimentLog.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });

  const f6State = await prisma.stageState.findUnique({
    where: { projectId_stage: { projectId: params.id, stage: "F6" } },
  });
  const f6Data = f6State ? JSON.parse(f6State.data || "{}") : {};

  if (action === "generate") {
    const raw = String(body.section ?? "").trim().toLowerCase();
    const section = raw.replace(/\s+/g, "-").slice(0, 40) || "abstract";

    try {
      const prompt = buildSectionPrompt({
        section,
        topicTitle: f2Data.topic?.title ?? "",
        methodology,
        researchQuestions: f2Data.topic?.researchQuestions ?? [],
        experiments: experiments.map((e) => ({ name: e.name, hypothesis: e.hypothesis, result: e.result, learning: e.learning })),
        papers: f3Papers.map((p) => ({ title: p.title, authors: p.authors.split(", ").filter(Boolean), year: p.year, extId: p.extId })),
        gaps: f2Data.gaps ?? [],
      });

      const result = await chatComplete(
        [{ role: "system", content: F6_SYSTEM_PROMPT }, { role: "user", content: prompt }],
        { maxTokens: 1500 }
      );

      // Save generated section
      const sections = f6Data.sections ?? {};
      sections[section] = result;

      await prisma.stageState.upsert({
        where: { projectId_stage: { projectId: params.id, stage: "F6" } },
        update: { data: JSON.stringify({ ...f6Data, sections }) },
        create: {
          projectId: params.id,
          stage: "F6",
          status: "ACTIVE",
          data: JSON.stringify({ sections }),
        },
      });

      return NextResponse.json({ section, content: result });
    } catch (e: any) {
      return NextResponse.json({ error: { message: e?.message ?? "Generation failed" } }, { status: 502 });
    }
  }

  if (action === "identifyReferences") {
    const text = body.text as string;
    if (!text || text.trim().length < 20) {
      return NextResponse.json({ error: { message: "Paste at least a few sentences for reference identification." } }, { status: 400 });
    }

    try {
      const papersList = f3Papers.map((p) =>
        `ID: ${p.extId}\nTitle: ${p.title}\nAuthors: ${p.authors}\nYear: ${p.year}\nAbstract: ${p.abstract.slice(0, 500)}`
      ).join("\n---\n");

      const prompt = `Given the following text excerpt from the user's paper, identify which papers from the list below are referenced or used. Return JSON: { "matches": [{ "extId": "...", "reason": "why this paper matches" }] }

USER TEXT:
${text.slice(0, 6000)}

AVAILABLE PAPERS:
${papersList}

Only include papers that are clearly referenced or whose content is used. Be precise.`;

      const result = await chatComplete(
        [{ role: "system", content: "You are a citation identification assistant. Match text to papers precisely." }, { role: "user", content: prompt }],
        { maxTokens: 1024 }
      );

      let parsed: { matches: Array<{ extId: string; reason: string }> };
      try {
        parsed = JSON.parse(result);
      } catch {
        const match = result.match(/\{[\s\S]*"matches"[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else return NextResponse.json({ matches: [] });
      }

      // Enrich matches with full paper data
      const enriched = (parsed.matches ?? []).map((m) => {
        const paper = f3Papers.find((p) => p.extId === m.extId);
        return {
          extId: m.extId,
          reason: m.reason,
          title: paper?.title ?? "",
          authors: paper?.authors ?? "",
          year: paper?.year ?? 0,
          url: paper?.url ?? "",
        };
      }).filter((m) => m.title);

      return NextResponse.json({ matches: enriched });
    } catch (e: any) {
      return NextResponse.json({ error: { message: e?.message ?? "Identification failed" } }, { status: 502 });
    }
  }

  if (action === "suggestReferences") {
    const text = body.text as string;
    const section = (body.section as string) ?? "";
    if (!text || text.trim().length < 20) {
      return NextResponse.json({ error: { message: "Provide at least a few sentences of draft text." } }, { status: 400 });
    }

    try {
      // 1) LLM extracts 2-4 focused arXiv search queries from the user's draft text.
      const extractPrompt = `The user is drafting the "${section || "paper"}" section of a research paper. From their draft text below, extract 2-4 focused search queries (each 3-8 keywords, NO quotes) that capture the specific papers/concepts their content builds on. Return ONLY JSON: { "queries": ["..."] }

DRAFT TEXT:
${text.slice(0, 6000)}

Queries should target the papers whose content the user used — prior methods they extend, baselines they compare to, datasets they build on.`;
      const extracted = await chatComplete(
        [{ role: "system", content: "You extract precise literature search queries. Return JSON only." }, { role: "user", content: extractPrompt }],
        { maxTokens: 256 }
      );
      let queries: string[] = [];
      try {
        queries = JSON.parse(extracted).queries ?? [];
      } catch {
        const m = extracted.match(/\{[\s\S]*"queries"[\s\S]*\}/);
        if (m) queries = JSON.parse(m[0]).queries ?? [];
      }
      queries = queries.filter((q) => typeof q === "string" && q.trim().length > 2).slice(0, 4);
      if (queries.length === 0) {
        // Fallback: derive keywords directly from the draft text.
        const words = text.replace(/[^a-zA-Z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 4).slice(0, 12);
        if (words.length > 2) queries = [words.slice(0, 6).join(" ")];
      }

      // 2) Run each query against LIVE arXiv — every suggestion is a real paper.
      const seen = new Set(f3Papers.map((p) => p.extId));
      const suggestions: Array<{ extId: string; title: string; authors: string; year: number; url: string; abstract: string; reason: string }> = [];
      for (const q of queries) {
        let found: Awaited<ReturnType<typeof searchArxiv>> = [];
        try {
          found = await searchArxiv(q, 3);
        } catch {
          continue;
        }
        for (const p of found) {
          if (seen.has(p.extId)) continue;
          seen.add(p.extId);
          suggestions.push({
            extId: p.extId,
            title: p.title,
            authors: p.authors.join(", "),
            year: p.year,
            url: p.url,
            abstract: p.abstract.slice(0, 600),
            reason: `Matches your ${section || "draft"} content via "${q}"`,
          });
        }
        if (suggestions.length >= 8) break;
      }

      return NextResponse.json({ queries, suggestions });
    } catch (e: any) {
      return NextResponse.json({ error: { message: e?.message ?? "Suggestion failed" } }, { status: 502 });
    }
  }

  if (action === "saveReferences") {
    const refs = body.references as Array<{ authors: string; year: string; title: string; venue: string; url: string; cited: boolean }> | undefined;
    if (!refs) {
      return NextResponse.json({ error: { message: "references required" } }, { status: 400 });
    }
    const cited = refs.filter((r) => r.cited);
    const refBlock = cited.map((r, i) => `[${i + 1}] ${r.authors} (${r.year}). ${r.title}. ${r.venue}. ${r.url}`).join("\n");
    const sections = f6Data.sections ?? {};
    sections["references"] = refBlock;

    await prisma.stageState.upsert({
      where: { projectId_stage: { projectId: params.id, stage: "F6" } },
      update: { data: JSON.stringify({ ...f6Data, sections, references: refs }) },
      create: {
        projectId: params.id,
        stage: "F6",
        status: "ACTIVE",
        data: JSON.stringify({ sections, references: refs }),
      },
    });

    return NextResponse.json({ ok: true, cited: cited.length });
  }

  if (action === "saveSection") {
    const raw = String(body.section ?? "").trim().toLowerCase();
    const section = raw.replace(/\s+/g, "-").slice(0, 40);
    const content = typeof body.content === "string" ? body.content : "";
    if (!section) {
      return NextResponse.json({ error: { message: "section required" } }, { status: 400 });
    }
    const sections = f6Data.sections ?? {};
    sections[section] = content;
    await prisma.stageState.upsert({
      where: { projectId_stage: { projectId: params.id, stage: "F6" } },
      update: { data: JSON.stringify({ ...f6Data, sections }) },
      create: {
        projectId: params.id,
        stage: "F6",
        status: "ACTIVE",
        data: JSON.stringify({ sections }),
      },
    });
    return NextResponse.json({ ok: true, section });
  }

  if (action === "complete") {
    const sections = f6Data.sections ?? {};
    if (Object.keys(sections).length < 3) {
      return NextResponse.json({ error: { message: "Generate at least 3 sections before completing." } }, { status: 400 });
    }

    await prisma.artifact.upsert({
      where: { projectId_stage_kind: { projectId: params.id, stage: "F6", kind: "PAPER_DRAFT" } },
      update: { content: JSON.stringify(sections) },
      create: {
        projectId: params.id,
        stage: "F6",
        kind: "PAPER_DRAFT",
        title: "Paper Draft",
        content: JSON.stringify(sections),
      },
    });

    await completeStage(params.id, "F6");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: { message: "Unknown action" } }, { status: 400 });
}
