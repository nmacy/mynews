"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { Article } from "@/types";

const DATE_RANGES: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "14d": 14 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function useArticleFilters(articles: Article[]) {
  const searchParams = useSearchParams();
  const tagParam = searchParams.get("tag") || "";
  const sourcesParam = searchParams.get("sources") || "";
  const legacySource = searchParams.get("source") || "";
  const date = searchParams.get("date") || "";

  const tags = useMemo(
    () => (tagParam ? tagParam.split(",").filter(Boolean) : []),
    [tagParam]
  );

  const sources = useMemo(() => {
    // Plural param takes priority; fall back to legacy singular param
    if (sourcesParam) return sourcesParam.split(",").filter(Boolean);
    if (legacySource) return [legacySource];
    return [];
  }, [sourcesParam, legacySource]);

  const filtered = useMemo(() => {
    let result = articles;

    if (tags.length > 0) {
      result = result.filter((a) =>
        tags.some((t) => (a.tags ?? []).includes(t))
      );
    }

    if (sources.length > 0) {
      const sourceSet = new Set(sources);
      result = result.filter((a) => a.source?.id && sourceSet.has(a.source.id));
    }

    if (date && DATE_RANGES[date]) {
      const cutoff = Date.now() - DATE_RANGES[date];
      result = result.filter(
        (a) => new Date(a.publishedAt).getTime() >= cutoff
      );
    }

    return result;
  }, [articles, tags, sources, date]);

  const activeFilters = { tags, sources, date };
  const hasActiveFilters = !!(tags.length > 0 || sources.length > 0 || (date && DATE_RANGES[date]));

  return { filtered, activeFilters, hasActiveFilters };
}
