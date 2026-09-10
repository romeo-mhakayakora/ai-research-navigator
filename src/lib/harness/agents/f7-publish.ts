export const F7_SYSTEM_PROMPT = `You are a publication advisor helping a researcher choose where to publish their paper. Recommend ONLY real, well-known venues appropriate to their work — NEVER invent venues, deadlines, or acceptance rates.

RULES:
- Suggest real venues (conferences, journals, workshops) that genuinely fit the topic and paper type.
- Give deadline PATTERNS (typical month/season) and tell the user to verify exact dates on the official site — NEVER state exact dates as facts.
- Give acceptance-rate BANDS (e.g. "typically ~20-25%") only for well-known venues; otherwise say "varies — check the official site".
- Explain WHY each venue fits their specific work (topic match, audience, level-appropriateness for the researcher's experience).
- Include at least one beginner-friendly option (workshop, national conference, or accessible journal) when the researcher is early-career.
- Flag risks honestly (highly competitive, long review cycles, formatting demands).

OUTPUT FORMAT: Return a JSON array (no prose, no fences) of 5-8 venues:
[{"name": "...", "type": "conference" | "journal" | "workshop", "deadlinePattern": "typically ... (verify on official site)", "acceptanceBand": "...", "fit": "why this fits THEIR work", "risk": "honest caveat"}]`;

export function buildVenuePrompt(args: {
  title: string;
  abstract: string;
  topicTitle: string;
  paperType: string;
  openAccess: boolean;
  experienceLevel: string;
}): string {
  return `Recommend publication venues for this paper.

Paper title: ${args.title || "(untitled)"}
Abstract:
${args.abstract || "(no abstract drafted yet)"}

Research topic: ${args.topicTitle}
Preferred venue type: ${args.paperType}
Open-access preferred: ${args.openAccess ? "yes" : "no preference"}
Researcher experience level: ${args.experienceLevel}

Return ONLY the JSON array of 5-8 venues, no prose.`;
}

export const CHECKLIST_TEMPLATES: Record<string, string[]> = {
  conference: [
    "Use the venue's official template (check formatting guidelines)",
    "Respect the page limit including references",
    "Anonymize the submission if double-blind review applies",
    "Write a clear abstract stating problem, method, and results",
    "Include all figures/tables with captions, referenced in text",
    "Prepare supplementary material (code, data, appendix) if allowed",
    "Add an ethics / limitations statement if required",
    "Proofread for grammar, notation consistency, and citation format",
    "Verify every in-text citation has a matching reference entry",
    "Confirm author list, order, and affiliations with co-authors",
  ],
  journal: [
    "Use the journal's official template (check author guidelines)",
    "Write a cover letter summarizing the contribution and fit",
    "Suggest potential reviewers if the journal requests it",
    "Include ethics approval / data availability statements",
    "Ensure figures meet resolution requirements",
    "Verify every in-text citation has a matching reference entry",
    "Confirm author list, order, affiliations, and corresponding author",
    "Check for prior-preprint policy compliance (e.g. arXiv posting)",
    "Proofread for grammar, notation consistency, and citation format",
    "Prepare a response plan for likely reviewer questions",
  ],
  workshop: [
    "Check the workshop's page limit (often shorter, 4-6 pages)",
    "Use the parent conference template unless stated otherwise",
    "State clearly what is preliminary vs. completed work",
    "Anonymize if double-blind review applies",
    "Verify every in-text citation has a matching reference entry",
    "Confirm author list and affiliations",
    "Proofread for grammar and clarity",
  ],
};
