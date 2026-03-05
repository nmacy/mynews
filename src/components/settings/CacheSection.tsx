"use client";

import { useState, useEffect } from "react";

interface CacheStats {
  count: number;
  totalSizeKb: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}

export function CacheSection() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flushing, setFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState<string | null>(null);

  const loadStats = () => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/cache")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load cache stats");
        return res.json();
      })
      .then((data) => setStats(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleFlush = async () => {
    setFlushing(true);
    setFlushResult(null);
    try {
      const res = await fetch("/api/admin/cache", { method: "DELETE" });
      if (!res.ok) throw new Error("Flush failed");
      const data = await res.json();
      setFlushResult(`Cleared ${data.deleted} cached articles`);
      loadStats();
    } catch (err) {
      setFlushResult(err instanceof Error ? err.message : "Flush failed");
    } finally {
      setFlushing(false);
    }
  };

  const formatSize = (kb: number) => {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "--";
    return new Date(iso).toLocaleString();
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-1">Article Cache</h2>
      <p className="text-xs mb-4" style={{ color: "var(--mn-muted)" }}>
        Extracted article content is cached for 24 hours to speed up revisits.
      </p>

      {loading && (
        <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted2)" }}>
          Loading cache stats...
        </p>
      )}

      {error && (
        <p className="text-sm py-4 text-center text-red-500">{error}</p>
      )}

      {!loading && !error && stats && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--mn-bg)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--mn-muted)" }}>
                Cached Articles
              </p>
              <p className="text-lg font-bold">{stats.count}</p>
            </div>
            <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--mn-bg)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--mn-muted)" }}>
                Total Size
              </p>
              <p className="text-lg font-bold">{formatSize(stats.totalSizeKb)}</p>
            </div>
          </div>

          {stats.count > 0 && (
            <div
              className="text-xs px-3 py-2 rounded-lg"
              style={{ backgroundColor: "var(--mn-bg)", color: "var(--mn-muted)" }}
            >
              <p>Oldest: {formatDate(stats.oldestEntry)}</p>
              <p>Newest: {formatDate(stats.newestEntry)}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleFlush}
              disabled={flushing || stats.count === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 disabled:opacity-40"
              style={{ border: "1px solid var(--mn-border)" }}
            >
              {flushing ? "Clearing..." : "Clear Cache"}
            </button>
            {flushResult && !flushing && (
              <span className="text-sm" style={{ color: "var(--mn-muted)" }}>
                {flushResult}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
