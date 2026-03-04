"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Category, Source, UserConfig } from "@/types";
import defaultConfig from "@/config/sources.json";

const STORAGE_KEY = "mynews-config";
const DISABLED_KEY = "mynews-disabled-sources";

interface ConfigContextValue {
  /** Config with disabled sources filtered out — use for fetching articles */
  config: UserConfig;
  /** All sources including disabled — use for settings UI */
  allSources: Source[];
  /** Set of disabled source IDs */
  disabledSourceIds: Set<string>;
  addCategory: (category: Category) => void;
  removeCategory: (slug: string) => void;
  addSource: (source: Source) => void;
  removeSource: (id: string) => void;
  toggleSource: (id: string) => void;
  togglePaywall: (id: string) => void;
  toggleSourceCategory: (sourceId: string, categorySlug: string) => void;
  resetToDefaults: () => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within ConfigProvider");
  return ctx;
}

function loadConfig(): UserConfig {
  if (typeof window === "undefined") return defaultConfig as UserConfig;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UserConfig;
      if (!parsed.categories.find((c) => c.slug === "top-stories")) {
        parsed.categories.unshift(
          defaultConfig.categories.find((c) => c.slug === "top-stories")! as Category
        );
      }
      return parsed;
    }
  } catch {
    // fall back to defaults
  }
  return defaultConfig as UserConfig;
}

function saveConfig(config: UserConfig) {
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

function saveDisabled(disabled: Set<string>) {
  try {
    localStorage.setItem(DISABLED_KEY, JSON.stringify([...disabled]));
  } catch {
    // ignore
  }
}

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<UserConfig>(defaultConfig as UserConfig);
  const [disabledSources, setDisabledSources] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
    setDisabledSources(loadDisabled());
    setMounted(true);
  }, []);

  const persist = useCallback((next: UserConfig, disabled?: Set<string>) => {
    setConfig(next);
    saveConfig(next);
    if (disabled !== undefined) {
      setDisabledSources(disabled);
      saveDisabled(disabled);
    }
  }, []);

  const addCategory = useCallback(
    (category: Category) => {
      persist({ ...config, categories: [...config.categories, category] });
    },
    [config, persist]
  );

  const removeCategory = useCallback(
    (slug: string) => {
      if (slug === "top-stories") return;
      persist({
        categories: config.categories.filter((c) => c.slug !== slug),
        sources: config.sources.map((s) => ({
          ...s,
          categories: s.categories.filter((c) => c !== slug),
        })),
      });
    },
    [config, persist]
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
      saveDisabled(next);
    },
    [disabledSources]
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

  const toggleSourceCategory = useCallback(
    (sourceId: string, categorySlug: string) => {
      persist({
        ...config,
        sources: config.sources.map((s) => {
          if (s.id !== sourceId) return s;
          const has = s.categories.includes(categorySlug);
          return {
            ...s,
            categories: has
              ? s.categories.filter((c) => c !== categorySlug)
              : [...s.categories, categorySlug],
          };
        }),
      });
    },
    [config, persist]
  );

  const resetToDefaults = useCallback(() => {
    const fresh = defaultConfig as UserConfig;
    setConfig(fresh);
    saveConfig(fresh);
    const empty = new Set<string>();
    setDisabledSources(empty);
    saveDisabled(empty);
  }, []);

  const effectiveConfig: UserConfig = mounted
    ? {
        categories: config.categories,
        sources: config.sources.filter((s) => !disabledSources.has(s.id)),
      }
    : (defaultConfig as UserConfig);

  return (
    <ConfigContext.Provider
      value={{
        config: effectiveConfig,
        allSources: mounted ? config.sources : (defaultConfig as UserConfig).sources,
        disabledSourceIds: disabledSources,
        addCategory,
        removeCategory,
        addSource,
        removeSource,
        toggleSource,
        togglePaywall,
        toggleSourceCategory,
        resetToDefaults,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}
