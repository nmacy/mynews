"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { Source, UserConfig } from "@/types";
import defaultConfig from "@/config/sources.json";
import { DEFAULT_FEATURED_TAGS } from "@/components/layout/TagTabs";
import { useTheme, type ThemePreference, type AccentId } from "@/components/ThemeProvider";
import { ACCENT_PALETTES } from "@/config/accents";

const STORAGE_KEY = "mynews-config";
const DISABLED_KEY = "mynews-disabled-sources";

interface ConfigContextValue {
  /** Config with disabled sources filtered out — use for fetching articles */
  config: UserConfig;
  /** All sources including disabled — use for settings UI */
  allSources: Source[];
  /** Set of disabled source IDs */
  disabledSourceIds: Set<string>;
  /** Resolved featured tags (user's list or defaults) */
  featuredTags: string[];
  addSource: (source: Source) => void;
  removeSource: (id: string) => void;
  toggleSource: (id: string) => void;
  togglePaywall: (id: string) => void;
  setFeaturedTags: (slugs: string[]) => void;
  saveTheme: (preference: ThemePreference) => void;
  saveAccent: (accent: AccentId) => void;
  resetToDefaults: () => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within ConfigProvider");
  return ctx;
}

// --- localStorage helpers (guest mode) ---

function loadConfig(): UserConfig {
  if (typeof window === "undefined") return defaultConfig as UserConfig;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as UserConfig;
  } catch {
    // fall back
  }
  return defaultConfig as UserConfig;
}

function saveConfigLocal(config: UserConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // storage unavailable
  }
}

function loadDisabled(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(DISABLED_KEY);
    if (stored) return new Set(JSON.parse(stored) as string[]);
  } catch {
    // ignore
  }
  return new Set();
}

function saveDisabledLocal(disabled: Set<string>) {
  try {
    localStorage.setItem(DISABLED_KEY, JSON.stringify([...disabled]));
  } catch {
    // ignore
  }
}

// --- Server helpers (authenticated mode) ---

