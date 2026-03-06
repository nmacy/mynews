"use client";

import { useRouter } from "next/navigation";
import { useTagMap } from "@/components/TagProvider";

export function TagBadge({ slug, aiTagged }: { slug: string; aiTagged?: boolean }) {
  const router = useRouter();
  const tagMap = useTagMap();
  const tag = tagMap.get(slug);
  if (!tag) return null;

  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/tag/${slug}`);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          router.push(`/tag/${slug}`);
        }
      }}
      className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer transition-colors"
      style={{
        color: tag.color,
        backgroundColor: `${tag.color}15`,
        border: `1px solid ${tag.color}40`,
      }}
    >
      {tag.label}
    </span>
  );
}
