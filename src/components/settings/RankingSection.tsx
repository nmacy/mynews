"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { RankingConfig } from "@/types";

const LAYER_DESCRIPTIONS: Record<string, string> = {
  layerAiScore: "AI assigns a 1-10 relevance score to each article based on importance and impact.",
  layerSourcePriority: "Higher-priority sources get a score boost (high=1.5x, medium=1.2x, default=1x).",
  layerTagInterest: "Articles matching your featured tags get a 1.3x boost.",
  layerTimeDecay: "Older articles gradually decay in score, but high-relevance articles can still surface.",
  layerDedup: "Groups similar articles by title overlap and keeps the highest-scored representative.",
};

const LAYER_LABELS: Record<string, string> = {
  layerAiScore: "AI Relevance Score",
  layerSourcePriority: "Source Priority",
  layerTagInterest: "Tag Interest Boost",
  layerTimeDecay: "Time Decay",
  layerDedup: "Deduplication",
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ backgroundColor: checked ? "var(--mn-accent)" : "var(--mn-border)" }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 rounded-full shadow transform ring-0 transition duration-200 ease-in-out"
        style={{
          backgroundColor: "white",
          transform: checked ? "translateX(20px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

export function RankingSection() {
  const [config, setConfig] = useState<RankingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const gravityTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (gravityTimerRef.current) clearTimeout(gravityTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetch("/api/admin/server-config")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load config");
        return res.json();
      })
      .then((data) => {
        if (data.ranking) {
          setConfig(data.ranking);
        } else {
          setConfig({
            enabled: false,
            layerAiScore: true,
            layerSourcePriority: true,
            layerTagInterest: true,
            layerTimeDecay: true,
            layerDedup: true,
            timeDecayGravity: 1.2,
            debugScores: false,
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async (updated: RankingConfig) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/admin/server-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ranking: {
            rankingEnabled: updated.enabled,
            rankLayerAiScore: updated.layerAiScore,
            rankLayerSourcePriority: updated.layerSourcePriority,
            rankLayerTagInterest: updated.layerTagInterest,
            rankLayerTimeDecay: updated.layerTimeDecay,
            rankLayerDedup: updated.layerDedup,
            rankTimeDecayGravity: updated.timeDecayGravity,
            rankDebugScores: updated.debugScores,
          },
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof RankingConfig, value: boolean) => {
    if (!config) return;
    const updated = { ...config, [key]: value };
    setConfig(updated);
    save(updated);
  };

  const saveRef = useRef(save);
  saveRef.current = save;

  const handleGravity = useCallback((value: number) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, timeDecayGravity: value };
      // Debounce save — only fire after user stops dragging
      if (gravityTimerRef.current) clearTimeout(gravityTimerRef.current);
      gravityTimerRef.current = setTimeout(() => saveRef.current(updated), 300);
      return updated;
    });
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl p-4 sm:p-6"
        style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
      >
        <p className="text-sm" style={{ color: "var(--mn-muted2)" }}>Loading ranking config...</p>
      </div>
    );
  }

  if (!config) return null;

  const layerKeys = Object.keys(LAYER_LABELS) as (keyof RankingConfig)[];

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-1">Article Ranking</h2>
      <p className="text-xs mb-4" style={{ color: "var(--mn-muted)" }}>
        When enabled, articles are sorted by a computed relevance score instead of chronological order.
      </p>

      {error && (
        <p className="text-sm mb-3 text-red-500">{error}</p>
      )}

      {/* Master toggle */}
      <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: "1px solid var(--mn-border)" }}>
        <div>
          <p className="text-sm font-medium">Enable Ranking</p>
          <p className="text-xs" style={{ color: "var(--mn-muted)" }}>
            Master toggle — when off, articles use chronological sort
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs" style={{ color: "var(--mn-muted)" }}>Saving...</span>}
          {saved && <span className="text-xs text-green-600">Saved</span>}
          <Toggle checked={config.enabled} onChange={(v) => handleToggle("enabled", v)} />
        </div>
      </div>

      {/* Layer toggles */}
      <div className={`space-y-3 ${config.enabled ? "" : "opacity-50 pointer-events-none"}`}>
        {layerKeys.map((key) => (
          <div
            key={key}
            className="flex items-start justify-between gap-4 px-3 py-2 rounded-lg"
            style={{ backgroundColor: "var(--mn-bg)" }}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{LAYER_LABELS[key]}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--mn-muted)" }}>
                {LAYER_DESCRIPTIONS[key]}
              </p>
            </div>
            <Toggle
              checked={config[key] as boolean}
              onChange={(v) => handleToggle(key, v)}
              disabled={!config.enabled}
            />
          </div>
        ))}

        {/* Gravity slider */}
        {config.layerTimeDecay && (
          <div
            className="px-3 py-2 rounded-lg"
            style={{ backgroundColor: "var(--mn-bg)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium">Time Decay Gravity</p>
              <span className="text-sm font-mono" style={{ color: "var(--mn-muted)" }}>
                {config.timeDecayGravity.toFixed(1)}
              </span>
            </div>
            <p className="text-xs mb-2" style={{ color: "var(--mn-muted)" }}>
              Higher values make articles decay faster. Lower values keep old articles visible longer.
            </p>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={config.timeDecayGravity}
              onChange={(e) => handleGravity(parseFloat(e.target.value))}
              disabled={!config.enabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs" style={{ color: "var(--mn-muted)" }}>
              <span>0.5 (slow decay)</span>
              <span>2.0 (fast decay)</span>
            </div>
          </div>
        )}

        {/* Debug scores toggle */}
        <div
          className="flex items-start justify-between gap-4 px-3 py-2 rounded-lg"
          style={{ backgroundColor: "var(--mn-bg)" }}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">Show Debug Scores</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--mn-muted)" }}>
              Display the computed relevance score on each article card for debugging.
            </p>
          </div>
          <Toggle
            checked={config.debugScores}
            onChange={(v) => handleToggle("debugScores", v)}
            disabled={!config.enabled}
          />
        </div>
      </div>
    </div>
  );
}
