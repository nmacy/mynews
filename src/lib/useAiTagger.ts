"use client";

import { useEffect, useMemo, useState } from "react";
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

/**
 * Merges any locally-cached AI tags into articles.
 * Client-side AI tagging is disabled — the server-side auto-tagger
 * (instrumentation.ts) handles tagging during background refresh and
 * persists results to the DB.
 */
export function useAiTagger(articles: Article[]): {
  articles: Article[];
} {
  const [aiTags, setAiTags] = useState<Record<string, string[]>>({});

  // Load cached tags after hydration to avoid SSR mismatch
  useEffect(() => {
    setAiTags(loadTagCache());
  }, []);

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

  return { articles: merged };
}
