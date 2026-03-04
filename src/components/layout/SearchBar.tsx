"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  setQuery: (q: string) => void;
}

export function SearchBar({ isOpen, onClose, query, setQuery }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/");
    }
    onClose();
  }, [query, router, onClose]);

  const handleClear = useCallback(() => {
    setQuery("");
    router.push("/");
    onClose();
  }, [setQuery, router, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="border-b"
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
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onClose();
          }}
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
    </div>
  );
}
