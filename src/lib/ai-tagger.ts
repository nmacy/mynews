import { TAG_DEFINITIONS } from "@/config/tags";
import { AI_PROVIDER_MAP } from "@/config/ai-providers";
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

async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function callOpenAiCompatible(
  prompt: string,
  apiKey: string,
  model: string,
  endpoint: string
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  // Validate model name to prevent URL path traversal
  if (!/^[a-zA-Z0-9._\-/]+$/.test(model)) {
    throw new Error("Invalid model name");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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
  const providerDef = AI_PROVIDER_MAP.get(provider);
  if (!providerDef) throw new Error(`Unknown provider: ${provider}`);

  const prompt = buildPrompt(articles);
  let raw: string;

  switch (provider) {
    case "anthropic":
      raw = await callAnthropic(prompt, apiKey, model);
      break;
    case "openai":
      raw = await callOpenAiCompatible(prompt, apiKey, model, providerDef.endpoint);
      break;
    case "openrouter":
      raw = await callOpenAiCompatible(prompt, apiKey, model, providerDef.endpoint);
      break;
    case "gemini":
      raw = await callGemini(prompt, apiKey, model);
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  return parseAndValidate(raw);
}
