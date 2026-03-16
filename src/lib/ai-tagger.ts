import { TAG_DEFINITIONS } from "@/config/tags";
import { callProvider } from "@/lib/ai-call";
import type { AiProvider } from "@/types";

const MAX_TAGS_PER_ARTICLE = 3;

interface TagRequest {
  articles: { id: string; title: string; description: string }[];
  allTags?: { slug: string; label: string }[];
  provider: AiProvider;
  apiKey: string;
  model: string;
}

function buildPrompt(articles: TagRequest["articles"], tagList: string): string {
  const articleBlock = articles
    .map((a) => `- ID: ${a.id}\n  Title: ${a.title}\n  Description: ${a.description}`)
    .join("\n");

  return `You are a news article tagger. Your job is to identify each article's PRIMARY subject matter — what the article is fundamentally about, not topics it briefly mentions.

Rules:
- Assign 1-${MAX_TAGS_PER_ARTICLE} tags per article from ONLY these tags: ${tagList}.
- Only tag the CORE topic(s) the article is centrally about. If an article mentions technology in passing but is really about politics, tag it politics — NOT technology.
- Prefer specific tags over broad ones. For example, use "ai" instead of "technology" if the article is specifically about AI. Only use "technology" if the article is broadly about the tech industry itself.
- When in doubt, fewer tags are better. An article with 1 accurate tag is better than 3 loosely-related tags.

Also assign a relevance score from 1-10 for each article:
- 10: Major breaking news with broad impact
- 7-9: Important developments, significant announcements
- 4-6: Standard news coverage, routine updates
- 1-3: Minor, niche, or low-impact stories

Articles:
${articleBlock}

Respond with ONLY a JSON object mapping article IDs to objects with "tags" and "score". No other text.
Example: {"abc123": {"tags": ["ai"], "score": 8}, "def456": {"tags": ["economy"], "score": 5}}`;
}

export interface AiTagResult {
  tags: string[];
  score: number;
}

function extractTagMapWithScores(
  obj: Record<string, unknown>,
  validSlugs: Set<string>
): Record<string, AiTagResult> {
  const result: Record<string, AiTagResult> = {};

  for (const [id, entry] of Object.entries(obj)) {
    // New format: {"id": {"tags": [...], "score": N}}
    if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
      const e = entry as Record<string, unknown>;
      const tags = Array.isArray(e.tags) ? e.tags : [];
      const valid = tags
        .filter((t): t is string => typeof t === "string" && validSlugs.has(t))
        .slice(0, MAX_TAGS_PER_ARTICLE);
      const score = typeof e.score === "number" ? Math.max(1, Math.min(10, Math.round(e.score))) : 5;
      if (valid.length > 0) {
        result[id] = { tags: valid, score };
      }
      continue;
    }
    // Legacy format: {"id": ["tag1", "tag2"]}
    if (Array.isArray(entry)) {
      const valid = entry
        .filter((t): t is string => typeof t === "string" && validSlugs.has(t))
        .slice(0, MAX_TAGS_PER_ARTICLE);
      if (valid.length > 0) {
        result[id] = { tags: valid, score: 5 };
      }
    }
  }

  return result;
}

function parseAndValidate(raw: string, validSlugs: Set<string>): Record<string, AiTagResult> {
  // Extract JSON from potential markdown code blocks
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Try to find JSON object in the response
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!objMatch) return {};
    try {
      parsed = JSON.parse(objMatch[0]);
    } catch {
      return {};
    }
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const obj = parsed as Record<string, unknown>;

  // Try direct extraction first
  const direct = extractTagMapWithScores(obj, validSlugs);
  if (Object.keys(direct).length > 0) return direct;

  // AI may wrap response in a key like "tags", "result", etc — try unwrapping one level
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = extractTagMapWithScores(value as Record<string, unknown>, validSlugs);
      if (Object.keys(nested).length > 0) return nested;
    }
  }

  return {};
}

export async function tagArticlesWithAi(
  request: TagRequest
): Promise<Record<string, AiTagResult>> {
  const { articles, allTags, provider, apiKey, model } = request;

  const tags = allTags ?? TAG_DEFINITIONS.map((t) => ({ slug: t.slug, label: t.label }));
  const validSlugs = new Set(tags.map((t) => t.slug));
  const tagList = tags.map((t) => `${t.slug} (${t.label})`).join(", ");

  const prompt = buildPrompt(articles, tagList);
  const raw = await callProvider(prompt, provider, apiKey, model);
  return parseAndValidate(raw, validSlugs);
}
