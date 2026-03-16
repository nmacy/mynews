"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useConfig } from "@/components/ConfigProvider";
import { HeroArticle } from "@/components/articles/HeroArticle";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { FilterBar } from "@/components/ui/FilterBar";
import { useAiTagger } from "@/lib/useAiTagger";
import { useArticleFilters } from "@/lib/useArticleFilters";
import { rankArticles, type RankingConfig, DEFAULT_RANKING_CONFIG } from "@/lib/ranker";
import type { Article } from "@/types";

export function ArticleSkeleton() {
  return (
    <div className="animate-pulse">
      <div
        className="hidden sm:block w-full aspect-[3/1] rounded-2xl mb-8"
        style={{ backgroundColor: "var(--mn-border)" }}
      />
      <div
        className="sm:hidden rounded-2xl mb-6 overflow-hidden"
        style={{ backgroundColor: "var(--mn-card)" }}
      >
        <div className="aspect-video" style={{ backgroundColor: "var(--mn-border)" }} />
        <div className="p-4 space-y-3">
          <div className="h-4 rounded" style={{ backgroundColor: "var(--mn-border)", width: "75%" }} />
          <div className="h-4 rounded" style={{ backgroundColor: "var(--mn-border)", width: "100%" }} />
          <div className="h-3 rounded" style={{ backgroundColor: "var(--mn-border)", width: "50%" }} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--mn-card)" }}>
            <div className="aspect-video" style={{ backgroundColor: "var(--mn-border)" }} />
            <div className="p-4 space-y-3">
              <div className="h-4 rounded" style={{ backgroundColor: "var(--mn-border)", width: "75%" }} />
              <div className="h-4 rounded" style={{ backgroundColor: "var(--mn-border)", width: "100%" }} />
              <div className="h-3 rounded" style={{ backgroundColor: "var(--mn-border)", width: "50%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HomeContentProps {
  initialArticles: Article[];
  initialSourcesKey: string;
  initialRankingConfig?: RankingConfig;
}

export function HomeContent({ initialArticles, initialSourcesKey, initialRankingConfig }: HomeContentProps) {
  const { config } = useConfig();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || "";

  // When the source bar filters to specific sources, fetch just those from the API
  // instead of filtering the capped home page dataset
  const sourceBarFilter = searchParams.get("sources") || "";

  const sourcesKey = useMemo(
    () => config.sources.map((s) => s.id).sort().join(","),
    [config.sources]
  );

  // Combine user sources key + source bar filter into a single fetch key
  const fetchKey = sourceBarFilter ? `${sourcesKey}:filter:${sourceBarFilter}` : sourcesKey;

  // Use server-fetched articles if sources match defaults, otherwise need client fetch
  const hasInitialData = initialArticles.length > 0 && sourcesKey === initialSourcesKey && !sourceBarFilter;
  const [articles, setArticles] = useState<Article[]>(hasInitialData ? initialArticles : []);
  const [loading, setLoading] = useState(!hasInitialData);
  const [failedSources, setFailedSources] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    // Skip fetch if we already have server-rendered data for this sources key
    if (!sourceBarFilter && sourcesKey === initialSourcesKey && initialArticles.length > 0) {
      setArticles(initialArticles);
      setLoading(false);
      return;
    }

    if (config.sources.length === 0) {
      setArticles([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    if (sourceBarFilter) {
      // Source bar is active — fetch just those source IDs directly from DB
      fetch(`/api/feeds?sourceIds=${encodeURIComponent(sourceBarFilter)}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then((res) => res.json())
        .then((data) => {
          setArticles(data.articles as Article[]);
          setFailedSources(data.failedSources ?? []);
          if (data.ranking) setRankingConfig(data.ranking);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error(err);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    } else {
      // No filter — fetch all user sources (capped by API)
      fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: config.sources }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          setArticles(data.articles as Article[]);
          setFailedSources(data.failedSources ?? []);
          if (data.ranking) setRankingConfig(data.ranking);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error(err);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  const [initialVisible, setInitialVisible] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (loading) return;
    const savedY = sessionStorage.getItem("mn-scroll-y");
    if (savedY) {
      sessionStorage.removeItem("mn-scroll-y");
      const scrollY = parseInt(savedY, 10);
      if (scrollY > 0) {
        setInitialVisible(Math.ceil(scrollY / 400) * 3 + 30);
      }
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    }
  }, [loading]);

  const { articles: taggedArticles, isTagging, error: aiError } = useAiTagger(articles);

  // Client-side ranking with tag interest boost (per-user featuredTags)
  const [rankingConfig, setRankingConfig] = useState<RankingConfig>(initialRankingConfig ?? DEFAULT_RANKING_CONFIG);

  const rankedArticles = useMemo(() => {
    if (!rankingConfig.enabled || !rankingConfig.layerTagInterest) return taggedArticles;
    const featuredTags = config.featuredTags ?? [];
    if (featuredTags.length === 0) return taggedArticles;
    // Apply only the tag interest layer client-side, server already ranked with other layers
    const copy = taggedArticles.map((a) => ({ ...a }));
    for (const article of copy) {
      const hasMatch = article.tags.some((t) => featuredTags.includes(t));
      if (hasMatch && article._rankScore !== undefined) {
        article._rankScore *= 1.3;
      }
    }
    copy.sort((a, b) => (b._rankScore ?? 0) - (a._rankScore ?? 0));
    return copy;
  }, [taggedArticles, rankingConfig, config.featuredTags]);

  const searchFiltered = useMemo(() => {
    if (!searchQuery) return rankedArticles;
    const q = searchQuery.toLowerCase();
    return rankedArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }, [rankedArticles, searchQuery]);

  const { filtered, activeFilters, hasActiveFilters } =
    useArticleFilters(searchFiltered);

  if (loading) return <ArticleSkeleton />;

  const displayed = filtered;
  const isFiltered = hasActiveFilters || searchQuery;
  const hero = isFiltered ? undefined : displayed[0];
  const grid = isFiltered ? displayed : displayed.slice(1);

  return (
    <>
      {failedSources.length > 0 && (
        <div className="text-xs mb-4 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
          Failed to fetch articles from: {failedSources.map((s) => s.name).join(", ")}.
          {" "}The RSS feed may be invalid or unavailable.
        </div>
      )}
      {aiError && (
        <p className="text-xs mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400">
          AI tagging failed: {aiError}
        </p>
      )}
      {searchQuery && (
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm" style={{ color: "var(--mn-muted)" }}>
            Showing results for &ldquo;{searchQuery}&rdquo;
          </p>
          <Link
            href="/"
            className="text-sm hover:underline"
            style={{ color: "var(--mn-link)" }}
          >
            Clear search
          </Link>
        </div>
      )}
      <FilterBar
        activeFilters={activeFilters}
        hasActiveFilters={hasActiveFilters}
      />
      {displayed.length === 0 && isFiltered ? (
        <div className="text-center py-16" style={{ color: "var(--mn-muted)" }}>
          <p className="text-lg">No results found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          {hero && <HeroArticle article={hero} debugScores={rankingConfig.debugScores} />}
          <ArticleGrid articles={grid} initialVisible={initialVisible} debugScores={rankingConfig.debugScores} />
        </>
      )}
    </>
  );
}
