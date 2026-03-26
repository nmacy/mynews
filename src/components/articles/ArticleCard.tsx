"use client";

import { memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArticleImage } from "./ArticleImage";
import { PaywallBadge } from "@/components/ui/PaywallBadge";
import { TagBadge } from "@/components/ui/TagBadge";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { storeArticle } from "@/lib/article-store";
import type { Article } from "@/types";

export const ArticleCard = memo(function ArticleCard({ article, debugScores }: { article: Article; debugScores?: boolean }) {
  const router = useRouter();

  return (
    <Link
      href={`/article/${article.id}`}
      onClick={() => { sessionStorage.setItem("mn-scroll-y", String(window.scrollY)); storeArticle(article); }}
      className="block relative rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
      style={{ backgroundColor: "var(--mn-card)" }}
    >
      {debugScores && article._rankScore !== undefined && (
        <div
          className="absolute top-2 right-2 z-10 px-2 py-1 rounded-md text-xs font-mono font-bold shadow-md"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            color: "#00ff88",
          }}
        >
          {article._rankScore.toFixed(3)}
        </div>
      )}
      <div className="relative aspect-[16/9]">
        <ArticleImage
          src={article.imageUrl}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {article.paywalled && <PaywallBadge />}
          <span
            role="link"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(`/source/${article.source.id}`);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/source/${article.source.id}`);
              }
            }}
            className="text-xs hover:underline cursor-pointer"
            style={{ color: "var(--mn-muted)" }}
          >
            {article.source.name}
          </span>
        </div>
        <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-[var(--mn-link)] transition-colors">
          {article.title}
        </h3>
        <p className="mt-1 text-sm line-clamp-2" style={{ color: "var(--mn-muted)" }}>
          {article.description}
        </p>
        {(article.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[...new Set(article.tags ?? [])].map((tag) => (
              <TagBadge key={tag} slug={tag} />
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <TimeAgo date={article.publishedAt} />
          {article._dedupCount && article._dedupCount > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--mn-border)", color: "var(--mn-muted)" }}
            >
              +{article._dedupCount} similar
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}, (prev, next) => prev.article.id === next.article.id && prev.debugScores === next.debugScores && prev.article._rankScore === next.article._rankScore);
