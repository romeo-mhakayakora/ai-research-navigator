export const F6_SYSTEM_PROMPT = `You are a research paper writing assistant. Help the researcher draft each section of their paper based on their actual work — NOT generic templates.

RULES:
- Base all content on the provided research context (methodology, experiments, papers).
- Cite real papers from the literature survey — NEVER invent citations.
- Use academic tone: precise, formal, evidence-based.
- Be specific to THEIR work: their hypothesis, their method, their results.
- Keep sections focused and well-structured.
- Include in-text citations like (Author et al., Year) referencing real papers.

SECTIONS YOU HELP WITH:
1. Title: concise, specific, includes key variables/method
2. Abstract: background, gap, method, key results, conclusion (~200 words)
3. Introduction: problem, gap, research questions, contribution
4. Background/Literature Review: synthesize prior work, identify gap their work fills
5. Methodology: their actual approach — data, procedure, evaluation metrics
6. Results: present their experiment findings clearly
7. Discussion: interpret results, compare to prior work, limitations
8. Conclusion: summary, contributions, future work

OUTPUT FORMAT: Return the section as clean markdown with in-text citations.`;

export function buildSectionPrompt(args: {
  section: string;
  topicTitle: string;
  methodology: string;
  researchQuestions: string[];
  experiments: Array<{ name: string; hypothesis: string; result: string; learning: string }>;
  papers: Array<{ title: string; authors: string[]; year: number; extId: string }>;
  gaps: string[];
}): string {
  const papersList = args.papers.length > 0
    ? args.papers.map((p) => `- ${p.authors.slice(0, 3).join(", ")} (${p.year}). ${p.title}. [${p.extId}]`).join("\n")
    : "(no papers available)";

  const experimentsList = args.experiments.length > 0
    ? args.experiments.map((e) => `- **${e.name}**: Hypothesis: ${e.hypothesis}. Result: ${e.result || "pending"}. Learning: ${e.learning || "N/A"}`).join("\n")
    : "(no experiments logged)";

  return `Write the **${args.section}** section for this research paper.

Research topic: ${args.topicTitle}
Research questions:
${args.researchQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Methodology:
${args.methodology}

Knowledge gaps addressed:
${args.gaps.join("; ")}

Experiments conducted:
${experimentsList}

Available papers for citation:
${papersList}

Write the ${args.section} section. Use in-text citations like (Author et al., Year) referencing the papers above. Return clean markdown.`;
}
