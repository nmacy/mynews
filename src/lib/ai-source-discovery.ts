import { callProvider } from "@/lib/ai-call";
import type { AiProvider } from "@/types";

export interface AiSourceSuggestion {
  name: string;
  domain: string;
  paywalled: boolean;
}

interface DiscoverRequest {
  query: string;
  provider: AiProvider;
  apiKey: string;
  model: string;
}

const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

function buildPrompt(query: string): string {
  return `You are a news source discovery assistant. The user is searching for: "${query}"

Consider BOTH interpretations of this query:
1. It could be a publication NAME (e.g. "atlantic" → The Atlantic magazine)
2. It could be a TOPIC (e.g. "atlantic" → sources covering Atlantic Ocean, Atlantic region)

Prioritize the name interpretation if there is a well-known publication matching the query.

Return a JSON array of 5-10 well-known, real news publications. Each entry must have:
- "name": The full publication name (e.g. "The Atlantic")
- "domain": The publication's main website domain (e.g. "theatlantic.com")
- "paywalled": boolean, true if the source requires a paid subscription

IMPORTANT: Only provide the domain name, NOT full URLs. I will discover the RSS feeds myself.
Only include real, well-known publications. Do not invent publications.

Respond with ONLY a JSON array. No other text.
Example: [{"name": "The Atlantic", "domain": "theatlantic.com", "paywalled": true}, {"name": "TechCrunch", "domain": "techcrunch.com", "paywalled": false}]`;
}

function parseResponse(raw: string): AiSourceSuggestion[] {
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
      if (arr) {
        parsed = arr;
      } else {
        return [];
      }
    } else {
      return [];
    }
  }

  const suggestions: AiSourceSuggestion[] = [];
  const seenDomains = new Set<string>();

  for (const entry of parsed as unknown[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;

    const name = typeof e.name === "string" ? e.name.trim() : "";
    let domain = typeof e.domain === "string" ? e.domain.trim().toLowerCase() : "";
    if (!name || !domain) continue;

    // Strip protocol if AI included it
    domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    if (!DOMAIN_REGEX.test(domain)) continue;
    if (seenDomains.has(domain)) continue;
    seenDomains.add(domain);

    suggestions.push({
      name,
      domain,
      paywalled: e.paywalled === true,
    });
  }

  return suggestions;
}

export async function discoverSources(
  request: DiscoverRequest,
): Promise<AiSourceSuggestion[]> {
  const { query, provider, apiKey, model } = request;
  const prompt = buildPrompt(query);
  const raw = await callProvider(prompt, provider, apiKey, model);
  return parseResponse(raw);
}
