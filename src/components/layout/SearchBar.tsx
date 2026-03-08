"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTagDefinitions } from "@/components/TagProvider";
import { useConfig } from "@/components/ConfigProvider";

interface SearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  setQuery: (q: string) => void;
}

type Suggestion =
  | { type: "tag"; slug: string; label: string; color: string }
  | { type: "source"; id: string; name: string };

export function SearchBar({ isOpen, onClose, query, setQuery }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const tagDefinitions = useTagDefinitions();
  const { allSources } = useConfig();
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);

  const suggestions = useMemo((): Suggestion[] => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const tags: Suggestion[] = tagDefinitions
      .filter((t) => t.label.toLowerCase().includes(q) || t.slug.includes(q))
      .slice(0, 5)
      .map((t) => ({ type: "tag", slug: t.slug, label: t.label, color: t.color }));

    const seen = new Set<string>();
    const sources: Suggestion[] = [];
    for (const s of allSources) {
      const lower = s.name.toLowerCase();
      if (lower.includes(q) && !seen.has(lower)) {
        seen.add(lower);
        sources.push({ type: "source", id: s.id, name: s.name });
        if (sources.length >= 5) break;
      }
    }

    return [...tags, ...sources];
  }, [query, tagDefinitions, allSources]);

  const selectSuggestion = useCallback(
    (s: Suggestion) => {
      if (s.type === "tag") {
        router.push(`/tag/${s.slug}`);
      } else {
        router.push(`/source/${s.id}`);
      }
      setQuery("");
      onClose();
    },
    [router, setQuery, onClose]
  );

  const handleSubmit = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      selectSuggestion(suggestions[selectedIndex]);
      return;
    }
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/");
    }
    onClose();
  }, [query, router, onClose, selectedIndex, suggestions, selectSuggestion]);

  const handleClear = useCallback(() => {
    setQuery("");
    router.push("/");
    onClose();
  }, [setQuery, router, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
      } else if (e.key === "Enter") {
        handleSubmit();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [suggestions.length, handleSubmit, onClose]
  );

  if (!isOpen) return null;

  const tagSuggestions = suggestions.filter((s) => s.type === "tag");
  const sourceSuggestions = suggestions.filter((s) => s.type === "source");

  return (
    <div
      className="border-b relative"
      style={{
        backgroundColor: "var(--mn-card)",
        borderColor: "var(--mn-border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          style={{ color: "var(--mn-muted)" }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search articles..."
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: "var(--mn-text)" }}
        />
        {query && (
          <button
            onClick={handleClear}
            className="p-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: "var(--mn-muted)" }}
            aria-label="Clear search"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-70"
          style={{ color: "var(--mn-muted)" }}
        >
          ESC
        </button>
      </div>

      {suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 border-b shadow-lg z-50"
          style={{
            backgroundColor: "var(--mn-card)",
            borderColor: "var(--mn-border)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            {tagSuggestions.length > 0 && (
              <div>
                <div
                  className="text-[11px] font-medium uppercase tracking-wider px-3 py-1"
                  style={{ color: "var(--mn-muted)" }}
                >
                  Tags
                </div>
                {tagSuggestions.map((s) => {
                  const idx = suggestions.indexOf(s);
                  const tag = s as Extract<Suggestion, { type: "tag" }>;
                  return (
                    <button
                      key={tag.slug}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-left transition-colors"
                      style={{
                        color: "var(--mn-text)",
                        backgroundColor:
                          idx === selectedIndex ? "var(--mn-border)" : "transparent",
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => selectSuggestion(s)}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            )}
            {sourceSuggestions.length > 0 && (
              <div className={tagSuggestions.length > 0 ? "mt-1" : ""}>
                <div
                  className="text-[11px] font-medium uppercase tracking-wider px-3 py-1"
                  style={{ color: "var(--mn-muted)" }}
                >
                  Sources
                </div>
                {sourceSuggestions.map((s) => {
                  const idx = suggestions.indexOf(s);
                  const src = s as Extract<Suggestion, { type: "source" }>;
                  return (
                    <button
                      key={src.id}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-left transition-colors"
                      style={{
                        color: "var(--mn-text)",
                        backgroundColor:
                          idx === selectedIndex ? "var(--mn-border)" : "transparent",
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => selectSuggestion(s)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0"
                        style={{ color: "var(--mn-muted)" }}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                        <path d="M2 12h20" />
                      </svg>
                      {src.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
