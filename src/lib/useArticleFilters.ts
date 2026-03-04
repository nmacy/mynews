"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { Article } from "@/types";

const DATE_RANGES: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function useArticleFilters(articles: Article[]) {
  const searchParams = useSearchParams();
  const tagParam = searchParams.get("tag") || "";
  const source = searchParams.get("source") || "";
  const date = searchParams.get("date") || "";

  const tags = useMemo(
    () => (tagParam ? tagParam.split(",").filter(Boolean) : []),
    [tagParam]
  );

  const sources = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of articles) {
      if (a.source?.id && !map.has(a.source.id)) {
        map.set(a.source.id, a.source.name);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [articles]);

  const filtered = useMemo(() => {
    let result = articles;

    if (tags.length > 0) {
      result = result.filter((a) =>
        tags.some((t) => (a.tags ?? []).includes(t))
      );
    }

    if (source) {
      result = result.filter((a) => a.source?.id === source);
    }

    if (date && DATE_RANGES[date]) {
      const cutoff = Date.now() - DATE_RANGES[date];
      result = result.filter(
        (a) => new Date(a.publishedAt).getTime() >= cutoff
      );
    }

    return result;
  }, [articles, tags, source, date]);

  const activeFilters = { tags, source, date };
  const hasActiveFilters = !!(tags.length > 0 || source || date);

  return { filtered, sources, activeFilters, hasActiveFilters };
}
