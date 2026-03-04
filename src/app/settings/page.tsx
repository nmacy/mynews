"use client";

import { useState } from "react";
import Link from "next/link";
import { useConfig } from "@/components/ConfigProvider";
import type { Source } from "@/types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateSourceId(name: string): string {
  return slugify(name) + "-" + Math.random().toString(36).slice(2, 7);
}

// --- Category Section ---

function CategorySection() {
  const { config, addCategory, removeCategory } = useConfig();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#007AFF");

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const slug = slugify(trimmed);
    if (config.categories.find((c) => c.slug === slug)) return;
    addCategory({ slug, name: trimmed, color });
    setName("");
    setColor("#007AFF");
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-4">Categories</h2>

      <div className="space-y-2 mb-6">
        {config.categories.map((cat) => (
          <div
            key={cat.slug}
            className="flex items-center justify-between py-2 px-3 rounded-xl"
            style={{ backgroundColor: "var(--mn-bg)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="font-medium text-sm">{cat.name}</span>
              <span className="text-xs" style={{ color: "var(--mn-muted2)" }}>
                {cat.slug}
              </span>
            </div>
            {cat.slug !== "top-stories" ? (
              <button
                onClick={() => removeCategory(cat.slug)}
                className="text-red-500 hover:text-red-600 text-sm font-medium px-2 py-1"
                aria-label={`Delete ${cat.name}`}
              >
                Delete
              </button>
            ) : (
              <span
                className="text-xs px-2 py-1"
                style={{ color: "var(--mn-muted2)" }}
              >
                Required
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--mn-muted)" }}>
          Add Category
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: "var(--mn-bg)",
              border: "1px solid var(--mn-border)",
              color: "var(--mn-fg)",
            }}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <div className="flex gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0.5"
              style={{ backgroundColor: "var(--mn-bg)" }}
            />
            <button
              onClick={handleAdd}
              disabled={!name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: "#007AFF" }}
            >
              Add
            </button>
          </div>
        </div>
        {name.trim() && (
          <p className="text-xs" style={{ color: "var(--mn-muted2)" }}>
            Slug: {slugify(name.trim())}
          </p>
        )}
      </div>
    </div>
  );
}

// --- Sources Section ---

import type { Category } from "@/types";

function SourceRow({
  source,
  disabled,
  categories,
  onToggle,
  onRemove,
  onTogglePaywall,
  onToggleCategory,
}: {
  source: Source;
  disabled: boolean;
  categories: Category[];
  onToggle: () => void;
  onRemove: () => void;
  onTogglePaywall: () => void;
  onToggleCategory: (slug: string) => void;
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
      <p className="text-xs truncate mb-2" style={{ color: "var(--mn-muted2)" }}>
        {source.url}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const active = source.categories.includes(cat.slug);
          return (
            <button
              key={cat.slug}
              onClick={() => onToggleCategory(cat.slug)}
              className="text-xs px-2 py-0.5 rounded-full transition-colors cursor-pointer"
              style={
                active
                  ? { backgroundColor: cat.color, color: "white" }
                  : {
                      backgroundColor: "transparent",
                      border: "1px solid var(--mn-border)",
                      color: "var(--mn-muted2)",
                    }
              }
              title={active ? `Remove from ${cat.name}` : `Add to ${cat.name}`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddSourceForm({
  categories,
  onAdd,
}: {
  categories: Category[];
  onAdd: (source: Source) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [paywalled, setPaywalled] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  const toggleCat = (slug: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl || selectedCategories.size === 0) return;

    onAdd({
      id: generateSourceId(trimmedName),
      name: trimmedName,
      url: trimmedUrl,
      categories: [...selectedCategories],
      priority: 2,
      paywalled,
    });

    setName("");
    setUrl("");
    setPaywalled(false);
    setSelectedCategories(new Set());
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium mt-3"
        style={{ color: "#007AFF" }}
      >
        + Add Source
      </button>
    );
  }

  return (
    <div
      className="mt-3 space-y-3 p-3 rounded-xl"
      style={{ backgroundColor: "var(--mn-bg)" }}
    >
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
      <div>
        <p className="text-xs font-medium mb-1.5" style={{ color: "var(--mn-muted)" }}>
          Categories
        </p>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const active = selectedCategories.has(cat.slug);
            return (
              <button
                key={cat.slug}
                onClick={() => toggleCat(cat.slug)}
                className="text-xs px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                style={
                  active
                    ? { backgroundColor: cat.color, color: "white" }
                    : {
                        backgroundColor: "transparent",
                        border: "1px solid var(--mn-border)",
                        color: "var(--mn-muted2)",
                      }
                }
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={paywalled}
          onChange={(e) => setPaywalled(e.target.checked)}
          className="rounded"
        />
        Paywalled
      </label>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !url.trim() || selectedCategories.size === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: "#007AFF" }}
        >
          Add Source
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setName("");
            setUrl("");
            setPaywalled(false);
            setSelectedCategories(new Set());
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ color: "var(--mn-muted)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SourcesSection() {
  const {
    config,
    allSources,
    disabledSourceIds,
    addSource,
    removeSource,
    toggleSource,
    togglePaywall,
    toggleSourceCategory,
  } = useConfig();

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-1">Sources</h2>
      <p className="text-xs mb-4" style={{ color: "var(--mn-muted)" }}>
        Tap category tags to add or remove a source from categories.
      </p>

      <div className="space-y-2">
        {allSources.map((source) => (
          <SourceRow
            key={source.id}
            source={source}
            disabled={disabledSourceIds.has(source.id)}
            categories={config.categories}
            onToggle={() => toggleSource(source.id)}
            onRemove={() => removeSource(source.id)}
            onTogglePaywall={() => togglePaywall(source.id)}
            onToggleCategory={(slug) => toggleSourceCategory(source.id, slug)}
          />
        ))}
      </div>

      {allSources.length === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted2)" }}>
          No sources configured
        </p>
      )}

      <AddSourceForm categories={config.categories} onAdd={addSource} />
    </div>
  );
}

// --- Settings Page ---

export default function SettingsPage() {
  const { resetToDefaults } = useConfig();
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
            style={{ color: "#007AFF" }}
          >
            &larr; Back to news
          </Link>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
      </div>

      <CategorySection />
      <SourcesSection />

      {/* Reset to Defaults */}
      <div
        className="rounded-2xl p-4 sm:p-6"
        style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
      >
        <h2 className="text-lg font-bold mb-2">Reset</h2>
        <p className="text-sm mb-4" style={{ color: "var(--mn-muted)" }}>
          Restore all categories and sources to their original defaults. This cannot be
          undone.
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
    </div>
  );
}
