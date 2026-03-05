"use client";

import { useEffect, useState } from "react";
import { AI_PROVIDERS, AI_PROVIDER_MAP } from "@/config/ai-providers";
import type { AiProvider } from "@/types";

interface ServerKeyInfo {
  provider: string;
  model: string;
  enabled: boolean;
  maskedKey: string;
}

interface FormState {
  provider: AiProvider;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export function AiTaggerSection() {
  const [keys, setKeys] = useState<ServerKeyInfo[]>([]);
  const [form, setForm] = useState<FormState>({
    provider: "anthropic",
    apiKey: "",
    model: "claude-haiku-4-5-20251001",
    enabled: true,
  });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load server keys
  useEffect(() => {
    fetch("/api/admin/api-keys")
      .then((r) => r.json())
      .then((data: ServerKeyInfo[]) => {
        setKeys(data);
        const active = data.find((k) => k.enabled);
        if (active) {
          setForm({
            provider: active.provider as AiProvider,
            apiKey: "",
            model: active.model,
            enabled: true,
          });
        }
      })
      .catch(() => {});
  }, []);

  const update = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setSaved(false);
  };

  const handleProviderChange = (provider: AiProvider) => {
    const def = AI_PROVIDER_MAP.get(provider);
    const existing = keys.find((k) => k.provider === provider);
    update({
      provider,
      model: existing?.model || def?.defaultModel || "",
      apiKey: "",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saveRes = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form.provider,
          apiKey: form.apiKey,
          model: form.model,
          enabled: form.enabled,
        }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error(err.error || `Save failed (${saveRes.status})`);
      }
      // Refresh keys
      const res = await fetch("/api/admin/api-keys");
      setKeys(await res.json());
      setForm((prev) => ({ ...prev, apiKey: "" }));
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    }
    setSaving(false);
  };

  const handleDelete = async (provider: string) => {
    await fetch(`/api/admin/api-keys?provider=${encodeURIComponent(provider)}`, {
      method: "DELETE",
    });
    const res = await fetch("/api/admin/api-keys");
    setKeys(await res.json());
  };

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
          provider: form.provider,
          model: form.model,
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

  const activeKey = keys.find((k) => k.provider === form.provider);
  const selectedProvider = AI_PROVIDER_MAP.get(form.provider);
  const hasKey = !!activeKey || !!form.apiKey;

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{
        backgroundColor: "var(--mn-card)",
        border: "1px solid var(--mn-border)",
      }}
    >
      <h2 className="text-lg font-bold mb-1">AI Tagging</h2>
      <p className="text-xs mb-4" style={{ color: "var(--mn-muted)" }}>
        Configure the server-wide AI API key used for article tagging. All users
        benefit from this configuration.
      </p>

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
            value={form.provider}
            onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
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
          {activeKey && !form.apiKey ? (
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-mono px-3 py-2 rounded-lg flex-1"
                style={{
                  backgroundColor: "var(--mn-bg)",
                  border: "1px solid var(--mn-border)",
                  color: "var(--mn-muted)",
                }}
              >
                {activeKey.maskedKey}
              </span>
              <button
                type="button"
                onClick={() => update({ apiKey: "" })}
                className="text-xs px-3 py-2 rounded-lg"
                style={{ color: "var(--mn-accent)" }}
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => handleDelete(activeKey.provider)}
                className="text-xs px-3 py-2 rounded-lg"
                style={{ color: "#EF4444" }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                placeholder={activeKey ? "Enter new key to replace" : "Enter your API key"}
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
          )}
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
            value={form.model}
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
            disabled={!dirty || !form.apiKey || saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: "#34C759" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={handleTest}
            disabled={!hasKey || testStatus === "loading"}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: "var(--mn-accent)" }}
          >
            {testStatus === "loading" ? "Testing..." : "Test Connection"}
          </button>
          {saved && (
            <span className="text-xs font-medium" style={{ color: "#34C759" }}>
              Saved
            </span>
          )}
          {saveError && (
            <span className="text-xs font-medium" style={{ color: "#EF4444" }}>
              {saveError}
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
    </div>
  );
}
