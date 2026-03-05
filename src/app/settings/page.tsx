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
import { AiTaggerSection } from "@/components/settings/AiTaggerSection";
import { AdminUsersSection } from "@/components/settings/AdminUsersSection";
import { CacheSection } from "@/components/settings/CacheSection";
import { DEFAULT_FEATURED_TAGS } from "@/components/layout/TagTabs";
import { TAG_DEFINITIONS, TAG_MAP } from "@/config/tags";
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
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Tag Bar</h2>
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
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--mn-muted)" }}>
            Available
          </p>
          <div className="flex flex-wrap gap-2">
            {unselectedTags.map((tag) => (
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
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-4">Theme</h2>
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
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-4">Accent Color</h2>
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
}: {
  sources: LibrarySource[];
  activeSourceIds: Set<string>;
  activeSourceUrls: Set<string>;
  onAdd: (source: LibrarySource) => void;
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
      {categories.map((category) => (
        <div key={category}>
          <h4
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--mn-muted)" }}
          >
            {category}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {grouped.get(category)!.map((source) => (
              <SourceLibraryCard
                key={source.id}
                source={source}
                added={isAdded(source)}
                onAdd={onAdd}
              />
            ))}
          </div>
        </div>
      ))}
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

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;

    const id = slugify(trimmedName) || generateSourceId(trimmedName);
    const source: Source = {
      id,
      name: trimmedName,
      url: trimmedUrl,
      priority: 2,
      paywalled,
    };
    const libSource: LibrarySource = { ...source, category: "Custom" };

    onAdd(source, libSource);
    setName("");
    setUrl("");
    setPaywalled(false);
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
        onChange={(e) => setUrl(e.target.value)}
        placeholder="RSS feed URL"
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
      <button
        onClick={handleSubmit}
        disabled={!name.trim() || !url.trim()}
        className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
        style={{ backgroundColor: "var(--mn-accent)" }}
      >
        Add Source
      </button>
    </div>
  );
}

function AddSourcePanel({
  activeSourceIds,
  activeSourceUrls,
  onAddLibrary,
  onAddManual,
}: {
  activeSourceIds: Set<string>;
  activeSourceUrls: Set<string>;
  onAddLibrary: (source: LibrarySource) => void;
  onAddManual: (source: Source, libSource: LibrarySource) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customSources, setCustomSources] = useState<LibrarySource[]>([]);

  useEffect(() => {
    setCustomSources(loadCustomLibrarySources());
  }, []);

  const allLibrary = useMemo(
    () => [...SOURCE_LIBRARY, ...customSources],
    [customSources]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return allLibrary;
    const q = search.toLowerCase();
    return allLibrary.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [allLibrary, search]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium mt-3"
        style={{ color: "var(--mn-accent)" }}
      >
        + Add Source
      </button>
    );
  }

  const handleAddManual = (source: Source, libSource: LibrarySource) => {
    onAddManual(source, libSource);
    saveCustomLibrarySource(libSource);
    setCustomSources(loadCustomLibrarySources());
  };

  return (
    <div
      className="mt-3 space-y-4 p-3 rounded-xl"
      style={{ backgroundColor: "var(--mn-bg)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Source Library</h3>
        <button
          onClick={() => {
            setOpen(false);
            setSearch("");
          }}
          className="text-sm font-medium"
          style={{ color: "var(--mn-muted)" }}
        >
          Close
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search sources..."
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{
          backgroundColor: "var(--mn-card)",
          border: "1px solid var(--mn-border)",
          color: "var(--mn-fg)",
        }}
      />

      <div className="max-h-80 overflow-y-auto">
        <SourceLibraryGrid
          sources={filtered}
          activeSourceIds={activeSourceIds}
          activeSourceUrls={activeSourceUrls}
          onAdd={onAddLibrary}
        />
      </div>

      <div
        className="border-t pt-4"
        style={{ borderColor: "var(--mn-border)" }}
      >
        <ManualSourceForm onAdd={handleAddManual} />
      </div>
    </div>
  );
}

function SourcesSection() {
  const {
    allSources,
    disabledSourceIds,
    addSource,
    removeSource,
    toggleSource,
    togglePaywall,
  } = useConfig();

  const activeSourceIds = useMemo(
    () => new Set(allSources.map((s) => s.id)),
    [allSources]
  );
  const activeSourceUrls = useMemo(
    () => new Set(allSources.map((s) => s.url)),
    [allSources]
  );

  const handleAddLibrary = (source: LibrarySource) => {
    addSource({
      id: source.id,
      name: source.name,
      url: source.url,
      priority: source.priority,
      paywalled: source.paywalled,
    });
  };

  const handleAddManual = (source: Source, libSource: LibrarySource) => {
    void libSource; // saved to custom library by AddSourcePanel
    addSource(source);
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-4">Sources</h2>

      <div className="space-y-2">
        {allSources.map((source) => (
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

      {allSources.length === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted2)" }}>
          No sources configured
        </p>
      )}

      <AddSourcePanel
        activeSourceIds={activeSourceIds}
        activeSourceUrls={activeSourceUrls}
        onAddLibrary={handleAddLibrary}
        onAddManual={handleAddManual}
      />
    </div>
  );
}

// --- Rescan Section ---

function RescanSection() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number; source: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleRescan = async () => {
    setScanning(true);
    setResult(null);
    setProgress(null);
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
          } else if (event.type === "done") {
            setProgress({ completed: event.total, total: event.total, source: "" });
            setResult(`Rescanned ${event.count} articles`);
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

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-2">Rescan Articles</h2>
      <p className="text-sm mb-4" style={{ color: "var(--mn-muted)" }}>
        Clear the article cache and re-fetch all feeds with fresh keyword tags.
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

function DeleteAccountSection({ userEmail }: { userEmail: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
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
            Type <strong>{userEmail}</strong> to confirm:
          </p>
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={userEmail}
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
              disabled={confirmEmail !== userEmail || deleting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 disabled:opacity-40"
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setConfirmEmail("");
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

      <ThemeSection />
      <AccentSection />
      <SourcesSection />
      <TagBarSection />
      {isAdminUser && <AiTaggerSection />}
      {isAdminUser && <RescanSection />}
      {isAdminUser && <CacheSection />}
      {isAdminUser && <AdminUsersSection />}

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

      {session?.user?.email && (
        <DeleteAccountSection userEmail={session.user.email} />
      )}
    </div>
  );
}