async function fetchServerSettings(): Promise<{
  sources: Source[];
  featuredTags: string[];
  disabledSourceIds: string[];
  theme?: string;
  accent?: string;
} | null> {
  try {
    const res = await fetch("/api/user/settings");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function saveServerSettings(data: Record<string, unknown>): Promise<void> {
  try {
    await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    // silent fail — next save will retry
  }
}

const VALID_THEME_PREFS = new Set<string>(["light", "dark", "system"]);
const VALID_ACCENT_IDS = new Set<string>(ACCENT_PALETTES.map((p) => p.id));

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { setTheme, setAccent } = useTheme();

  const [config, setConfig] = useState<UserConfig>(defaultConfig as UserConfig);
  const [disabledSources, setDisabledSources] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [serverLoaded, setServerLoaded] = useState(false);

  // Debounce timer for server saves
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage on mount (always, for instant hydration)
  useEffect(() => {
    setConfig(loadConfig());
    setDisabledSources(loadDisabled());
    setMounted(true);
  }, []);

  // When authenticated, load from server (overrides localStorage)
  useEffect(() => {
    if (!isAuthenticated || serverLoaded) return;

    fetchServerSettings().then((data) => {
      if (data) {
        const hasSources = data.sources && data.sources.length > 0;
        if (hasSources) {
          setConfig({ sources: data.sources, featuredTags: data.featuredTags });
          setDisabledSources(new Set(data.disabledSourceIds));
        }
        if (data.theme && VALID_THEME_PREFS.has(data.theme)) {
          setTheme(data.theme as ThemePreference);
        }
        if (data.accent && VALID_ACCENT_IDS.has(data.accent)) {
          setAccent(data.accent as AccentId);
        }
        // If server settings are empty, keep localStorage values
        // (ImportSettingsPrompt will handle migration)
      }
      setServerLoaded(true);
    });
  }, [isAuthenticated, serverLoaded]);

  // Reset server-loaded flag when auth status changes
  useEffect(() => {
    if (status === "unauthenticated") {
      setServerLoaded(false);
      // Reload from localStorage when signing out
      setConfig(loadConfig());
      setDisabledSources(loadDisabled());
    }
  }, [status]);

  const debouncedServerSave = useCallback(
    (data: Record<string, unknown>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveServerSettings(data), 500);
    },
    []
  );

  const persist = useCallback(
    (next: UserConfig, disabled?: Set<string>) => {
      setConfig(next);
      const nextDisabled = disabled ?? disabledSources;
      if (disabled !== undefined) setDisabledSources(disabled);

      if (isAuthenticated) {
        debouncedServerSave({
          sources: next.sources,
          featuredTags: next.featuredTags ?? [],
          disabledSourceIds: [...nextDisabled],
        });
      } else {
        saveConfigLocal(next);
        if (disabled !== undefined) saveDisabledLocal(disabled);
      }
    },
    [isAuthenticated, disabledSources, debouncedServerSave]
  );

  const addSource = useCallback(
    (source: Source) => {
      persist({ ...config, sources: [...config.sources, source] });
    },
    [config, persist]
  );

  const removeSource = useCallback(
    (id: string) => {
      const nextDisabled = new Set(disabledSources);
      nextDisabled.delete(id);
      persist(
        { ...config, sources: config.sources.filter((s) => s.id !== id) },
        nextDisabled
      );
    },
    [config, disabledSources, persist]
  );

  const toggleSource = useCallback(
    (id: string) => {
      const next = new Set(disabledSources);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setDisabledSources(next);

      if (isAuthenticated) {
        debouncedServerSave({ disabledSourceIds: [...next] });
      } else {
        saveDisabledLocal(next);
      }
    },
    [disabledSources, isAuthenticated, debouncedServerSave]
  );

  const togglePaywall = useCallback(
    (id: string) => {
      persist({
        ...config,
        sources: config.sources.map((s) =>
          s.id === id ? { ...s, paywalled: !s.paywalled } : s
        ),
      });
    },
    [config, persist]
  );

  const setFeaturedTags = useCallback(
    (slugs: string[]) => {
      persist({ ...config, featuredTags: slugs });
    },
    [config, persist]
  );

  const saveTheme = useCallback(
    (preference: ThemePreference) => {
      if (isAuthenticated) {
        debouncedServerSave({ theme: preference });
      }
    },
    [isAuthenticated, debouncedServerSave]
  );

  const saveAccent = useCallback(
    (accent: AccentId) => {
      if (isAuthenticated) {
        debouncedServerSave({ accent });
      }
    },
    [isAuthenticated, debouncedServerSave]
  );

  const resetToDefaults = useCallback(() => {
    const fresh = defaultConfig as UserConfig;
    const empty = new Set<string>();
    setConfig(fresh);
    setDisabledSources(empty);

    if (isAuthenticated) {
      debouncedServerSave({
        sources: fresh.sources,
        featuredTags: [],
        disabledSourceIds: [],
      });
    } else {
      saveConfigLocal(fresh);
      saveDisabledLocal(empty);
    }
  }, [isAuthenticated, debouncedServerSave]);

  const effectiveConfig: UserConfig = mounted
    ? {
        sources: config.sources.filter((s) => !disabledSources.has(s.id)),
        featuredTags: config.featuredTags,
      }
    : (defaultConfig as UserConfig);

  return (
    <ConfigContext.Provider
      value={{
        config: effectiveConfig,
        allSources: mounted ? config.sources : (defaultConfig as UserConfig).sources,
        disabledSourceIds: disabledSources,
        featuredTags: mounted ? (config.featuredTags ?? DEFAULT_FEATURED_TAGS) : DEFAULT_FEATURED_TAGS,
        addSource,
        removeSource,
        toggleSource,
        togglePaywall,
        setFeaturedTags,
        saveTheme,
        saveAccent,
        resetToDefaults,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}
