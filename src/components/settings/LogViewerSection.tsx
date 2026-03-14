"use client";

import { useState, useEffect } from "react";

interface LogFile {
  date: string;
  sizeKb: number;
}

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  error: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  warn: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  info: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
};

export function LogViewerSection() {
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/logs")
      .then((r) => r.json())
      .then((data) => {
        setFiles(data.files || []);
        if (data.files?.length > 0) {
          setSelectedDate(data.files[0].date);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadEntries = (date: string, level: string) => {
    setLoadingEntries(true);
    const params = new URLSearchParams({ date });
    if (level !== "all") params.set("level", level);
    fetch(`/api/admin/logs?${params}`)
      .then((r) => r.json())
      .then((data) => setEntries(data.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoadingEntries(false));
  };

  useEffect(() => {
    if (!selectedDate) return;
    loadEntries(selectedDate, levelFilter);
  }, [selectedDate, levelFilter]);

  const filteredEntries = searchQuery
    ? entries.filter((e) => e.message.toLowerCase().includes(searchQuery.toLowerCase()))
    : entries;

  const handleDownload = (date: string) => {
    window.open(`/api/admin/logs?download=${date}`, "_blank");
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString();
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-1">Server Logs</h2>
      <p className="text-xs mb-4" style={{ color: "var(--mn-muted)" }}>
        View server logs. Files rotate daily, keeping the last 7 days.
      </p>

      {loading && (
        <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted)" }}>
          Loading log files...
        </p>
      )}

      {!loading && files.length === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted)" }}>
          No log files found. Logs will appear after the server generates warnings or errors.
        </p>
      )}

      {!loading && files.length > 0 && (
        <div className="space-y-3">
          {/* Date selector and download */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedDate || ""}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                border: "1px solid var(--mn-border)",
                color: "var(--mn-fg)",
              }}
            >
              {files.map((f) => (
                <option key={f.date} value={f.date}>
                  {f.date} ({f.sizeKb} KB)
                </option>
              ))}
            </select>

            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                border: "1px solid var(--mn-border)",
                color: "var(--mn-fg)",
              }}
            >
              <option value="all">All levels</option>
              <option value="error">Errors only</option>
              <option value="warn">Warnings only</option>
              <option value="info">Info only</option>
            </select>

            {selectedDate && (
              <button
                onClick={() => handleDownload(selectedDate)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{
                  border: "1px solid var(--mn-border)",
                  color: "var(--mn-accent)",
                }}
              >
                Download
              </button>
            )}
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: "var(--mn-bg)",
              border: "1px solid var(--mn-border)",
              color: "var(--mn-fg)",
            }}
          />

          {/* Log entries */}
          <div
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: "var(--mn-bg)",
              border: "1px solid var(--mn-border)",
              maxHeight: "400px",
              overflowY: "auto",
            }}
          >
            {loadingEntries && (
              <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted)" }}>
                Loading entries...
              </p>
            )}

            {!loadingEntries && filteredEntries.length === 0 && (
              <p className="text-sm py-4 text-center" style={{ color: "var(--mn-muted)" }}>
                {searchQuery ? "No matching entries" : "No log entries for this date"}
              </p>
            )}

            {!loadingEntries &&
              filteredEntries.map((entry, i) => {
                const colors = LEVEL_COLORS[entry.level] || LEVEL_COLORS.info;
                return (
                  <div
                    key={i}
                    className="px-3 py-1.5 text-xs font-mono border-b last:border-b-0"
                    style={{ borderColor: "var(--mn-border)" }}
                  >
                    <div className="flex items-start gap-2">
                      <span style={{ color: "var(--mn-muted)", flexShrink: 0 }}>
                        {formatTime(entry.timestamp)}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                          flexShrink: 0,
                        }}
                      >
                        {entry.level}
                      </span>
                      <span
                        className="break-all whitespace-pre-wrap"
                        style={{ color: "var(--mn-fg)" }}
                      >
                        {entry.message}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          <p className="text-xs" style={{ color: "var(--mn-muted)" }}>
            Showing {filteredEntries.length} entries (newest first)
          </p>
        </div>
      )}
    </div>
  );
}
