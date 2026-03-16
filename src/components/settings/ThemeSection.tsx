"use client";

import { useTheme, type ThemePreference } from "@/components/ThemeProvider";
import { useConfig } from "@/components/ConfigProvider";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeSection() {
  const { preference, setTheme } = useTheme();
  const { saveTheme } = useConfig();

  const handleSelect = (pref: ThemePreference) => {
    setTheme(pref);
    saveTheme(pref);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">Theme</h3>
      <div className="flex gap-2">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={
              preference === opt.value
                ? { backgroundColor: "var(--mn-accent)", color: "white" }
                : {
                    backgroundColor: "var(--mn-bg)",
                    color: "var(--mn-fg)",
                    border: "1px solid var(--mn-border)",
                  }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
