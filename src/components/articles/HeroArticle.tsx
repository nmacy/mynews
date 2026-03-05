"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArticleImage } from "./ArticleImage";
import { PaywallBadge } from "@/components/ui/PaywallBadge";
import { TagBadge } from "@/components/ui/TagBadge";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { storeArticle } from "@/lib/article-store";
import type { Article } from "@/types";

export function HeroArticle({ article }: { article: Article }) {
  const router = useRouter();

  return (
    <Link
      href={`/article/${article.id}`}
      onClick={() => { sessionStorage.setItem("mn-scroll-y", String(window.scrollY)); storeArticle(article); }}
      className="block relative w-full aspect-[2/1] sm:aspect-[3/1] rounded-2xl overflow-hidden group mb-8"
    >
      <ArticleImage
        src={article.imageUrl}
        alt={article.title}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="100vw"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
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
            className="text-white/80 text-sm hover:underline cursor-pointer"
          >
            {article.source.name}
          </span>
          <span className="text-white/60">·</span>
          <TimeAgo date={article.publishedAt} />
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
          {article.title}
        </h2>
        <p className="mt-2 text-white/80 text-sm sm:text-base line-clamp-2 max-w-3xl">
          {article.description}
        </p>
        {(article.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(article.tags ?? []).map((tag) => (
              <TagBadge key={tag} slug={tag} aiTagged={article._aiTagged} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
