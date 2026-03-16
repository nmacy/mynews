"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HeroArticle } from "@/components/articles/HeroArticle";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { FilterBar } from "@/components/ui/FilterBar";
import { useAiTagger } from "@/lib/useAiTagger";
import { useArticleFilters } from "@/lib/useArticleFilters";
import { useScrollRestore } from "@/lib/useScrollRestore";
import { useTagMap } from "@/components/TagProvider";
import type { Article } from "@/types";
import { type RankingConfig, DEFAULT_RANKING_CONFIG } from "@/lib/ranker";

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

function TagContent() {
  const { slug } = useParams<{ slug: string }>();
  const tagMap = useTagMap();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [rankingConfig, setRankingConfig] = useState<RankingConfig>(DEFAULT_RANKING_CONFIG);

  const tag = tagMap.get(slug);

  // Fetch articles for this specific tag — server-side DB filter returns
  // up to 500 most recent articles with this tag across all sources.
  useEffect(() => {
    if (!slug) return;

    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/feeds?tag=${encodeURIComponent(slug)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data.articles)) setArticles(data.articles as Article[]);
        if (data.ranking) setRankingConfig(data.ranking);
        setFetchError(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setFetchError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [slug]);

  useScrollRestore(loading);

  const { articles: taggedArticles } = useAiTagger(articles);

  const { filtered, activeFilters, hasActiveFilters } =
    useArticleFilters(taggedArticles);

  if (loading) return <ArticleSkeleton />;

  if (!tag) {
    return (
      <div className="text-center py-16" style={{ color: "var(--mn-muted)" }}>
        <p className="text-lg">Tag not found</p>
      </div>
    );
  }

  if (fetchError && articles.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: "var(--mn-muted)" }}>
        <p className="text-lg">Failed to load articles</p>
        <p className="text-sm mt-1">Check your connection and try refreshing.</p>
      </div>
    );
  }

  const hero = hasActiveFilters ? undefined : filtered[0];
  const grid = hasActiveFilters ? filtered : filtered.slice(1);

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: tag.color }}
        />
        <h1 className="text-2xl font-bold">{tag.label}</h1>
        <span className="text-sm" style={{ color: "var(--mn-muted)" }}>
          {filtered.length} {filtered.length === 1 ? "article" : "articles"}
        </span>
      </div>
      <FilterBar
        activeFilters={activeFilters}
        hasActiveFilters={hasActiveFilters}
      />
      {filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--mn-muted)" }}>
          <p className="text-lg">No articles found for this tag</p>
          <p className="text-sm mt-1">Try adjusting your filters or check back later</p>
        </div>
      ) : (
        <>
          {hero && <HeroArticle article={hero} debugScores={rankingConfig.debugScores} />}
          <ArticleGrid articles={grid} debugScores={rankingConfig.debugScores} />
        </>
      )}
    </>
  );
}

export default function TagPage() {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <TagContent />
    </Suspense>
  );
}
