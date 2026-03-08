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

async function fetchDefaultSources(): Promise<Source[]> {
  try {
    const res = await fetch("/api/default-sources");
    if (!res.ok) return (defaultConfig as UserConfig).sources;
    const data = await res.json();
    return data.sources ?? (defaultConfig as UserConfig).sources;
  } catch {
    return (defaultConfig as UserConfig).sources;
  }
}

interface ConfigContextValue {
  /** Config with disabled sources filtered out — use for fetching articles */
  config: UserConfig;
  /** All sources including disabled — use for settings UI */
  allSources: Source[];
  /** Set of disabled source IDs */
  disabledSourceIds: Set<string>;
  /** Resolved featured tags (user's list or defaults) */
  featuredTags: string[];
  /** Ordered source group names for source bar */
  sourceBarOrder: string[];
  addSource: (source: Source) => void;
  addSources: (sources: Source[]) => void;
  removeSource: (id: string) => void;
  toggleSource: (id: string) => void;
  togglePaywall: (id: string) => void;
  setFeaturedTags: (slugs: string[]) => void;
  setSourceBarOrder: (names: string[]) => void;
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
  sourceBarOrder: string[];
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
  const [adminDefaults, setAdminDefaults] = useState<Source[] | null>(null);
  const adminDefaultsRef = useRef<Source[] | null>(null);

  // Refs that always reflect the latest values — eliminates stale closures
  const configRef = useRef(config);
  configRef.current = config;
  const disabledRef = useRef(disabledSources);
  disabledRef.current = disabledSources;
  const authRef = useRef(isAuthenticated);
  authRef.current = isAuthenticated;

  // Debounce timer for server saves
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<Record<string, unknown>>({});
  // Track whether user has made changes (prevents server fetch from overwriting)
  const dirtyRef = useRef(false);
  // Ref so async callbacks always see the latest serverLoaded value
  const serverLoadedRef = useRef(false);

  // Load from localStorage on mount, then fetch admin defaults
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setConfig(loadConfig());
    setDisabledSources(loadDisabled());
    setMounted(true);

