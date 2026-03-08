"use client";

import { useState, useEffect } from "react";

interface ServerConfig {
  refreshIntervalMinutes: number;
  retentionDays: number;
}

interface SystemStatus {
  lastRefreshAt: string | null;
  articleCount: number;
  storageSizeKb: number;
  oldestArticle: string | null;
  newestArticle: string | null;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString();
}

export function SystemStatusSection() {
  const [config, setConfig] = useState<ServerConfig>({ refreshIntervalMinutes: 5, retentionDays: 14 });
  const [draft, setDraft] = useState<ServerConfig>({ refreshIntervalMinutes: 5, retentionDays: 14 });
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [cfgRes, stsRes] = await Promise.all([
          fetch("/api/admin/server-config"),
          fetch("/api/admin/system-status"),
        ]);
        if (!cfgRes.ok || !stsRes.ok) {
          const errData = await (cfgRes.ok ? stsRes : cfgRes).json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${cfgRes.ok ? stsRes.status : cfgRes.status}`);
        }
        const [cfg, sts] = await Promise.all([cfgRes.json(), stsRes.json()]);
        setConfig(cfg);
        setDraft(cfg);
        setStatus(sts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const isDirty =
    draft.refreshIntervalMinutes !== config.refreshIntervalMinutes ||
    draft.retentionDays !== config.retentionDays;

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/admin/server-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setConfig({ ...draft });
      setSaveMsg("Saved");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-1">System Status</h2>
      <p className="text-xs mb-4" style={{ color: "var(--mn-muted)" }}>
        Configure background refresh interval and article retention, and view system stats.
      </p>

      {loading && (
        <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted2)" }}>
          Loading...
        </p>
      )}

      {error && <p className="text-sm py-4 text-center text-red-500">{error}</p>}

      {!loading && !error && (
        <div className="space-y-4">
          {/* Configuration */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--mn-muted)" }}>
              Configuration
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--mn-muted)" }}>
                  Refresh Interval (minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={draft.refreshIntervalMinutes}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, refreshIntervalMinutes: parseInt(e.target.value) || 1 }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: "var(--mn-bg)",
                    border: "1px solid var(--mn-border)",
                    color: "var(--mn-fg)",
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--mn-muted)" }}>
                  Article Retention (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={draft.retentionDays}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, retentionDays: parseInt(e.target.value) || 1 }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: "var(--mn-bg)",
                    border: "1px solid var(--mn-border)",
                    color: "var(--mn-fg)",
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: "var(--mn-accent)" }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {saveMsg && !saving && (
                <span className="text-sm" style={{ color: "var(--mn-muted)" }}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--mn-border)" }} />

          {/* Status */}
          {status && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--mn-muted)" }}>
                Status
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--mn-bg)" }}>
                  <p className="text-xs font-medium" style={{ color: "var(--mn-muted)" }}>
                    Last Refresh
                  </p>
                  <p
                    className="text-sm font-bold"
                    title={status.lastRefreshAt ? new Date(status.lastRefreshAt).toLocaleString() : ""}
                  >
                    {status.lastRefreshAt ? formatRelativeTime(status.lastRefreshAt) : "Never"}
                  </p>
                </div>
                <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--mn-bg)" }}>
                  <p className="text-xs font-medium" style={{ color: "var(--mn-muted)" }}>
                    Stored Articles
                  </p>
                  <p className="text-lg font-bold">{status.articleCount}</p>
                </div>
                <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--mn-bg)" }}>
                  <p className="text-xs font-medium" style={{ color: "var(--mn-muted)" }}>
                    Storage Used
                  </p>
                  <p className="text-lg font-bold">{formatSize(status.storageSizeKb)}</p>
                </div>
                <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--mn-bg)" }}>
                  <p className="text-xs font-medium" style={{ color: "var(--mn-muted)" }}>
                    Date Range
                  </p>
                  <p className="text-xs font-medium mt-1">
                    {formatDate(status.oldestArticle)}
                    {status.oldestArticle && status.newestArticle ? " → " : ""}
                    {status.oldestArticle ? formatDate(status.newestArticle) : "--"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
