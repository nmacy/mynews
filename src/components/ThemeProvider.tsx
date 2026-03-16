"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { type AccentId, DEFAULT_ACCENT, getAccentPalette } from "@/config/accents";

type Theme = "light" | "dark";
export type ThemePreference = "light" | "dark" | "system";
export type { AccentId };

const ThemeContext = createContext<{
  theme: Theme;
  preference: ThemePreference;
  accent: AccentId;
  setTheme: (pref: ThemePreference) => void;
  setAccent: (id: AccentId) => void;
  toggle: () => void;
}>({
  theme: "light",
  preference: "system",
  accent: DEFAULT_ACCENT,
  setTheme: () => {},
  setAccent: () => {},
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function resolveTheme(pref: ThemePreference): Theme {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function applyAccent(accentId: AccentId, resolvedTheme: Theme) {
  const palette = getAccentPalette(accentId);
  const colors = resolvedTheme === "dark" ? palette.dark : palette.light;
  document.documentElement.style.setProperty("--mn-accent", colors.accent);
  document.documentElement.style.setProperty("--mn-accent-hover", colors.accentHover);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [theme, setResolvedTheme] = useState<Theme>("light");
  const [accent, setAccentState] = useState<AccentId>(DEFAULT_ACCENT);
  const [mounted, setMounted] = useState(false);

  // Init: read localStorage preference
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const validThemes: ThemePreference[] = ["light", "dark", "system"];
    const pref = stored && validThemes.includes(stored as ThemePreference) ? stored as ThemePreference : "system";
    setPreference(pref);
    const resolved = resolveTheme(pref);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    const storedAccent = localStorage.getItem("accent");
    const accentId = storedAccent && getAccentPalette(storedAccent as AccentId) ? storedAccent as AccentId : DEFAULT_ACCENT;
    setAccentState(accentId);
    applyAccent(accentId, resolved);

    setMounted(true);
  }, []);

  // Listen for OS preference changes when in "system" mode
  useEffect(() => {
    if (!mounted || preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const next = e.matches ? "dark" : "light";
      setResolvedTheme(next);
      applyTheme(next);
      applyAccent(accent, next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mounted, preference, accent]);

  const setTheme = (pref: ThemePreference) => {
    setPreference(pref);
    const resolved = resolveTheme(pref);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    applyAccent(accent, resolved);
    localStorage.setItem("theme", pref);
  };

  const setAccent = (id: AccentId) => {
    setAccentState(id);
    applyAccent(id, theme);
    localStorage.setItem("accent", id);
  };

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setPreference(next);
    setResolvedTheme(next);
    applyTheme(next);
    applyAccent(accent, next);
    localStorage.setItem("theme", next);
  };

  return (
    <ThemeContext.Provider value={{ theme, preference, accent, setTheme, setAccent, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
