import { callProvider } from "@/lib/ai-call";
import type { AiProvider } from "@/types";

export interface SuggestedTag {
  slug: string;
  label: string;
  reason: string;
}

interface DiscoverTagsRequest {
  articles: { title: string; description: string }[];
  existingTags: { slug: string; label: string }[];
  provider: AiProvider;
  apiKey: string;
  model: string;
}

const SLUG_RE = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

function buildPrompt(
  articles: DiscoverTagsRequest["articles"],
  existingTags: DiscoverTagsRequest["existingTags"]
): string {
  const tagList = existingTags.map((t) => `${t.slug} (${t.label})`).join(", ");
  const articleBlock = articles
    .slice(0, 20)
    .map((a) => `- ${a.title}: ${a.description}`)
    .join("\n");

  return `You are a news category analyst. Review these article titles and suggest 1-5 NEW broad, top-level tag categories that are NOT already covered by the existing tags.

IMPORTANT: Suggest broad categories, NOT narrow or niche topics. Think like a newspaper section header.
- GOOD: "Education", "Politics", "Real Estate", "Travel", "Food"
- BAD: "Sports News" (too specific — just "Sports"), "Geopolitics" (too academic — "Politics" or "World"), "AI Ethics" (too narrow — covered by "AI"), "Electric Cars" (too narrow — covered by "EVs")

Existing tags: ${tagList}

Sample articles:
${articleBlock}

For each new category, provide:
- "slug": lowercase, hyphens only, 3-30 chars (e.g. "education", "politics")
- "label": Short display name, 1-2 words max (e.g. "Education", "Politics")
- "reason": Brief explanation of why this category is needed

Only suggest categories that would apply to multiple articles. Do NOT suggest tags that overlap with existing ones.

Respond with ONLY a JSON array. No other text.
Example: [{"slug": "education", "label": "Education", "reason": "Multiple articles cover school policy and teaching methods"}]`;
}

function parseResponse(
  raw: string,
  existingSlugs: Set<string>
): SuggestedTag[] {
  let jsonStr = raw.trim();

  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrMatch) return [];
    try {
      parsed = JSON.parse(arrMatch[0]);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    if (typeof parsed === "object" && parsed !== null) {
      const values = Object.values(parsed as Record<string, unknown>);
      const arr = values.find((v) => Array.isArray(v));
      if (arr) parsed = arr;
      else return [];
    } else {
      return [];
    }
  }

  const results: SuggestedTag[] = [];
  const seenSlugs = new Set<string>();

  for (const entry of parsed as unknown[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;

    const slug = typeof e.slug === "string" ? e.slug.trim().toLowerCase() : "";
    const label = typeof e.label === "string" ? e.label.trim() : "";
    const reason = typeof e.reason === "string" ? e.reason.trim() : "";

    if (!slug || !label) continue;
    if (!SLUG_RE.test(slug)) continue;
    if (existingSlugs.has(slug)) continue;
    if (seenSlugs.has(slug)) continue;

    seenSlugs.add(slug);
    results.push({ slug, label, reason });
  }

  return results.slice(0, 5);
}

export async function discoverNewTags(
  request: DiscoverTagsRequest
): Promise<SuggestedTag[]> {
  const { articles, existingTags, provider, apiKey, model } = request;
  const prompt = buildPrompt(articles, existingTags);
  const raw = await callProvider(prompt, provider, apiKey, model);
  const existingSlugs = new Set(existingTags.map((t) => t.slug));
  return parseResponse(raw, existingSlugs);
}
