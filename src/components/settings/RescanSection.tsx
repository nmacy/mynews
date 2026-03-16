"use client";

import { useState } from "react";

export function RescanSection() {
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
