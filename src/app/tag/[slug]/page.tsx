"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useConfig } from "@/components/ConfigProvider";
import { HeroArticle } from "@/components/articles/HeroArticle";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { FilterBar } from "@/components/ui/FilterBar";
import { useAiTagger } from "@/lib/useAiTagger";
import { useArticleFilters } from "@/lib/useArticleFilters";
import { TAG_MAP } from "@/config/tags";
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

function TagContent() {
  const { slug } = useParams<{ slug: string }>();
  const { config } = useConfig();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const tag = TAG_MAP.get(slug);

  const sourcesKey = useMemo(
    () => config.sources.map((s) => s.id).sort().join(","),
    [config.sources]
  );

  useEffect(() => {
    if (!slug) return;

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
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, sourcesKey]);

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

  const { articles: taggedArticles } = useAiTagger(articles);

  // Filter by the tag slug
  const tagFiltered = useMemo(
    () => taggedArticles.filter((a) => (a.tags ?? []).includes(slug)),
    [taggedArticles, slug]
  );

  const { filtered, sources, activeFilters, hasActiveFilters } =
    useArticleFilters(tagFiltered);

  if (!tag) {
    return (
      <div className="text-center py-16" style={{ color: "var(--mn-muted)" }}>
        <p className="text-lg">Tag not found</p>
      </div>
    );
  }

  if (loading) return <ArticleSkeleton />;

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
        sources={sources}
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
          {hero && <HeroArticle article={hero} />}
          <ArticleGrid articles={grid} />
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
