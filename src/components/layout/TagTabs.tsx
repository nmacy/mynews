"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConfig } from "@/components/ConfigProvider";
import { useTagMap } from "@/components/TagProvider";
import { useClickOutside } from "@/lib/useClickOutside";

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
  const [search, setSearch] = useState("");
  const moreRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { featuredTags, setFeaturedTags } = useConfig();
  const TAG_MAP = useTagMap();

  const isListingPage = pathname === "/" || pathname.startsWith("/tag/");
  const urlSlug =
    pathname === "/" ? null : pathname.startsWith("/tag/") ? pathname.split("/")[2] : null;

  // Restore active tag from sessionStorage after hydration (non-listing pages only)
  const [restoredSlug, setRestoredSlug] = useState<string | null>(null);
  useEffect(() => {
    if (isListingPage) {
      if (urlSlug) {
        sessionStorage.setItem("mn-active-tag", urlSlug);
      } else {
        sessionStorage.removeItem("mn-active-tag");
      }
      setRestoredSlug(null);
    } else {
      setRestoredSlug(sessionStorage.getItem("mn-active-tag"));
    }
  }, [isListingPage, urlSlug]);

  const activeSlug = isListingPage ? urlSlug : restoredSlug;

  const closeDropdown = useCallback(() => { setMoreOpen(false); setSearch(""); }, []);
  useClickOutside(moreRef, closeDropdown, moreOpen);

  useEffect(() => {
    if (moreOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [moreOpen]);

  const featuredSet = useMemo(() => new Set<string>(featuredTags), [featuredTags]);
  const remainingTags = useMemo(
    () => Array.from(TAG_MAP.values()).filter((t) => !featuredSet.has(t.slug)),
    [TAG_MAP, featuredSet]
  );

  const filteredTags = useMemo(() => {
    if (!search) return remainingTags;
    const q = search.toLowerCase();
    return remainingTags.filter((t) => t.label.toLowerCase().includes(q));
  }, [remainingTags, search]);

  const PinIcon = ({ filled }: { filled: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  );

  const togglePin = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (featuredSet.has(slug)) {
      setFeaturedTags(featuredTags.filter((s) => s !== slug));
    } else {
      setFeaturedTags([...featuredTags, slug]);
    }
  };

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
                  ? { backgroundColor: "var(--mn-accent)", color: "white" }
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
                  className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center gap-1"
                  style={
                    isActive
                      ? { backgroundColor: tag.color, color: "white" }
                      : { color: "var(--mn-muted)" }
                  }
                >
                  {tag.label}
                  {isActive && (
                    <span
                      onClick={(e) => togglePin(slug, e)}
                      title="Unpin from bar"
                      className="ml-0.5 opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <PinIcon filled />
                    </span>
                  )}
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
                style={(() => {
                  const isActiveInMore = remainingTags.some((t) => t.slug === activeSlug);
                  return {
                    color: isActiveInMore ? "white" : "var(--mn-muted)",
                    backgroundColor: isActiveInMore ? TAG_MAP.get(activeSlug!)?.color : "transparent",
                  };
                })()}
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
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg max-h-80 overflow-hidden min-w-[200px] flex flex-col"
                  style={{
                    backgroundColor: "var(--mn-card)",
                    border: "1px solid var(--mn-border)",
                  }}
                >
                  <div className="px-2 pt-2 pb-1">
                    <input
                      ref={searchRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search tags..."
                      className="w-full px-2.5 py-1.5 text-sm rounded-md outline-none"
                      style={{
                        backgroundColor: "var(--mn-bg)",
                        color: "var(--mn-fg)",
                        border: "1px solid var(--mn-border)",
                      }}
                    />
                  </div>
                  <div className="overflow-y-auto py-1">
                    {filteredTags.length === 0 && (
                      <div className="px-3 py-2 text-sm" style={{ color: "var(--mn-muted)" }}>
                        No tags found
                      </div>
                    )}
                    {filteredTags.map((tag) => (
                      <Link
                        key={tag.slug}
                        href={`/tag/${tag.slug}`}
                        onClick={() => { setMoreOpen(false); setSearch(""); }}
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
                        <span className="flex-1">{tag.label}</span>
                        {activeSlug === tag.slug && (
                          <span
                            onClick={(e) => { togglePin(tag.slug, e); setMoreOpen(false); setSearch(""); }}
                            title="Pin to bar"
                            className="opacity-70 hover:opacity-100 transition-opacity"
                          >
                            <PinIcon filled={false} />
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
