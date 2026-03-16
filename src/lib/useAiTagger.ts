"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Article } from "@/types";

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
    // localStorage full or unavailable
  }
}

const BATCH_SIZE = 20;

function hashIds(articles: Article[]): string {
  return articles.map((a) => a.id).join(",");
}

async function fetchBatch(
  articles: Article[],
  config: { provider: string; model: string },
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
  config: { provider: string; model: string },
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
    }
  }

  return allTags;
}

export function useAiTagger(articles: Article[]): {
  articles: Article[];
  isTagging: boolean;
  error: string | null;
} {
  const [aiTags, setAiTags] = useState<Record<string, string[]>>({});
  const [isTagging, setIsTagging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastBatchRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const [aiStatus, setAiStatus] = useState<{
    enabled: boolean;
    provider?: string;
    model?: string;
  } | null>(null);

  // Load cached tags and AI status after hydration to avoid SSR mismatch
  useEffect(() => {
    setAiTags(loadTagCache());
    fetch("/api/ai-status")
      .then((r) => r.json())
      .then(setAiStatus)
      .catch(() => setAiStatus({ enabled: false }));
  }, []);

  // Client-side AI tagging is disabled — the server-side auto-tagger
  // (instrumentation.ts) handles tagging during background refresh and
  // persists results to the DB. Client-side tagging was causing excessive
  // API usage (thousands of redundant calls per day).

  const merged = useMemo(
    () =>
      articles.map((article) => {
        const tags = aiTags[article.id];
        if (!tags || tags.length === 0) return article;
        const merged = Array.from(new Set([...(article.tags ?? []), ...tags]));
        return { ...article, tags: merged, _aiTagged: true };
      }),
    [articles, aiTags]
  );

  return { articles: merged, isTagging, error };
}
