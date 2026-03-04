"use client";

import { useEffect, useState } from "react";
import { AI_PROVIDERS, AI_PROVIDER_MAP } from "@/config/ai-providers";
import { loadTaggerConfig, saveTaggerConfig } from "@/lib/useAiTagger";
import type { AiProvider, AiTaggerConfig } from "@/types";

export function AiTaggerSection() {
  const [config, setConfig] = useState<AiTaggerConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    setConfig(loadTaggerConfig());
  }, []);

  if (!config) return null;

  const update = (patch: Partial<AiTaggerConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setDirty(true);
    setSaved(false);
  };

  const handleSave = () => {
    saveTaggerConfig(config);
    setDirty(false);
    setSaved(true);
  };

  const handleToggleEnabled = () => {
    const next = { ...config, enabled: !config.enabled };
    setConfig(next);
    saveTaggerConfig(next);
    setDirty(false);
    setSaved(false);
  };

  const handleProviderChange = (provider: AiProvider) => {
    const def = AI_PROVIDER_MAP.get(provider);
    update({ provider, model: def?.defaultModel ?? "" });
  };

  const selectedProvider = AI_PROVIDER_MAP.get(config.provider);

  const handleTest = async () => {
    setTestStatus("loading");
    setTestMessage("");

    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articles: [
            {
              id: "test-1",
              title: "NASA launches new Mars rover mission",
              description:
                "NASA successfully launched its latest Mars rover, equipped with AI-powered instruments for studying the planet's surface.",
            },
          ],
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setTestStatus("error");
        setTestMessage(data.error);
      } else {
        const tags = data.tags?.["test-1"];
        setTestStatus("success");
        setTestMessage(
          tags?.length
            ? `Tags returned: ${tags.join(", ")}`
            : "Connected successfully (no tags matched)"
        );
      }
    } catch {
      setTestStatus("error");
      setTestMessage("Network error — could not reach API");
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
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold">AI Tagging</h2>
        <button
          onClick={handleToggleEnabled}
          className="relative w-10 h-6 rounded-full transition-colors"
          style={{
            backgroundColor: config.enabled ? "#34C759" : "var(--mn-border)",
          }}
          aria-label={config.enabled ? "Disable AI tagging" : "Enable AI tagging"}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
            style={{ left: config.enabled ? "18px" : "2px" }}
          />
        </button>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--mn-muted)" }}>
        Use an AI model to generate more accurate article tags. Requires your own API
        key.
      </p>

      {config.enabled && (
        <div className="space-y-4">
          {/* Provider */}
          <div>
            <label
              className="text-sm font-medium block mb-1"
              style={{ color: "var(--mn-muted)" }}
            >
              Provider
            </label>
            <select
              value={config.provider}
              onChange={(e) =>
                handleProviderChange(e.target.value as AiProvider)
              }
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                border: "1px solid var(--mn-border)",
                color: "var(--mn-fg)",
              }}
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div>
            <label
              className="text-sm font-medium block mb-1"
              style={{ color: "var(--mn-muted)" }}
            >
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={config.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                placeholder="Enter your API key"
                className="w-full px-3 py-2 pr-16 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: "var(--mn-bg)",
                  border: "1px solid var(--mn-border)",
                  color: "var(--mn-fg)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded"
                style={{ color: "var(--mn-muted)" }}
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Model */}
          <div>
            <label
              className="text-sm font-medium block mb-1"
              style={{ color: "var(--mn-muted)" }}
            >
              Model
            </label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder={selectedProvider?.defaultModel ?? "Model name"}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                border: "1px solid var(--mn-border)",
                color: "var(--mn-fg)",
              }}
            />
          </div>

          {/* Save + Test */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSave}
              disabled={!dirty}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: "#34C759" }}
            >
              Save
            </button>
            <button
              onClick={handleTest}
              disabled={!config.apiKey || testStatus === "loading"}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: "#007AFF" }}
            >
              {testStatus === "loading" ? "Testing..." : "Test Connection"}
            </button>
            {saved && (
              <span className="text-xs font-medium" style={{ color: "#34C759" }}>
                Saved
              </span>
            )}
          </div>
          {testMessage && (
            <p
              className="text-xs"
              style={{
                color:
                  testStatus === "success"
                    ? "#34C759"
                    : testStatus === "error"
                      ? "#EF4444"
                      : "var(--mn-muted)",
              }}
            >
              {testMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
