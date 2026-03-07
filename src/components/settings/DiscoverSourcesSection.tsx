"use client";

import { useState, useMemo } from "react";
import { useConfig } from "@/components/ConfigProvider";
import type { LibrarySource } from "@/types";

export function DiscoverSourcesSection() {
  const { allSources, addSource } = useConfig();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LibrarySource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const activeSourceUrls = useMemo(
    () => new Set(allSources.map((s) => s.url)),
    [allSources]
  );
  const activeSourceIds = useMemo(
    () => new Set(allSources.map((s) => s.id)),
    [allSources]
  );

  const handleDiscover = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setSearched(true);

    try {
      const res = await fetch("/api/discover-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Discovery failed");
        return;
      }

      setResults(data.sources ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleDiscover();
    }
  };

  const isAdded = (source: LibrarySource) =>
    activeSourceIds.has(source.id) || activeSourceUrls.has(source.url);

  const handleAdd = (source: LibrarySource) => {
    addSource({
      id: source.id,
      name: source.name,
      url: source.url,
      priority: source.priority,
      paywalled: source.paywalled,
      type: source.type,
    });
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{
        backgroundColor: "var(--mn-card)",
        border: "1px solid var(--mn-border)",
      }}
    >
      <h2 className="text-lg font-bold mb-2">Discover Sources</h2>
      <p className="text-sm mb-4" style={{ color: "var(--mn-muted)" }}>
        Search by name or topic
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='e.g. "gaming news", "climate science"'
          maxLength={100}
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: "var(--mn-bg)",
            border: "1px solid var(--mn-border)",
            color: "var(--mn-fg)",
          }}
        />
        <button
          onClick={handleDiscover}
          disabled={loading || !query.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: "var(--mn-accent)" }}
        >
          {loading ? "Searching..." : "Discover"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-3">{error}</p>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {results.map((source) => {
            const added = isAdded(source);
            return (
              <button
                key={source.id}
                onClick={() => !added && handleAdd(source)}
                disabled={added}
                className="text-left px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: added ? "var(--mn-bg)" : "var(--mn-card)",
                  border: "1px solid var(--mn-border)",
                  opacity: added ? 0.6 : 1,
                  cursor: added ? "default" : "pointer",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{source.name}</span>
                  {added && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        backgroundColor: "var(--mn-border)",
                        color: "var(--mn-muted2)",
                      }}
                    >
                      Added
                    </span>
                  )}
                  {!added && source.paywalled && (
                    <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                      $
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <p
          className="text-sm text-center py-3"
          style={{ color: "var(--mn-muted2)" }}
        >
          No sources found. Try a different search term.
        </p>
      )}
    </div>
  );
}
