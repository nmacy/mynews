"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TAG_MAP } from "@/config/tags";

export function ActiveTagFilter({ tag }: { tag: string }) {
  const pathname = usePathname();
  const tagDef = TAG_MAP.get(tag);
  if (!tagDef) return null;

  return (
    <div className="flex items-center justify-between mb-6">
      <p className="text-sm" style={{ color: "var(--mn-muted)" }}>
        Filtering by tag:{" "}
        <span
          className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
          style={{
            color: tagDef.color,
            backgroundColor: `${tagDef.color}15`,
            border: `1px solid ${tagDef.color}40`,
          }}
        >
          {tagDef.label}
        </span>
      </p>
      <Link
        href={pathname}
        className="text-sm hover:underline"
        style={{ color: "var(--mn-link)" }}
      >
        Clear filter
      </Link>
    </div>
  );
}
