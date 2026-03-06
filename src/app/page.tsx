"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useConfig } from "@/components/ConfigProvider";
import { HeroArticle } from "@/components/articles/HeroArticle";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { FilterBar } from "@/components/ui/FilterBar";
import { useAiTagger } from "@/lib/useAiTagger";
import { useArticleFilters } from "@/lib/useArticleFilters";
import type { Article } from "@/types";

function ArticleSkeleton() {
  return (
    <div className="animate-pulse">
      <div
        className="w-full aspect-[2/1] sm:aspect-[3/1] rounded-2xl mb-8"
        style={{ backgroundColor: "var(--mn-border)" }}
      />
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

function HomeContent() {
  const { config } = useConfig();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || "";
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedSources, setFailedSources] = useState<{ name: string; url: string }[]>([]);

  const sourcesKey = useMemo(
    () => config.sources.map((s) => s.id).sort().join(","),
    [config.sources]
  );

  useEffect(() => {
    if (config.sources.length === 0) {
      setArticles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();
    params.set("sources", JSON.stringify(config.sources));

    fetch(`/api/feeds?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setArticles(data.articles as Article[]);
        setFailedSources(data.failedSources ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey]);

  useEffect(() => {
    if (loading) return;
    const savedY = sessionStorage.getItem("mn-scroll-y");
    if (savedY) {
      sessionStorage.removeItem("mn-scroll-y");
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedY, 10));
      });
    }
  }, [loading]);

  const { articles: taggedArticles, isTagging, error: aiError } = useAiTagger(articles);

  // Apply search query first, then pass to filter hook
  const searchFiltered = useMemo(() => {
    if (!searchQuery) return taggedArticles;
    const q = searchQuery.toLowerCase();
    return taggedArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }, [taggedArticles, searchQuery]);

  const { filtered, sources, activeFilters, hasActiveFilters } =
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
        sources={sources}
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
          <ArticleGrid articles={grid} />
        </>
      )}
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
