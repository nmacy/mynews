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
}

export function HomeContent({ initialArticles, initialSourcesKey }: HomeContentProps) {
  const { config } = useConfig();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || "";

  const sourcesKey = useMemo(
    () => config.sources.map((s) => s.id).sort().join(","),
    [config.sources]
  );

  // Use server-fetched articles if sources match defaults, otherwise need client fetch
  const hasInitialData = initialArticles.length > 0 && sourcesKey === initialSourcesKey;
  const [articles, setArticles] = useState<Article[]>(hasInitialData ? initialArticles : []);
  const [loading, setLoading] = useState(!hasInitialData);
  const [failedSources, setFailedSources] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    // Skip fetch if we already have server-rendered data for this sources key
    if (sourcesKey === initialSourcesKey && initialArticles.length > 0) {
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
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey]);

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

  const searchFiltered = useMemo(() => {
    if (!searchQuery) return taggedArticles;
    const q = searchQuery.toLowerCase();
    return taggedArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }, [taggedArticles, searchQuery]);

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
          {hero && <HeroArticle article={hero} />}
          <ArticleGrid articles={grid} initialVisible={initialVisible} />
        </>
      )}
    </>
  );
}
