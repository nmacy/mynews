"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

function CategoryContent() {
  const { slug } = useParams<{ slug: string }>();
  const { config } = useConfig();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const category = config.categories.find((c) => c.slug === slug);

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
        const filtered = (data.articles as Article[]).filter((a) =>
          a.categories.includes(slug)
        );
        setArticles(filtered);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, sourcesKey]);

  const { articles: taggedArticles } = useAiTagger(articles);
  const { filtered, sources, activeFilters, hasActiveFilters } =
    useArticleFilters(taggedArticles);

  if (!category) {
    return (
      <div className="text-center py-16" style={{ color: "var(--mn-muted)" }}>
        <p className="text-lg">Category not found</p>
      </div>
    );
  }

  if (loading) return <ArticleSkeleton />;

  const hero = hasActiveFilters ? undefined : filtered[0];
  const grid = hasActiveFilters ? filtered : filtered.slice(1);

  return (
    <>
      <FilterBar
        sources={sources}
        activeFilters={activeFilters}
        hasActiveFilters={hasActiveFilters}
      />
      {filtered.length === 0 && hasActiveFilters ? (
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

export default function CategoryPage() {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <CategoryContent />
    </Suspense>
  );
}
