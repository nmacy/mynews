"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTagDefinitions } from "@/components/TagProvider";

interface FilterBarProps {
  activeFilters: { tags: string[]; sources: string[]; date: string };
  hasActiveFilters: boolean;
}

const DATE_OPTIONS = [
  { value: "", label: "All time" },
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const selectStyle: React.CSSProperties = {
  backgroundColor: "var(--mn-card)",
  border: "1px solid var(--mn-border)",
  color: "var(--mn-fg)",
};

export function FilterBar({
  activeFilters,
  hasActiveFilters,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const TAG_DEFINITIONS = useTagDefinitions();
  const [open, setOpen] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-open filter bar when filters are active (e.g. from URL params or TagBadge click)
  useEffect(() => {
    if (hasActiveFilters) setOpen(true);
  }, [hasActiveFilters]);

  // Close tag dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(e.target as Node)
      ) {
        setTagDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams]
  );

  const toggleTag = useCallback(
    (slug: string) => {
      const current = new Set(activeFilters.tags);
      if (current.has(slug)) {
        current.delete(slug);
      } else {
        current.add(slug);
      }
      const value = Array.from(current).join(",");
      updateParam("tag", value);
    },
    [activeFilters.tags, updateParam]
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tag");
    params.delete("sources");
    params.delete("source");
    params.delete("date");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, searchParams]);

  const filterCount = activeFilters.tags.length +
    activeFilters.sources.length +
    (activeFilters.date ? 1 : 0);

  const tagLabel =
    activeFilters.tags.length === 0
      ? "All tags"
      : activeFilters.tags.length === 1
        ? TAG_DEFINITIONS.find((t) => t.slug === activeFilters.tags[0])?.label ??
          activeFilters.tags[0]
        : `${activeFilters.tags.length} tags`;

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg"
        style={{
          color: "var(--mn-muted)",
          backgroundColor: hasActiveFilters ? "var(--mn-card)" : "transparent",
          border: hasActiveFilters
            ? "1px solid var(--mn-border)"
            : "1px solid transparent",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filters
        {filterCount > 0 && (
          <span
            className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full"
            style={{
              backgroundColor: "var(--mn-link)",
              color: "var(--mn-bg)",
            }}
          >
            {filterCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="flex flex-wrap items-center gap-3 mt-3 text-sm"
          style={{ color: "var(--mn-muted)" }}
        >
          {/* Tag multi-select dropdown */}
          <div className="relative" ref={tagDropdownRef}>
            <button
              onClick={() => setTagDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm"
              style={selectStyle}
            >
              <span style={{ color: "var(--mn-muted)" }}>Tag:</span>
              <span>{tagLabel}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${tagDropdownOpen ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {tagDropdownOpen && (
              <div
                className="absolute left-0 top-full mt-1 z-50 rounded-lg py-1 shadow-lg max-h-64 overflow-y-auto min-w-[180px]"
                style={{
                  backgroundColor: "var(--mn-card)",
                  border: "1px solid var(--mn-border)",
                }}
              >
                {TAG_DEFINITIONS.map((t) => (
                  <label
                    key={t.slug}
                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:opacity-80"
                  >
                    <input
                      type="checkbox"
                      checked={activeFilters.tags.includes(t.slug)}
                      onChange={() => toggleTag(t.slug)}
                      className="accent-current"
                    />
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span style={{ color: "var(--mn-fg)" }}>{t.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-1.5">
            Date:
            <select
              value={activeFilters.date}
              onChange={(e) => updateParam("date", e.target.value)}
              className="rounded-lg px-2 py-1.5 text-sm outline-none"
              style={selectStyle}
            >
              {DATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="text-sm hover:underline"
              style={{ color: "var(--mn-link)" }}
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
