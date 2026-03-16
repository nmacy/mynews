"use client";

import { useState } from "react";
import { useConfig } from "@/components/ConfigProvider";

export function ResetSection() {
  const { resetToDefaults } = useConfig();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = () => {
    resetToDefaults();
    setShowConfirm(false);
  };

  return (
    <div
      className="rounded-2xl p-4 sm:p-6"
      style={{ backgroundColor: "var(--mn-card)", border: "1px solid var(--mn-border)" }}
    >
      <h2 className="text-lg font-bold mb-2">Reset</h2>
      <p className="text-sm mb-4" style={{ color: "var(--mn-muted)" }}>
        Restore all sources to their original defaults. This cannot be undone.
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
  );
}
