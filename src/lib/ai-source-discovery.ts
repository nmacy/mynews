import { callProvider } from "@/lib/ai-call";
import type { AiProvider, LibrarySource } from "@/types";

interface DiscoverRequest {
  query: string;
  provider: AiProvider;
  apiKey: string;
  model: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildPrompt(query: string): string {
  return `You are a news source discovery assistant. The user is looking for news sources about: "${query}"

Return a JSON array of 5-10 well-known, real news sources that cover this topic. Each entry must have:
- "name": The publication name (e.g. "TechCrunch")
- "url": A valid RSS feed URL or a news/blog listing page URL for that source
- "paywalled": boolean, true if the source requires a subscription

Prefer RSS feed URLs when available. When a source does not have an RSS feed, you may provide the URL of their news or blog listing page instead (e.g. a page that lists recent articles with links).

Only include real, well-known publications. Do not invent sources or URLs.

Respond with ONLY a JSON array. No other text.
Example: [{"name": "TechCrunch", "url": "https://techcrunch.com/feed/", "paywalled": false}, {"name": "Anthropic News", "url": "https://www.anthropic.com/news/", "paywalled": false}]`;
}

function parseResponse(raw: string, query: string): LibrarySource[] {
  let jsonStr = raw.trim();

  // Extract JSON from potential markdown code blocks
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Try to find JSON array in the response
    const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrMatch) return [];
    try {
      parsed = JSON.parse(arrMatch[0]);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    // AI may wrap in an object like { "sources": [...] }
    if (typeof parsed === "object" && parsed !== null) {
      const values = Object.values(parsed as Record<string, unknown>);
      const arr = values.find((v) => Array.isArray(v));
      if (arr) {
        parsed = arr;
      } else {
        return [];
      }
    } else {
      return [];
    }
  }

  const category =
    query.trim().charAt(0).toUpperCase() + query.trim().slice(1);

  const sources: LibrarySource[] = [];
  const seenUrls = new Set<string>();

  for (const entry of parsed as unknown[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;

    const name = typeof e.name === "string" ? e.name.trim() : "";
    const url = typeof e.url === "string" ? e.url.trim() : "";
    if (!name || !url) continue;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      continue;
    }

    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    sources.push({
      id: slugify(name) || `source-${sources.length}`,
      name,
      url,
      priority: 2,
      paywalled: e.paywalled === true,
      category,
    });
  }

  return sources;
}

export async function discoverSources(
  request: DiscoverRequest
): Promise<LibrarySource[]> {
  const { query, provider, apiKey, model } = request;
  const prompt = buildPrompt(query);
  const raw = await callProvider(prompt, provider, apiKey, model);
  return parseResponse(raw, query);
}
