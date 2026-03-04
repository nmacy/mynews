"use client";

import { useEffect, useRef, useState } from "react";
import { AI_PROVIDER_MAP } from "@/config/ai-providers";
import type { AiTaggerConfig, Article } from "@/types";

const STORAGE_KEY = "mynews-tagger-config";

const DEFAULT_CONFIG: AiTaggerConfig = {
  enabled: false,
  provider: "anthropic",
  apiKey: "",
  model: "claude-haiku-4-5-20251001",
};

export function loadTaggerConfig(): AiTaggerConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveTaggerConfig(config: AiTaggerConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

const TAG_CACHE_KEY = "mynews-ai-tags";

function loadTagCache(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TAG_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToTagCache(newTags: Record<string, string[]>): void {
  try {
    const existing = loadTagCache();
    localStorage.setItem(
      TAG_CACHE_KEY,
      JSON.stringify({ ...existing, ...newTags })
    );
  } catch {
    // localStorage full or unavailable — ignore
  }
}

const BATCH_SIZE = 20;

function hashIds(articles: Article[]): string {
  return articles.map((a) => a.id).join(",");
}

async function fetchBatch(
  articles: Article[],
  config: { provider: string; apiKey: string; model: string },
  signal: AbortSignal
): Promise<Record<string, string[]>> {
  const res = await fetch("/api/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
      })),
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    }),
    signal,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `API returned ${res.status}`);
  if (data.error) console.warn("[ai-tagger]", data.error);
  return data.tags ?? {};
}

async function tagAllBatches(
  articles: Article[],
  config: { provider: string; apiKey: string; model: string },
  signal: AbortSignal
): Promise<Record<string, string[]>> {
  const allTags: Record<string, string[]> = {};

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    if (signal.aborted) break;
    const chunk = articles.slice(i, i + BATCH_SIZE);
    try {
      const tags = await fetchBatch(chunk, config, signal);
      Object.assign(allTags, tags);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      console.warn(`[ai-tagger] Batch ${i / BATCH_SIZE + 1} failed:`, err);
      // Continue with remaining batches instead of losing everything
    }
  }

  return allTags;
}

export function useAiTagger(articles: Article[]): {
  articles: Article[];
  isTagging: boolean;
  error: string | null;
} {
  const [aiTags, setAiTags] = useState<Record<string, string[]>>(loadTagCache);
  const [isTagging, setIsTagging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastBatchRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (articles.length === 0) return;

    const config = loadTaggerConfig();
    if (!config.enabled || !config.apiKey) return;

    const model = config.model || AI_PROVIDER_MAP.get(config.provider)?.defaultModel;
    if (!model) return;

    const batchHash = hashIds(articles);
    if (batchHash === lastBatchRef.current) return;

    const cached = loadTagCache();
    const uncached = articles.filter((a) => !cached[a.id]);

    // All articles already cached — no API call needed
    if (uncached.length === 0) {
      lastBatchRef.current = batchHash;
      setAiTags((prev) => ({ ...prev, ...cached }));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsTagging(true);
    setError(null);

    const batchConfig = { provider: config.provider, apiKey: config.apiKey, model };

    tagAllBatches(uncached, batchConfig, controller.signal)
      .then((tags) => {
        lastBatchRef.current = batchHash;
        if (Object.keys(tags).length > 0) {
          saveToTagCache(tags);
          setAiTags((prev) => ({ ...prev, ...cached, ...tags }));
        } else {
          console.warn("[ai-tagger] AI returned no tags for any article");
          setAiTags((prev) => ({ ...prev, ...cached }));
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[ai-tagger]", err);
        setError(err instanceof Error ? err.message : "Failed to get AI tags");
      })
      .finally(() => setIsTagging(false));

    return () => controller.abort();
  }, [articles]);

  const merged = articles.map((article) => {
    const tags = aiTags[article.id];
    if (!tags || tags.length === 0) return article;
    return { ...article, tags, _aiTagged: true };
  });

  return { articles: merged, isTagging, error };
}
