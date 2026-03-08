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

Articles:
${articleBlock}

Respond with ONLY a JSON object mapping article IDs to arrays of tag slugs. No other text.
Example: {"abc123": ["ai"], "def456": ["economy"]}`;
}

function extractTagMap(obj: Record<string, unknown>, validSlugs: Set<string>): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const [id, tags] of Object.entries(obj)) {
    if (!Array.isArray(tags)) continue;
    const valid = tags
      .filter((t): t is string => typeof t === "string" && validSlugs.has(t))
      .slice(0, MAX_TAGS_PER_ARTICLE);
    if (valid.length > 0) {
      result[id] = valid;
    }
  }

  return result;
}

function parseAndValidate(raw: string, validSlugs: Set<string>): Record<string, string[]> {
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

  // Try direct extraction first (expected format: {"articleId": ["tag1", "tag2"]})
  const direct = extractTagMap(obj, validSlugs);
  if (Object.keys(direct).length > 0) return direct;

  // AI may wrap response in a key like "tags", "result", etc — try unwrapping one level
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = extractTagMap(value as Record<string, unknown>, validSlugs);
      if (Object.keys(nested).length > 0) return nested;
    }
  }

  return {};
}

export async function tagArticlesWithAi(
  request: TagRequest
): Promise<Record<string, string[]>> {
  const { articles, allTags, provider, apiKey, model } = request;

  const tags = allTags ?? TAG_DEFINITIONS.map((t) => ({ slug: t.slug, label: t.label }));
  const validSlugs = new Set(tags.map((t) => t.slug));
  const tagList = tags.map((t) => `${t.slug} (${t.label})`).join(", ");

  const prompt = buildPrompt(articles, tagList);
  const raw = await callProvider(prompt, provider, apiKey, model);
  return parseAndValidate(raw, validSlugs);
}
