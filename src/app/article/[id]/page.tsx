"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { ArticleImage } from "@/components/articles/ArticleImage";
import { TagBadge } from "@/components/ui/TagBadge";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { getStoredArticle } from "@/lib/article-store";
import type { Article } from "@/types";

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "b", "i", "em", "strong", "a", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "img",
    "figure", "figcaption", "pre", "code", "table", "thead",
    "tbody", "tr", "th", "td", "div", "span", "hr", "sup", "sub",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "title"],
  ALLOW_DATA_ATTR: false,
};

function ArticleDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="mb-6 space-y-3">
        <div className="h-5 w-24 rounded" style={{ backgroundColor: "var(--mn-border)" }} />
        <div className="h-8 w-full rounded" style={{ backgroundColor: "var(--mn-border)" }} />
        <div className="h-8 w-3/4 rounded" style={{ backgroundColor: "var(--mn-border)" }} />
        <div className="h-4 w-40 rounded" style={{ backgroundColor: "var(--mn-border)" }} />
      </div>
      <div className="aspect-[16/9] rounded-2xl mb-8" style={{ backgroundColor: "var(--mn-border)" }} />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-4 rounded" style={{ backgroundColor: "var(--mn-border)", width: i % 3 === 0 ? "90%" : "100%" }} />
        ))}
      </div>
    </div>
  );
}

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(false);

  // Load article from sessionStorage
  useEffect(() => {
    if (!id) return;
    const stored = getStoredArticle(id);
    if (stored) {
      setArticle(stored);
    }
  }, [id]);

  // Extract full article content
  useEffect(() => {
    if (!article?.url) return;

    setExtracting(true);
    setExtractError(false);

    fetch(`/api/article/extract?url=${encodeURIComponent(article.url)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Extraction failed");
        return res.json();
      })
      .then((data) => {
        if (data.content) setFullContent(data.content);
      })
      .catch(() => setExtractError(true))
      .finally(() => setExtracting(false));
  }, [article?.url]);

  const rawContent = fullContent ?? article?.content ?? "";
  const displayContent = useMemo(
    () => DOMPurify.sanitize(rawContent, PURIFY_CONFIG),
    [rawContent]
  );

  if (!article) {
    return <ArticleDetailSkeleton />;
  }

  return (
    <article className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="font-medium text-sm hover:underline"
          style={{ color: "var(--mn-link)" }}
        >
          &larr; Back to news
        </button>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sm hover:underline"
          style={{ color: "var(--mn-link)" }}
        >
          Read on {article.source.name} &rarr;
        </a>
      </div>

      <div className="mb-6">
        {(article.tags ?? []).length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            {[...new Set(article.tags ?? [])].map((tag) => (
              <TagBadge key={tag} slug={tag} aiTagged={article._aiTagged} />
            ))}
          </div>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-3">
          {article.title}
        </h1>
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--mn-muted)" }}>
          <span className="font-medium" style={{ color: "var(--mn-fg)" }}>
            {article.source.name}
          </span>
          <span>·</span>
          <TimeAgo date={article.publishedAt} />
        </div>
      </div>

      {article.imageUrl && (
        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-8">
          <ArticleImage
            src={article.imageUrl}
            alt={article.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>
      )}

      {extracting && (
        <div
          className="flex items-center gap-2 text-sm mb-4 px-3 py-2 rounded-lg"
          style={{ backgroundColor: "var(--mn-bg)", color: "var(--mn-muted)" }}
        >
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Loading full article...
        </div>
      )}

      {extractError && !fullContent && (
        <div
          className="mb-6 px-4 py-4 rounded-xl"
          style={{ backgroundColor: "var(--mn-bg)", border: "1px solid var(--mn-border)" }}
        >
          {article.paywalled ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  Paywalled
                </span>
                <span className="text-sm font-medium">{article.source.name}</span>
              </div>
              <p className="text-sm mb-3" style={{ color: "var(--mn-muted)" }}>
                This article is behind a paywall. The excerpt below is from the RSS feed.
                Read the full article on the source site.
              </p>
            </>
          ) : (
            <p className="text-sm mb-3" style={{ color: "var(--mn-muted)" }}>
              Could not load the full article. Showing the available excerpt below.
            </p>
          )}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: "var(--mn-link)" }}
          >
            Read full article on {article.source.name} &rarr;
          </a>
        </div>
      )}

      <div
        className="prose prose-lg max-w-none prose-img:rounded-xl"
        style={{ color: "var(--mn-fg)" }}
        dangerouslySetInnerHTML={{ __html: displayContent }}
      />

      <div className="flex items-center justify-between mt-10 pt-6" style={{ borderTop: "1px solid var(--mn-border)" }}>
        <button
          onClick={() => router.back()}
          className="font-medium text-sm hover:underline"
          style={{ color: "var(--mn-link)" }}
        >
          &larr; Back to news
        </button>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sm hover:underline"
          style={{ color: "var(--mn-link)" }}
        >
          Read on {article.source.name} &rarr;
        </a>
      </div>

    </article>
  );
}
