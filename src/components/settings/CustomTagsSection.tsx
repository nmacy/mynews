"use client";

import { useState, useEffect, useCallback } from "react";
import { useRefreshTags } from "@/components/TagProvider";

interface CustomTag {
  id: string;
  slug: string;
  label: string;
  color: string;
  parent?: string | null;
}

interface SuggestedTag {
  slug: string;
  label: string;
  reason: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CustomTagsSection() {
  const refreshTags = useRefreshTags();
  const [tags, setTags] = useState<CustomTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);

  // Manual creation
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // AI discovery
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedTag[]>([]);
  const [createdSlugs, setCreatedSlugs] = useState<Set<string>>(new Set());

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/custom-tags");
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
    fetch("/api/ai-status")
      .then((res) => res.json())
      .then((data) => setAiEnabled(data.enabled === true))
      .catch(() => setAiEnabled(false));
  }, [fetchTags]);

  const handleCreate = async () => {
    const label = newLabel.trim();
    if (!label) return;

    const slug = slugify(label);
    if (slug.length < 3) {
      setCreateError("Tag name too short (3+ chars)");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/admin/custom-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, label }),
      });
      if (!res.ok) {
        let msg = "Failed to create tag";
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {
          // non-JSON response
        }
        setCreateError(msg);
        return;
      }
      setNewLabel("");
      await fetchTags();
      refreshTags();
    } catch {
      setCreateError("Network error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (slug: string) => {
    try {
      const res = await fetch(`/api/admin/custom-tags?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchTags();
        refreshTags();
      }
    } catch {
      // ignore
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscoverError(null);
    setSuggestions([]);

    try {
      // Fetch recent articles to analyze
      const feedRes = await fetch("/api/feeds?limit=20");
      if (!feedRes.ok) {
        setDiscoverError("Failed to fetch articles");
        return;
      }
      const feedData = await feedRes.json();
      const articles = (feedData.articles ?? []).slice(0, 20).map(
        (a: { title?: string; description?: string }) => ({
          title: a.title ?? "",
          description: a.description ?? "",
        })
      );

      if (articles.length === 0) {
        setDiscoverError("No articles available to analyze");
        return;
      }

      const res = await fetch("/api/admin/discover-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDiscoverError(data.error || "Discovery failed");
        return;
      }

      setSuggestions(data.suggestions ?? []);
    } catch {
      setDiscoverError("Network error");
    } finally {
      setDiscovering(false);
    }
  };

  const handleCreateSuggested = async (suggestion: SuggestedTag) => {
    try {
      const res = await fetch("/api/admin/custom-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: suggestion.slug, label: suggestion.label }),
      });
      if (res.ok) {
        setCreatedSlugs((prev) => new Set([...prev, suggestion.slug]));
        await fetchTags();
        refreshTags();
      }
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !creating) {
      handleCreate();
    }
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{
        backgroundColor: "var(--mn-card)",
        border: "1px solid var(--mn-border)",
      }}
    >
      <h2 className="text-lg font-bold mb-2">Custom Tags</h2>
      <p className="text-sm mb-4" style={{ color: "var(--mn-muted)" }}>
        Create custom tag categories. AI-created tags extend the tag system beyond the built-in set.
      </p>

      {/* Existing custom tags */}
      {!loading && tags.length > 0 && (
        <div className="mb-4">
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--mn-muted)" }}
          >
            Custom Tags
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.slug}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full"
                style={{
                  color: tag.color,
                  backgroundColor: `${tag.color}15`,
                  border: `1px solid ${tag.color}40`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.label}
                <button
                  onClick={() => handleDelete(tag.slug)}
                  className="ml-0.5 hover:opacity-70 text-current"
                  aria-label={`Delete ${tag.label}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {!loading && tags.length === 0 && (
        <p
          className="text-sm mb-4"
          style={{ color: "var(--mn-muted2)" }}
        >
          No custom tags yet.
        </p>
      )}

      {/* AI Discovery */}
      {aiEnabled && (
        <div className="mb-4">
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--mn-muted)" }}
          >
            AI Discovery
          </p>
          <p className="text-sm mb-2" style={{ color: "var(--mn-muted)" }}>
            Analyze your recent articles to discover new tag categories.
          </p>
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: "var(--mn-accent)" }}
          >
            {discovering ? "Analyzing..." : "Discover Tags"}
          </button>

          {discoverError && (
            <p className="text-sm text-red-500 mt-2">{discoverError}</p>
          )}

          {suggestions.length > 0 && (
            <div className="mt-3 space-y-2">
              {suggestions.map((s) => {
                const alreadyCreated = createdSlugs.has(s.slug);
                return (
                  <div
                    key={s.slug}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg text-sm"
                    style={{
                      backgroundColor: "var(--mn-bg)",
                      border: "1px solid var(--mn-border)",
                    }}
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{s.label}</span>
                      <span
                        className="ml-2 text-xs"
                        style={{ color: "var(--mn-muted2)" }}
                      >
                        {s.slug}
                      </span>
                      <p
                        className="text-xs mt-0.5 truncate"
                        style={{ color: "var(--mn-muted)" }}
                      >
                        {s.reason}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCreateSuggested(s)}
                      disabled={alreadyCreated}
                      className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-40"
                      style={{ backgroundColor: "var(--mn-accent)" }}
                    >
                      {alreadyCreated ? "Created" : "Create"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Manual creation */}
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-wide mb-2"
          style={{ color: "var(--mn-muted)" }}
        >
          Create Manually
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => {
              setNewLabel(e.target.value);
              setCreateError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tag name (e.g. Education)"
            maxLength={30}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: "var(--mn-bg)",
              border: "1px solid var(--mn-border)",
              color: "var(--mn-fg)",
            }}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newLabel.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: "var(--mn-accent)" }}
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
        {newLabel.trim() && (
          <p
            className="text-xs mt-1"
            style={{ color: "var(--mn-muted2)" }}
          >
            Slug: {slugify(newLabel.trim())}
          </p>
        )}
        {createError && (
          <p className="text-sm text-red-500 mt-1">{createError}</p>
        )}
      </div>
    </div>
  );
}
