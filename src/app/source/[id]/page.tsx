"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useConfig } from "@/components/ConfigProvider";
import { HeroArticle } from "@/components/articles/HeroArticle";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { PaywallBadge } from "@/components/ui/PaywallBadge";
import { useAiTagger } from "@/lib/useAiTagger";
import type { Article } from "@/types";

function SourceSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 space-y-3">
        <div className="h-6 rounded" style={{ backgroundColor: "var(--mn-border)", width: "40%" }} />
        <div className="h-4 rounded" style={{ backgroundColor: "var(--mn-border)", width: "60%" }} />
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full" style={{ backgroundColor: "var(--mn-border)" }} />
          <div className="h-5 w-16 rounded-full" style={{ backgroundColor: "var(--mn-border)" }} />
        </div>
      </div>
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

export default function SourcePage() {
  const { id } = useParams<{ id: string }>();
  const { allSources } = useConfig();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const source = allSources.find((s) => s.id === id);

  useEffect(() => {
    if (!source) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();
    params.set("sources", JSON.stringify([source]));

    fetch(`/api/feeds?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setArticles(data.articles as Article[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [source]);

  const { articles: taggedArticles } = useAiTagger(articles);

  if (!source) {
    return (
      <div className="text-center py-16" style={{ color: "var(--mn-muted)" }}>
        <p className="text-lg">Source not found</p>
        <Link href="/" className="text-sm mt-2 inline-block hover:underline" style={{ color: "var(--mn-link)" }}>
          Back to home
        </Link>
      </div>
    );
  }

  if (loading) return <SourceSkeleton />;

  const hero = taggedArticles[0];
  const rest = taggedArticles.slice(1);

  return (
    <>
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm hover:underline inline-flex items-center gap-1 mb-3"
          style={{ color: "var(--mn-link)" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to home
        </Link>
        <h1 className="text-2xl font-bold">{source.name}</h1>
        <p className="text-sm mt-1 break-all" style={{ color: "var(--mn-muted)" }}>
          {source.url}
        </p>
        {source.paywalled && (
          <div className="mt-3">
            <PaywallBadge />
          </div>
        )}
      </div>

      {hero && <HeroArticle article={hero} />}
      <ArticleGrid articles={rest} />
    </>
  );
}
