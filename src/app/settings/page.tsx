"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { useConfig } from "@/components/ConfigProvider";
import { useTheme, type ThemePreference, type AccentId } from "@/components/ThemeProvider";
import { ACCENT_PALETTES } from "@/config/accents";
import { AiSettingsSection } from "@/components/settings/AiTaggerSection";
import { DefaultSourcesSection } from "@/components/settings/DefaultSourcesSection";
import { CustomTagsSection } from "@/components/settings/CustomTagsSection";
import { AdminUsersSection } from "@/components/settings/AdminUsersSection";
import { CacheSection } from "@/components/settings/CacheSection";
import { LogViewerSection } from "@/components/settings/LogViewerSection";
import { SystemStatusSection } from "@/components/settings/SystemStatusSection";
import { DEFAULT_FEATURED_TAGS } from "@/components/layout/TagTabs";
import { useSourceGroups, sourceColor } from "@/components/layout/SourceBar";
import { useTagDefinitions, useTagMap } from "@/components/TagProvider";
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

// --- Tag Bar Section ---

function SortableTag({
  slug,
  label,
  color,
  onRemove,
}: {
  slug: string;
  label: string;
  color: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: color,
    color: "white",
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      className="px-3 py-1.5 text-sm font-medium rounded-full transition-colors touch-none select-none"
      onClick={onRemove}
      {...attributes}
      {...listeners}
    >
      {label}
    </button>
  );
}

