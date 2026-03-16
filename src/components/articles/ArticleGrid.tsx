"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArticleCard } from "./ArticleCard";
import type { Article } from "@/types";

const PAGE_SIZE = 30;

export function ArticleGrid({
  articles,
  initialVisible,
  debugScores,
}: {
  articles: Article[];
  initialVisible?: number;
  debugScores?: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(
    initialVisible ? Math.min(initialVisible, articles.length) : Math.min(PAGE_SIZE, articles.length)
  );
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when articles change (e.g. filter change)
  useEffect(() => {
    setVisibleCount(
      initialVisible ? Math.min(initialVisible, articles.length) : Math.min(PAGE_SIZE, articles.length)
    );
  }, [articles, initialVisible]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, articles.length));
  }, [articles.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (articles.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: "var(--mn-muted)" }}>
        <p className="text-lg">No articles found</p>
        <p className="text-sm mt-1">Check back later for updates</p>
      </div>
    );
  }

  const visible = articles.slice(0, visibleCount);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((article) => (
          <ArticleCard key={article.id} article={article} debugScores={debugScores} />
        ))}
      </div>
      {visibleCount < articles.length && (
        <div ref={sentinelRef} className="h-10" />
      )}
    </>
  );
}
