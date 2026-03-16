"use client";

import { useState, useMemo, useEffect } from "react";
import { useConfig } from "@/components/ConfigProvider";
import { SOURCE_LIBRARY, SOURCE_CATEGORIES } from "@/config/source-library";
import {
  loadCustomLibrarySources,
  saveCustomLibrarySource,
} from "@/lib/custom-sources";
import type { Source, LibrarySource } from "@/types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateSourceId(name: string): string {
  return slugify(name) + "-" + Math.random().toString(36).slice(2, 7);
}

function SourceRow({
  source,
  disabled,
  onToggle,
  onRemove,
  onTogglePaywall,
}: {
  source: Source;
  disabled: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onTogglePaywall: () => void;
}) {
  return (
    <div
      className="py-3 px-3 rounded-xl"
      style={{
        backgroundColor: "var(--mn-bg)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{source.name}</span>
          <button
            onClick={onTogglePaywall}
            className={`text-xs px-1.5 py-0.5 rounded cursor-pointer transition-colors flex-shrink-0 ${
              source.paywalled
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                : ""
            }`}
            style={
              source.paywalled
                ? undefined
                : { backgroundColor: "var(--mn-border)", color: "var(--mn-muted2)" }
            }
            title="Toggle paywalled status"
          >
            {source.paywalled ? "Paywalled" : "Free"}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onToggle}
            className="relative w-10 h-6 rounded-full transition-colors"
            style={{
              backgroundColor: disabled ? "var(--mn-border)" : "#34C759",
            }}
            aria-label={disabled ? `Enable ${source.name}` : `Disable ${source.name}`}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
              style={{ left: disabled ? "2px" : "18px" }}
            />
          </button>
          <button
            onClick={onRemove}
            className="text-red-500 hover:text-red-600 text-sm font-medium px-1"
            aria-label={`Remove ${source.name}`}
          >
            &times;
          </button>
        </div>
      </div>
      <p className="text-xs truncate" style={{ color: "var(--mn-muted2)" }}>
        {source.url}
      </p>
    </div>
  );
}

function SourceLibraryCard({
  source,
  added,
  onAdd,
}: {
  source: LibrarySource;
  added: boolean;
  onAdd: (source: LibrarySource) => void;
}) {
  return (
    <button
      onClick={() => !added && onAdd(source)}
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
        <span className="font-medium truncate">{source.name}</span>
        {added && (
          <span
            className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ backgroundColor: "var(--mn-border)", color: "var(--mn-muted2)" }}
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
}

function SourceLibraryGrid({
  sources,
  activeSourceIds,
  activeSourceUrls,
  onAdd,
  onAddAll,
}: {
  sources: LibrarySource[];
  activeSourceIds: Set<string>;
  activeSourceUrls: Set<string>;
  onAdd: (source: LibrarySource) => void;
  onAddAll?: (sources: LibrarySource[]) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, LibrarySource[]>();
    for (const s of sources) {
      const list = map.get(s.category) || [];
      list.push(s);
      map.set(s.category, list);
    }
    return map;
  }, [sources]);

  const categories = useMemo(() => {
    const ordered: string[] = [];
    for (const cat of SOURCE_CATEGORIES) {
      if (grouped.has(cat)) ordered.push(cat);
    }
    for (const cat of grouped.keys()) {
      if (!ordered.includes(cat)) ordered.push(cat);
    }
    return ordered;
  }, [grouped]);

  const isAdded = (s: LibrarySource) =>
    activeSourceIds.has(s.id) || activeSourceUrls.has(s.url);

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const catSources = grouped.get(category)!;
        const unadded = catSources.filter((s) => !isAdded(s));
        return (
          <div key={category}>
            <div className="flex items-center justify-between mb-2">
              <h4
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--mn-muted)" }}
              >
                {category}
              </h4>
              {onAddAll && unadded.length > 0 && (
                <button
                  onClick={() => onAddAll(unadded)}
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ color: "var(--mn-accent)" }}
                >
                  Add All ({unadded.length})
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {catSources.map((source) => (
                <SourceLibraryCard
                  key={source.id}
                  source={source}
                  added={isAdded(source)}
                  onAdd={onAdd}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ManualSourceForm({
  onAdd,
}: {
  onAdd: (source: Source, asLibrary: LibrarySource) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [paywalled, setPaywalled] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;

    setValidating(true);
    setError(null);

    try {
      const res = await fetch("/api/validate-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Validation failed");
        return;
      }

      if (!data.valid) {
        setError("URL is not a valid RSS feed or news page");
        return;
      }

      const id = slugify(trimmedName) || generateSourceId(trimmedName);
      const source: Source = {
        id,
        name: trimmedName,
        url: trimmedUrl,
        priority: 2,
        paywalled,
        type: data.type,
      };
      const libSource: LibrarySource = { ...source, category: "Custom" };

      onAdd(source, libSource);
      setName("");
      setUrl("");
      setPaywalled(false);
    } catch {
      setError("Network error during validation");
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--mn-muted)" }}
      >
        Add Manually
      </h4>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Source name"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{
          backgroundColor: "var(--mn-card)",
          border: "1px solid var(--mn-border)",
          color: "var(--mn-fg)",
        }}
      />
      <input
        type="url"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setError(null); }}
        placeholder="RSS feed or news page URL"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{
          backgroundColor: "var(--mn-card)",
          border: "1px solid var(--mn-border)",
          color: "var(--mn-fg)",
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={paywalled}
          onChange={(e) => setPaywalled(e.target.checked)}
          className="rounded"
        />
        Paywalled
      </label>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={!name.trim() || !url.trim() || validating}
        className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
        style={{ backgroundColor: "var(--mn-accent)" }}
      >
        {validating ? "Validating..." : "Add Source"}
      </button>
    </div>
  );
}

function DiscoverSourcesInline({
  activeSourceIds,
  activeSourceUrls,
  onAdd,
}: {
  activeSourceIds: Set<string>;
  activeSourceUrls: Set<string>;
  onAdd: (source: LibrarySource) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LibrarySource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

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
      if (!res.ok) { setError(data.error || "Discovery failed"); return; }
      setResults(data.sources ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const isAdded = (source: LibrarySource) =>
    activeSourceIds.has(source.id) || activeSourceUrls.has(source.url);

  return (
    <div>
      <h4
        className="text-xs font-semibold uppercase tracking-wide mb-2"
        style={{ color: "var(--mn-muted)" }}
      >
        Discover Sources
      </h4>
      <p className="text-sm mb-2" style={{ color: "var(--mn-muted)" }}>
        Search by name or topic
      </p>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleDiscover(); }}
          placeholder='e.g. "gaming news", "climate science"'
          maxLength={100}
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: "var(--mn-card)",
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
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {results.map((source) => {
            const added = isAdded(source);
            return (
              <button
                key={source.id}
                onClick={() => !added && onAdd(source)}
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
                      style={{ backgroundColor: "var(--mn-border)", color: "var(--mn-muted2)" }}
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
        <p className="text-sm text-center py-3" style={{ color: "var(--mn-muted2)" }}>
          No sources found. Try a different search term.
        </p>
      )}
    </div>
  );
}

export function SourcesSection() {
  const {
    allSources,
    disabledSourceIds,
    addSource,
    addSources,
    removeSource,
    toggleSource,
    togglePaywall,
  } = useConfig();

  const [expanded, setExpanded] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [libraryExpanded, setLibraryExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [customSources, setCustomSources] = useState<LibrarySource[]>([]);

  useEffect(() => {
    setCustomSources(loadCustomLibrarySources());
  }, []);

  const activeSourceIds = useMemo(
    () => new Set(allSources.map((s) => s.id)),
    [allSources]
  );
  const activeSourceUrls = useMemo(
    () => new Set(allSources.map((s) => s.url)),
    [allSources]
  );

  const filteredSources = useMemo(() => {
    if (!search.trim()) return allSources;
    const q = search.toLowerCase();
    return allSources.filter(
      (s) => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q)
    );
  }, [allSources, search]);

  const allLibrary = useMemo(
    () => [...SOURCE_LIBRARY, ...customSources],
    [customSources]
  );

  const filteredLibrary = useMemo(() => {
    if (!librarySearch.trim()) return allLibrary;
    const q = librarySearch.toLowerCase();
    return allLibrary.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [allLibrary, librarySearch]);

  const handleAddLibrary = (source: LibrarySource) => {
    addSource({
      id: source.id,
      name: source.name,
      url: source.url,
      priority: source.priority,
      paywalled: source.paywalled,
      type: source.type,
    });
  };

  const handleAddAll = (sources: LibrarySource[]) => {
    addSources(
      sources.map((source) => ({
        id: source.id,
        name: source.name,
        url: source.url,
        priority: source.priority,
        paywalled: source.paywalled,
        type: source.type,
      }))
    );
  };

  const handleAddManual = (source: Source, libSource: LibrarySource) => {
    addSource(source);
    saveCustomLibrarySource(libSource);
    setCustomSources(loadCustomLibrarySources());
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <h2 className="text-lg font-bold">
          Sources
          <span className="text-sm font-normal ml-2" style={{ color: "var(--mn-muted)" }}>
            ({allSources.length})
          </span>
        </h2>
        <span
          className="text-sm transition-transform duration-200"
          style={{ color: "var(--mn-muted)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          &#9660;
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {/* Your Sources sub-section */}
          <div
            className="rounded-xl p-3"
            style={{ backgroundColor: "var(--mn-bg)" }}
          >
            <button
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-sm font-semibold">
                Your Sources
                <span className="font-normal ml-1.5" style={{ color: "var(--mn-muted)" }}>
                  ({allSources.length})
                </span>
              </h3>
              <span
                className="text-xs transition-transform duration-200"
                style={{ color: "var(--mn-muted)", transform: sourcesExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                &#9660;
              </span>
            </button>

            {sourcesExpanded && (
              <>
                {allSources.length > 0 && (
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your sources..."
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none mt-3"
                    style={{
                      backgroundColor: "var(--mn-card)",
                      border: "1px solid var(--mn-border)",
                      color: "var(--mn-fg)",
                    }}
                  />
                )}

                <div className="space-y-2 mt-3">
                  {filteredSources.map((source) => (
                    <SourceRow
                      key={source.id}
                      source={source}
                      disabled={disabledSourceIds.has(source.id)}
                      onToggle={() => toggleSource(source.id)}
                      onRemove={() => removeSource(source.id)}
                      onTogglePaywall={() => togglePaywall(source.id)}
                    />
                  ))}
                </div>

                {allSources.length > 0 && filteredSources.length === 0 && (
                  <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted2)" }}>
                    No sources match &ldquo;{search}&rdquo;
                  </p>
                )}

                {allSources.length === 0 && (
                  <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted2)" }}>
                    No sources configured
                  </p>
                )}
              </>
            )}
          </div>

          {/* Source Library sub-section */}
          <div
            className="rounded-xl p-3"
            style={{ backgroundColor: "var(--mn-bg)" }}
          >
            <button
              onClick={() => setLibraryExpanded(!libraryExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-sm font-semibold">Source Library</h3>
              <span
                className="text-xs transition-transform duration-200"
                style={{ color: "var(--mn-muted)", transform: libraryExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                &#9660;
              </span>
            </button>

            {libraryExpanded && (
              <div className="mt-3 space-y-4">
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search sources..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    backgroundColor: "var(--mn-card)",
                    border: "1px solid var(--mn-border)",
                    color: "var(--mn-fg)",
                  }}
                />

                <SourceLibraryGrid
                  sources={filteredLibrary}
                  activeSourceIds={activeSourceIds}
                  activeSourceUrls={activeSourceUrls}
                  onAdd={handleAddLibrary}
                  onAddAll={handleAddAll}
                />

                <div
                  className="border-t pt-4"
                  style={{ borderColor: "var(--mn-border)" }}
                >
                  <DiscoverSourcesInline
                    activeSourceIds={activeSourceIds}
                    activeSourceUrls={activeSourceUrls}
                    onAdd={handleAddLibrary}
                  />
                </div>

                <div
                  className="border-t pt-4"
                  style={{ borderColor: "var(--mn-border)" }}
                >
                  <ManualSourceForm onAdd={handleAddManual} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