function TagBarSection() {
  const { featuredTags, setFeaturedTags } = useConfig();
  const TAG_MAP = useTagMap();
  const TAG_DEFINITIONS = useTagDefinitions();
  const [tagSearch, setTagSearch] = useState("");

  const isCustomized =
    featuredTags.length !== DEFAULT_FEATURED_TAGS.length ||
    featuredTags.some((t, i) => t !== DEFAULT_FEATURED_TAGS[i]);

  const featuredSet = new Set(featuredTags);

  const removeTag = (slug: string) => {
    setFeaturedTags(featuredTags.filter((t) => t !== slug));
  };

  const addTag = (slug: string) => {
    setFeaturedTags([...featuredTags, slug]);
  };

  const selectedTags = featuredTags
    .map((slug) => TAG_MAP.get(slug))
    .filter(Boolean);
  const unselectedTags = TAG_DEFINITIONS.filter((t) => !featuredSet.has(t.slug));
  const filteredUnselected = tagSearch
    ? unselectedTags.filter((t) => t.label.toLowerCase().includes(tagSearch.toLowerCase()))
    : unselectedTags;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = featuredTags.indexOf(active.id as string);
      const newIndex = featuredTags.indexOf(over.id as string);
      setFeaturedTags(arrayMove(featuredTags, oldIndex, newIndex));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Tag Bar</h3>
        {isCustomized && (
          <button
            onClick={() => setFeaturedTags(DEFAULT_FEATURED_TAGS)}
            className="text-sm font-medium"
            style={{ color: "var(--mn-accent)" }}
          >
            Reset to defaults
          </button>
        )}
      </div>
      <p className="text-sm mb-3" style={{ color: "var(--mn-muted)" }}>
        Drag to reorder. Click to remove. Choose which tags appear in the navigation bar.
      </p>

      {selectedTags.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--mn-muted)" }}>
            Selected
          </p>
          <DndContext
            id="tag-bar-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToParentElement]}
          >
            <SortableContext items={featuredTags} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedTags.map((tag) => {
                  if (!tag) return null;
                  return (
                    <SortableTag
                      key={tag.slug}
                      slug={tag.slug}
                      label={tag.label}
                      color={tag.color}
                      onRemove={() => removeTag(tag.slug)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {unselectedTags.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--mn-muted)" }}>
              Available
            </p>
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tags..."
              className="flex-1 max-w-[200px] px-2.5 py-1 text-sm rounded-md outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                color: "var(--mn-fg)",
                border: "1px solid var(--mn-border)",
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredUnselected.length === 0 && (
              <p className="text-sm" style={{ color: "var(--mn-muted)" }}>No tags found</p>
            )}
            {filteredUnselected.map((tag) => (
              <button
                key={tag.slug}
                onClick={() => addTag(tag.slug)}
                className="px-3 py-1.5 text-sm font-medium rounded-full transition-colors"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--mn-muted)",
                  border: "1px solid var(--mn-border)",
                }}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Source Bar Section ---

function SortableSourceGroup({
  name,
  onRemove,
}: {
  name: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: sourceColor(name),
    color: "white",
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      className="px-3 py-1.5 text-sm font-medium rounded-full transition-colors touch-none select-none"
      onClick={onRemove}
      {...attributes}
      {...listeners}
    >
      {name}
    </button>
  );
}

function SourceBarSection() {
  const { sourceBarOrder, setSourceBarOrder } = useConfig();
  const groups = useSourceGroups();
  const [sourceSearch, setSourceSearch] = useState("");

  const allGroupNames = groups.map((g) => g.name);
  // If no custom order, treat all as "available" (natural order)
  const isCustomized = sourceBarOrder.length > 0;
  const orderedSet = new Set(sourceBarOrder);
  const unordered = allGroupNames.filter((n) => !orderedSet.has(n));
  const filteredUnordered = sourceSearch
    ? unordered.filter((n) => n.toLowerCase().includes(sourceSearch.toLowerCase()))
    : unordered;

  const removeGroup = (name: string) => {
    setSourceBarOrder(sourceBarOrder.filter((n) => n !== name));
  };

  const addGroup = (name: string) => {
    setSourceBarOrder([...sourceBarOrder, name]);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sourceBarOrder.indexOf(active.id as string);
      const newIndex = sourceBarOrder.indexOf(over.id as string);
      setSourceBarOrder(arrayMove(sourceBarOrder, oldIndex, newIndex));
    }
  };

  if (allGroupNames.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Source Bar</h3>
        {isCustomized && (
          <button
            onClick={() => setSourceBarOrder([])}
            className="text-sm font-medium"
            style={{ color: "var(--mn-accent)" }}
          >
            Reset order
          </button>
        )}
      </div>
      <p className="text-sm mb-3" style={{ color: "var(--mn-muted)" }}>
        Drag to reorder. Click to remove. Sources with the same name are grouped into one pill.
      </p>

      {sourceBarOrder.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--mn-muted)" }}>
            Ordered
          </p>
          <DndContext
            id="source-bar-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToParentElement]}
          >
            <SortableContext items={sourceBarOrder} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-wrap gap-2 mb-4">
                {sourceBarOrder.map((name) => {
                  // Only show if this group still exists
                  if (!allGroupNames.includes(name)) return null;
                  return (
                    <SortableSourceGroup
                      key={name}
                      name={name}
                      onRemove={() => removeGroup(name)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {unordered.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--mn-muted)" }}>
              {isCustomized ? "Remaining" : "All sources"}
            </p>
            <input
              type="text"
              value={sourceSearch}
              onChange={(e) => setSourceSearch(e.target.value)}
              placeholder="Search sources..."
              className="flex-1 max-w-[200px] px-2.5 py-1 text-sm rounded-md outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                color: "var(--mn-fg)",
                border: "1px solid var(--mn-border)",
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredUnordered.length === 0 && (
              <p className="text-sm" style={{ color: "var(--mn-muted)" }}>No sources found</p>
            )}
            {filteredUnordered.map((name) => (
              <button
                key={name}
                onClick={() => addGroup(name)}
                className="px-3 py-1.5 text-sm font-medium rounded-full transition-colors"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--mn-muted)",
                  border: "1px solid var(--mn-border)",
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Theme Section ---

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function ThemeSection() {
  const { preference, setTheme } = useTheme();
  const { saveTheme } = useConfig();

  const handleSelect = (pref: ThemePreference) => {
    setTheme(pref);
    saveTheme(pref);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">Theme</h3>
      <div className="flex gap-2">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={
              preference === opt.value
                ? { backgroundColor: "var(--mn-accent)", color: "white" }
                : {
                    backgroundColor: "var(--mn-bg)",
                    color: "var(--mn-fg)",
                    border: "1px solid var(--mn-border)",
                  }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Accent Section ---

function AccentSection() {
  const { accent, setAccent, theme } = useTheme();
  const { saveAccent } = useConfig();

  const handleSelect = (id: AccentId) => {
    setAccent(id);
    saveAccent(id);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">Accent Color</h3>
      <div className="flex flex-wrap gap-3">
        {ACCENT_PALETTES.map((palette) => {
          const color = theme === "dark" ? palette.dark.accent : palette.light.accent;
          const isSelected = accent === palette.id;
          return (
            <button
              key={palette.id}
              onClick={() => handleSelect(palette.id)}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className="w-9 h-9 rounded-full transition-shadow"
                style={{
                  backgroundColor: color,
                  boxShadow: isSelected
                    ? `0 0 0 2px var(--mn-card), 0 0 0 4px ${color}`
                    : "none",
                }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: isSelected ? color : "var(--mn-muted)" }}
              >
                {palette.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Sources Section ---

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

  // Order categories: SOURCE_CATEGORIES first, then any custom
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

function SourcesSection() {
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

// --- Rescan Section ---

function RescanSection() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number; source: string } | null>(null);
  const [aiProgress, setAiProgress] = useState<{ completed: number; total: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleRescan = async () => {
    setScanning(true);
    setResult(null);
    setProgress(null);
    setAiProgress(null);
    try {
      const res = await fetch("/api/feeds", { method: "POST" });
      if (!res.ok || !res.body) throw new Error("Rescan failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "progress") {
            setProgress({ completed: event.completed, total: event.total, source: event.source });
          } else if (event.type === "ai-tagging") {
            setProgress(null);
            setAiProgress({ completed: 0, total: event.total });
          } else if (event.type === "ai-progress") {
            setAiProgress({ completed: event.completed, total: event.total });
          } else if (event.type === "done") {
            setProgress(null);
            setAiProgress(null);
            // Clear client-side AI tag cache so pages use fresh server tags
            try { localStorage.removeItem("mynews-ai-tags"); } catch {}
            const aiMsg = event.aiTagged > 0 ? ` (${event.aiTagged} AI-tagged)` : "";
            setResult(`Rescanned ${event.count} articles${aiMsg}`);
          }
        }
      }
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Rescan failed");
    } finally {
      setScanning(false);
    }
  };

  const pct = progress ? Math.round((progress.completed / progress.total) * 100) : 0;
  const aiPct = aiProgress ? Math.round((aiProgress.completed / aiProgress.total) * 100) : 0;

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-2">Rescan Articles</h2>
      <p className="text-sm mb-4" style={{ color: "var(--mn-muted)" }}>
        Clear the article cache and re-fetch all feeds with fresh tags. If AI is enabled, articles will also be tagged using AI.
      </p>

      {scanning && progress && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1" style={{ color: "var(--mn-muted)" }}>
            <span>Fetching {progress.source}...</span>
            <span>{progress.completed}/{progress.total} sources</span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--mn-border)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: "var(--mn-accent)" }}
            />
          </div>
        </div>
      )}

      {scanning && aiProgress && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1" style={{ color: "var(--mn-muted)" }}>
            <span>AI tagging articles...</span>
            <span>{aiProgress.completed}/{aiProgress.total}</span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--mn-border)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${aiPct}%`, backgroundColor: "var(--mn-accent)" }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleRescan}
          disabled={scanning}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--mn-accent)" }}
        >
          {scanning ? "Scanning..." : "Rescan Now"}
        </button>
        {result && !scanning && (
          <span className="text-sm" style={{ color: "var(--mn-muted)" }}>
            {result}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Delete Account Section ---

function DeleteAccountSection({ username }: { username: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/user/delete-account", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete account");
      signOut({ callbackUrl: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-2">Delete Account</h2>
      <p className="text-sm mb-4" style={{ color: "var(--mn-muted)" }}>
        Permanently delete your account and all associated data. This cannot be undone.
      </p>

      {error && (
        <p className="text-sm text-red-500 mb-3">{error}</p>
      )}

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400"
          style={{ border: "1px solid var(--mn-border)" }}
        >
          Delete My Account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--mn-muted)" }}>
            Type <strong>{username}</strong> to confirm:
          </p>
          <input
            type="text"
            value={confirmUsername}
            onChange={(e) => setConfirmUsername(e.target.value)}
            placeholder={username}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: "var(--mn-bg)",
              border: "1px solid var(--mn-border)",
              color: "var(--mn-fg)",
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={confirmUsername !== username || deleting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 disabled:opacity-40"
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setConfirmUsername("");
                setError(null);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: "var(--mn-muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Interface Customizations Section ---

function InterfaceCustomizationsSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <h2 className="text-lg font-bold">Interface Customizations</h2>
        <span
          className="text-sm transition-transform duration-200"
          style={{ color: "var(--mn-muted)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          &#9660;
        </span>
      </button>
      {expanded && (
        <div className="space-y-6 mt-6">
          <ThemeSection />
          <div style={{ borderTop: "1px solid var(--mn-border)" }} />
          <AccentSection />
          <div style={{ borderTop: "1px solid var(--mn-border)" }} />
          <TagBarSection />
          <div style={{ borderTop: "1px solid var(--mn-border)" }} />
          <SourceBarSection />
        </div>
      )}
    </div>
  );
}

// --- Admin Settings (collapsible) ---

function AdminSettingsGroup() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <h2 className="text-lg font-bold">Admin Settings</h2>
        <span
          className="text-sm transition-transform duration-200"
          style={{ color: "var(--mn-muted)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          &#9660;
        </span>
      </button>
      {expanded && (
        <div className="admin-settings-inner space-y-6 mt-6">
          <DefaultSourcesSection />
          <div style={{ borderTop: "1px solid var(--mn-border)" }} />
          <AiSettingsSection />
          <div style={{ borderTop: "1px solid var(--mn-border)" }} />
          <CustomTagsSection />
          <div style={{ borderTop: "1px solid var(--mn-border)" }} />
          <RescanSection />
          <div style={{ borderTop: "1px solid var(--mn-border)" }} />
          <CacheSection />
          <div style={{ borderTop: "1px solid var(--mn-border)" }} />
          <SystemStatusSection />
          <div style={{ borderTop: "1px solid var(--mn-border)" }} />
          <LogViewerSection />
          <div style={{ borderTop: "1px solid var(--mn-border)" }} />
          <AdminUsersSection />
        </div>
      )}
    </div>
  );
}

// --- Settings Page ---

export default function SettingsPage() {
  const { resetToDefaults } = useConfig();
  const { data: session } = useSession();
  const isAdminUser = session?.user?.role === "admin";
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = () => {
    resetToDefaults();
    setShowConfirm(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="text-sm font-medium mb-1 inline-block"
            style={{ color: "var(--mn-accent)" }}
          >
            &larr; Back to news
          </Link>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
      </div>

      <InterfaceCustomizationsSection />
      <SourcesSection />
      {isAdminUser && <AdminSettingsGroup />}

      {/* Reset to Defaults */}
      <div
        className="rounded-2xl p-4 sm:p-6"
        style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
      >
        <h2 className="text-lg font-bold mb-2">Reset</h2>
        <p className="text-sm mb-4" style={{ color: "var(--mn-muted)" }}>
          Restore all sources to their original defaults. This cannot be undone.
        </p>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400"
            style={{ border: "1px solid var(--mn-border)" }}
          >
            Reset to Defaults
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500"
            >
              Confirm Reset
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: "var(--mn-muted)" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {session?.user?.username && (
        <DeleteAccountSection username={session.user.username} />
      )}
    </div>
  );
}
