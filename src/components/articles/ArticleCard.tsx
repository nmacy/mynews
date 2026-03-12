"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArticleImage } from "./ArticleImage";
import { PaywallBadge } from "@/components/ui/PaywallBadge";
import { TagBadge } from "@/components/ui/TagBadge";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { storeArticle } from "@/lib/article-store";
import type { Article } from "@/types";

export function ArticleCard({ article }: { article: Article }) {
  const router = useRouter();

  return (
    <Link
      href={`/article/${article.id}`}
      onClick={() => { sessionStorage.setItem("mn-scroll-y", String(window.scrollY)); storeArticle(article); }}
      className="block rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
      style={{ backgroundColor: "var(--mn-card)" }}
    >
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
              <TagBadge key={tag} slug={tag} aiTagged={article._aiTagged} />
            ))}
          </div>
        )}
        <div className="mt-3">
          <TimeAgo date={article.publishedAt} />
        </div>
      </div>
    </Link>
  );
}
