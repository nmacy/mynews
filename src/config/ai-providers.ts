import type { AiProvider } from "@/types";

export interface AiProviderDefinition {
  id: AiProvider;
  label: string;
  defaultModel: string;
  models: string[];
  endpoint: string;
}

export const AI_PROVIDERS: AiProviderDefinition[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-haiku-4-5-20251001",
    models: [
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-6-20250514",
      "claude-sonnet-4-5-20250514",
    ],
    endpoint: "https://api.anthropic.com/v1/messages",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1-nano"],
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"],
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "anthropic/claude-haiku-4-5-20251001",
    models: [
      "anthropic/claude-haiku-4-5-20251001",
      "openai/gpt-4o-mini",
      "google/gemini-2.0-flash-001",
    ],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
  },
];

export const AI_PROVIDER_MAP = new Map<AiProvider, AiProviderDefinition>(
  AI_PROVIDERS.map((p) => [p.id, p])
);