    // Fetch admin defaults; only apply if user has no localStorage AND
    // server settings haven't already been loaded (prevents race condition)
    fetchDefaultSources().then((sources) => {
      setAdminDefaults(sources);
      adminDefaultsRef.current = sources;
      if (!stored && !serverLoadedRef.current && !dirtyRef.current) {
        setConfig({ sources });
      }
    });
  }, []);

  // When authenticated, load from server (overrides localStorage)
  useEffect(() => {
    if (!isAuthenticated || serverLoaded) return;

    fetchServerSettings().then((data) => {
      if (data) {
        // Don't overwrite if the user changed something while session was loading
        if (!dirtyRef.current) {
          const hasSources = data.sources && data.sources.length > 0;
          if (hasSources) {
            setConfig({ sources: data.sources, featuredTags: data.featuredTags, sourceBarOrder: data.sourceBarOrder });
            setDisabledSources(new Set(data.disabledSourceIds));
          } else if (adminDefaultsRef.current) {
            // New user with no saved sources → apply admin defaults
            setConfig({ sources: adminDefaultsRef.current });
          }
        }
        if (data.theme && VALID_THEME_PREFS.has(data.theme)) {
          setTheme(data.theme as ThemePreference);
        }
        if (data.accent && VALID_ACCENT_IDS.has(data.accent)) {
          setAccent(data.accent as AccentId);
        }
      }
      setServerLoaded(true);
      serverLoadedRef.current = true;
    });
  }, [isAuthenticated, serverLoaded]);

  // Reset server-loaded flag when auth status changes
  useEffect(() => {
    if (status === "unauthenticated") {
      setServerLoaded(false);
      serverLoadedRef.current = false;
      dirtyRef.current = false;
      // Reload from localStorage when signing out
      setConfig(loadConfig());
      setDisabledSources(loadDisabled());
    }
  }, [status]);

  const debouncedServerSave = useCallback(
    (data: Record<string, unknown>) => {
      Object.assign(pendingSaveRef.current, data);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const merged = { ...pendingSaveRef.current };
        pendingSaveRef.current = {};
        saveServerSettings(merged);
      }, 500);
    },
    []
  );

  const persist = useCallback(
    (next: UserConfig, disabled?: Set<string>) => {
      dirtyRef.current = true;
      setConfig(next);
      const nextDisabled = disabled ?? disabledRef.current;
      if (disabled !== undefined) setDisabledSources(disabled);

      // Always save to localStorage as backup
      saveConfigLocal(next);
      if (disabled !== undefined) saveDisabledLocal(disabled);

      if (authRef.current) {
        debouncedServerSave({
          sources: next.sources,
          featuredTags: next.featuredTags ?? [],
          sourceBarOrder: next.sourceBarOrder ?? [],
          disabledSourceIds: [...nextDisabled],
        });
      }
    },
    [debouncedServerSave]
  );

  const addSource = useCallback(
    (source: Source) => {
      const cur = configRef.current;
      persist({ ...cur, sources: [...cur.sources, source] });
    },
    [persist]
  );

  const addSources = useCallback(
    (sources: Source[]) => {
      const cur = configRef.current;
      persist({ ...cur, sources: [...cur.sources, ...sources] });
    },
    [persist]
  );

  const removeSource = useCallback(
    (id: string) => {
      const cur = configRef.current;
      const nextDisabled = new Set(disabledRef.current);
      nextDisabled.delete(id);
      persist(
        { ...cur, sources: cur.sources.filter((s) => s.id !== id) },
        nextDisabled
      );
    },
    [persist]
  );

  const toggleSource = useCallback(
    (id: string) => {
      dirtyRef.current = true;
      const next = new Set(disabledRef.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setDisabledSources(next);

      saveDisabledLocal(next);
      if (authRef.current) {
        debouncedServerSave({ disabledSourceIds: [...next] });
      }
    },
    [debouncedServerSave]
  );

  const togglePaywall = useCallback(
    (id: string) => {
      const cur = configRef.current;
      persist({
        ...cur,
        sources: cur.sources.map((s) =>
          s.id === id ? { ...s, paywalled: !s.paywalled } : s
        ),
      });
    },
    [persist]
  );

  const setFeaturedTags = useCallback(
    (slugs: string[]) => {
      persist({ ...configRef.current, featuredTags: slugs });
    },
    [persist]
  );

  const setSourceBarOrder = useCallback(
    (names: string[]) => {
      persist({ ...configRef.current, sourceBarOrder: names });
    },
    [persist]
  );

  const saveTheme = useCallback(
    (preference: ThemePreference) => {
      if (authRef.current) {
        debouncedServerSave({ theme: preference });
      }
    },
    [debouncedServerSave]
  );

  const saveAccent = useCallback(
    (accent: AccentId) => {
      if (authRef.current) {
        debouncedServerSave({ accent });
      }
    },
    [debouncedServerSave]
  );

  const resetToDefaults = useCallback(() => {
    dirtyRef.current = true;
    const sources = adminDefaults ?? (defaultConfig as UserConfig).sources;
    const fresh: UserConfig = { sources };
    const empty = new Set<string>();
    setConfig(fresh);
    setDisabledSources(empty);

    saveConfigLocal(fresh);
    saveDisabledLocal(empty);
    if (authRef.current) {
      debouncedServerSave({
        sources: fresh.sources,
        featuredTags: [],
        sourceBarOrder: [],
        disabledSourceIds: [],
      });
    }
  }, [debouncedServerSave, adminDefaults]);

  const effectiveConfig: UserConfig = mounted
    ? {
        sources: config.sources.filter((s) => !disabledSources.has(s.id)),
        featuredTags: config.featuredTags,
        sourceBarOrder: config.sourceBarOrder,
      }
    : (defaultConfig as UserConfig);

  return (
    <ConfigContext.Provider
      value={{
        config: effectiveConfig,
        allSources: mounted ? config.sources : (defaultConfig as UserConfig).sources,
        disabledSourceIds: disabledSources,
        featuredTags: mounted ? (config.featuredTags ?? DEFAULT_FEATURED_TAGS) : DEFAULT_FEATURED_TAGS,
        sourceBarOrder: mounted ? (config.sourceBarOrder ?? []) : [],
        addSource,
        addSources,
        removeSource,
        toggleSource,
        togglePaywall,
        setFeaturedTags,
        setSourceBarOrder,
        saveTheme,
        saveAccent,
        resetToDefaults,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}
