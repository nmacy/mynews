import { AI_PROVIDER_MAP } from "@/config/ai-providers";
import type { AiProvider } from "@/types";

export async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
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

export async function callOpenAiCompatible(
  prompt: string,
  apiKey: string,
  model: string,
  endpoint: string
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
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

export async function callGemini(
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  if (!/^[a-zA-Z0-9._\-/]+$/.test(model)) {
    throw new Error("Invalid model name");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
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

/**
 * Call an AI provider with a prompt and return the raw text response.
 */
export async function callProvider(
  prompt: string,
  provider: AiProvider,
  apiKey: string,
  model: string
): Promise<string> {
  const providerDef = AI_PROVIDER_MAP.get(provider);
  if (!providerDef) throw new Error(`Unknown provider: ${provider}`);

  switch (provider) {
    case "anthropic":
      return callAnthropic(prompt, apiKey, model);
    case "openai":
    case "openrouter":
      return callOpenAiCompatible(prompt, apiKey, model, providerDef.endpoint);
    case "gemini":
      return callGemini(prompt, apiKey, model);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
