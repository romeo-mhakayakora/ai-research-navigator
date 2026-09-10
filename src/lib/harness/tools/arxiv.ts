// arXiv API search tool — returns REAL papers only (no LLM-invented citations).
// Docs: http://export.arxiv.org/api/query (Atom XML, no key required).
export type ArxivPaper = {
  title: string;
  authors: string[];
  year: number;
  venue: string;
  abstract: string;
  url: string;
  extId: string;
};

function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return (m?.[1] ?? "").trim().replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
}

export async function searchArxiv(query: string, maxResults = 3): Promise<ArxivPaper[]> {
  // arXiv's API mishandles quoted phrases in all: — AND the terms instead.
  const terms = query
    .replace(/["']/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((w) => `all:${w}`)
    .join("+AND+");
  if (!terms) return [];
  const url =
    `https://export.arxiv.org/api/query?search_query=${terms}` +
    `&start=0&max_results=${maxResults}&sortBy=relevance`;
  const res = await fetch(url, { headers: { "User-Agent": "ai-research-navigator/0.1" } });
  if (!res.ok) throw new Error(`arXiv search failed (${res.status})`);
  const xml = await res.text();
  return xml.split("<entry>").slice(1).map((entryXml) => {
    const title = pick(entryXml, "title");
    const authors = Array.from(entryXml.matchAll(/<name>([\s\S]*?)<\/name>/g)).map((m) =>
      m[1].trim()
    );
    const published = pick(entryXml, "published");
    const idUrl = pick(entryXml, "id");
    return {
      title,
      authors,
      year: published ? new Date(published).getFullYear() : 0,
      venue: "arXiv",
      abstract: pick(entryXml, "summary").slice(0, 1200),
      url: idUrl,
      extId: idUrl.split("/abs/")[1] ?? idUrl,
    };
  });
}
