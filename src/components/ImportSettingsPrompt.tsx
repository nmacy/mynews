"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const DISMISSED_KEY = "mynews-import-dismissed";
const CONFIG_KEY = "mynews-config";
const DISABLED_KEY = "mynews-disabled-sources";

export function ImportSettingsPrompt() {
  const { status } = useSession();
  const [show, setShow] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    // Already dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Check if there are local settings to import
    const hasConfig = !!localStorage.getItem(CONFIG_KEY);
    const hasDisabled = !!localStorage.getItem(DISABLED_KEY);

    if (!hasConfig && !hasDisabled) return;

    // Check if server settings are empty
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data) => {
        const serverEmpty =
          !data.sources || data.sources.length === 0;
        if (serverEmpty) setShow(true);
      })
      .catch(() => {});
  }, [status]);

  if (!show) return null;

  const handleImport = async () => {
    setImporting(true);

    try {
      // Import sources & settings
      const configRaw = localStorage.getItem(CONFIG_KEY);
      const disabledRaw = localStorage.getItem(DISABLED_KEY);

      if (configRaw) {
        const config = JSON.parse(configRaw);
        const disabled = disabledRaw ? JSON.parse(disabledRaw) : [];

        await fetch("/api/user/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sources: config.sources || [],
            featuredTags: config.featuredTags || [],
            disabledSourceIds: disabled,
          }),
        });
      }

    } catch {
      // silent fail
    }

    localStorage.setItem(DISMISSED_KEY, "1");
    setImporting(false);
    setShow(false);
    // Reload to pick up imported settings
    window.location.reload();
  };

  const handleSkip = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-80 rounded-2xl p-4 shadow-lg"
      style={{
        backgroundColor: "var(--mn-card)",
        border: "1px solid var(--mn-border)",
      }}
    >
      <h3 className="font-bold text-sm mb-1">Import local settings?</h3>
      <p className="text-xs mb-3" style={{ color: "var(--mn-muted)" }}>
        We found settings saved in this browser. Would you like to import your
        sources and tags to your account?
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: "var(--mn-accent)" }}
        >
          {importing ? "Importing..." : "Import"}
        </button>
        <button
          onClick={handleSkip}
          className="flex-1 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: "var(--mn-bg)",
            border: "1px solid var(--mn-border)",
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
