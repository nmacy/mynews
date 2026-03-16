"use client";

import { useTheme, type AccentId } from "@/components/ThemeProvider";
import { useConfig } from "@/components/ConfigProvider";
import { ACCENT_PALETTES } from "@/config/accents";

export function AccentSection() {
  const { accent, setAccent, theme } = useTheme();
  const { saveAccent } = useConfig();

  const handleSelect = (id: AccentId) => {
    setAccent(id);
    saveAccent(id);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">Accent Color</h3>
      <div className="flex flex-wrap gap-3">
        {ACCENT_PALETTES.map((palette) => {
          const color = theme === "dark" ? palette.dark.accent : palette.light.accent;
          const isSelected = accent === palette.id;
          return (
            <button
              key={palette.id}
              onClick={() => handleSelect(palette.id)}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className="w-9 h-9 rounded-full transition-shadow"
                style={{
                  backgroundColor: color,
                  boxShadow: isSelected
                    ? `0 0 0 2px var(--mn-card), 0 0 0 4px ${color}`
                    : "none",
                }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: isSelected ? color : "var(--mn-muted)" }}
              >
                {palette.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
