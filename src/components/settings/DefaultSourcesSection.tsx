"use client";

import { useEffect, useMemo, useState } from "react";
import { SOURCE_LIBRARY, SOURCE_CATEGORIES } from "@/config/source-library";

export function DefaultSourcesSection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/default-sources")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const ids = new Set<string>(data.sourceIds ?? []);
        setSelected(ids);
        setInitial(ids);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const dirty = useMemo(() => {
    if (selected.size !== initial.size) return true;
    for (const id of selected) if (!initial.has(id)) return true;
    return false;
  }, [selected, initial]);

  const filtered = useMemo(() => {
    if (!filter) return SOURCE_LIBRARY;
    const q = filter.toLowerCase();
    return SOURCE_LIBRARY.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [filter]);

  const handleToggle = (id: string) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/default-sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIds: [...selected] }),
      });
      if (res.ok) {
        setInitial(new Set(selected));
        setSaved(true);
      }
    } catch {
      // silent
    }
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{
        backgroundColor: "var(--mn-card)",
        border: "1px solid var(--mn-border)",
      }}
    >
      <h2 className="text-lg font-bold mb-1">Default Sources</h2>
      <p className="text-xs mb-4" style={{ color: "var(--mn-muted)" }}>
        Choose which sources appear for new users and guests. If none are selected, the built-in
        defaults from sources.json will be used.
      </p>

      {/* Filter + count */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter sources..."
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: "var(--mn-bg)",
            border: "1px solid var(--mn-border)",
            color: "var(--mn-fg)",
          }}
        />
        <span className="text-xs whitespace-nowrap" style={{ color: "var(--mn-muted)" }}>
          {selected.size} selected
        </span>
      </div>

      {/* Grouped checkboxes */}
      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {SOURCE_CATEGORIES.map((cat) => {
          const sources = filtered.filter((s) => s.category === cat);
          if (sources.length === 0) return null;

          return (
            <div key={cat}>
              <h3
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: "var(--mn-muted)" }}
              >
                {cat}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {sources.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:opacity-80 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => handleToggle(s.id)}
                      className="accent-[var(--mn-accent)]"
                    />
                    <span>{s.name}</span>
                    {s.paywalled && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: "var(--mn-border)",
                          color: "var(--mn-muted)",
                        }}
                      >
                        Paywall
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {/* "Other" category for sources not in SOURCE_CATEGORIES */}
        {(() => {
          const catSet = new Set(SOURCE_CATEGORIES as readonly string[]);
          const other = filtered.filter((s) => !catSet.has(s.category));
          if (other.length === 0) return null;
          return (
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: "var(--mn-muted)" }}
              >
                Other
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {other.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:opacity-80 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => handleToggle(s.id)}
                      className="accent-[var(--mn-accent)]"
                    />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: "#34C759" }}
        >
          {saving ? "Saving..." : "Save Defaults"}
        </button>
        {saved && (
          <span className="text-xs font-medium" style={{ color: "#34C759" }}>
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
