"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TAG_MAP } from "@/config/tags";
import { useConfig } from "@/components/ConfigProvider";

export const DEFAULT_FEATURED_TAGS = [
  "technology",
  "business",
  "science",
  "world",
  "health",
  "sports",
  "entertainment",
  "ai",
  "economy",
  "climate",
];

export function TagTabs() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { featuredTags } = useConfig();

  const activeSlug =
    pathname === "/" ? null : pathname.startsWith("/tag/") ? pathname.split("/")[2] : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const featuredSet = new Set<string>(featuredTags);
  const remainingTags = Array.from(TAG_MAP.values()).filter(
    (t) => !featuredSet.has(t.slug)
  );

  return (
    <nav style={{ backgroundColor: "var(--mn-card)", borderBottom: "1px solid var(--mn-border)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 items-center py-1">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {/* All pill */}
            <Link
              href="/"
              className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-colors"
              style={
                activeSlug === null && pathname === "/"
                  ? { backgroundColor: "#6366F1", color: "white" }
                  : { color: "var(--mn-muted)" }
              }
            >
              All
            </Link>

            {/* Featured tags */}
            {featuredTags.map((slug) => {
              const tag = TAG_MAP.get(slug);
              if (!tag) return null;
              const isActive = activeSlug === slug;
              return (
                <Link
                  key={slug}
                  href={`/tag/${slug}`}
                  className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-colors"
                  style={
                    isActive
                      ? { backgroundColor: tag.color, color: "white" }
                      : { color: "var(--mn-muted)" }
                  }
                >
                  {tag.label}
                </Link>
              );
            })}
          </div>

          {/* More dropdown — outside the overflow container */}
          {remainingTags.length > 0 && (
            <div className="relative flex-shrink-0" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-full transition-colors"
                style={{
                  color: remainingTags.some((t) => t.slug === activeSlug)
                    ? "white"
                    : "var(--mn-muted)",
                  backgroundColor: remainingTags.some((t) => t.slug === activeSlug)
                    ? TAG_MAP.get(activeSlug!)?.color
                    : "transparent",
                }}
              >
                More
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition-transform ${moreOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {moreOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg py-1 shadow-lg max-h-80 overflow-y-auto min-w-[180px]"
                  style={{
                    backgroundColor: "var(--mn-card)",
                    border: "1px solid var(--mn-border)",
                  }}
                >
                  {remainingTags.map((tag) => (
                    <Link
                      key={tag.slug}
                      href={`/tag/${tag.slug}`}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:opacity-80 transition-opacity"
                      style={{
                        color:
                          activeSlug === tag.slug ? "white" : "var(--mn-fg)",
                        backgroundColor:
                          activeSlug === tag.slug ? tag.color : "transparent",
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
