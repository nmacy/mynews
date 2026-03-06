import { TAG_DEFINITIONS } from "@/config/tags";
import { callProvider } from "@/lib/ai-call";
import type { AiProvider } from "@/types";

const VALID_SLUGS = new Set(TAG_DEFINITIONS.map((t) => t.slug));
const MAX_TAGS_PER_ARTICLE = 3;

interface TagRequest {
  articles: { id: string; title: string; description: string }[];
  provider: AiProvider;
  apiKey: string;
  model: string;
}

const TAG_LIST = TAG_DEFINITIONS.map((t) => `${t.slug} (${t.label})`).join(", ");

function buildPrompt(articles: TagRequest["articles"]): string {
  const articleBlock = articles
    .map((a) => `- ID: ${a.id}\n  Title: ${a.title}\n  Description: ${a.description}`)
    .join("\n");

  return `You are a news article tagger. Assign up to ${MAX_TAGS_PER_ARTICLE} tags to each article from ONLY these tags: ${TAG_LIST}.

Articles:
${articleBlock}

Respond with ONLY a JSON object mapping article IDs to arrays of tag slugs. No other text.
Example: {"abc123": ["ai", "privacy"], "def456": ["economy"]}`;
}

function extractTagMap(obj: Record<string, unknown>): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const [id, tags] of Object.entries(obj)) {
    if (!Array.isArray(tags)) continue;
    const valid = tags
      .filter((t): t is string => typeof t === "string" && VALID_SLUGS.has(t))
      .slice(0, MAX_TAGS_PER_ARTICLE);
    if (valid.length > 0) {
      result[id] = valid;
    }
  }

  return result;
}

function parseAndValidate(raw: string): Record<string, string[]> {
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
  const direct = extractTagMap(obj);
  if (Object.keys(direct).length > 0) return direct;

  // AI may wrap response in a key like "tags", "result", etc — try unwrapping one level
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = extractTagMap(value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) return nested;
    }
  }

  return {};
}

export async function tagArticlesWithAi(
  request: TagRequest
): Promise<Record<string, string[]>> {
  const { articles, provider, apiKey, model } = request;
  const prompt = buildPrompt(articles);
  const raw = await callProvider(prompt, provider, apiKey, model);
  return parseAndValidate(raw);
}
