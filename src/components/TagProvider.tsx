"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { TAG_DEFINITIONS, type TagDefinition } from "@/config/tags";

interface TagContextValue {
  tagDefinitions: TagDefinition[];
  tagMap: Map<string, TagDefinition>;
  refreshTags: () => void;
}

const STATIC_MAP = new Map(TAG_DEFINITIONS.map((t) => [t.slug, t]));

const TagContext = createContext<TagContextValue>({
  tagDefinitions: TAG_DEFINITIONS,
  tagMap: STATIC_MAP,
  refreshTags: () => {},
});

export function TagProvider({ children }: { children: React.ReactNode }) {
  const [customTags, setCustomTags] = useState<TagDefinition[]>([]);

  const fetchCustomTags = useCallback(() => {
    fetch("/api/tags/definitions")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data.tags)) return;
        const staticSlugs = new Set(TAG_DEFINITIONS.map((t) => t.slug));
        const custom = data.tags
          .filter(
            (t: { slug: string }) => !staticSlugs.has(t.slug)
          )
          .map((t: { slug: string; label: string; color: string; parent?: string }) => ({
            slug: t.slug,
            label: t.label,
            color: t.color,
            keywords: [] as string[],
            ...(t.parent ? { parent: t.parent } : {}),
          }));
        setCustomTags(custom);
      })
      .catch((err) => {
        console.warn("[TagProvider] Failed to fetch custom tags:", err);
      });
  }, []);

  useEffect(() => {
    fetchCustomTags();
  }, [fetchCustomTags]);

  // During SSR and first client render, use static tags only to avoid hydration mismatch.
  // Custom tags merge in after the useEffect fetch completes (post-hydration).
  const tagDefinitions = useMemo(
    () => (customTags.length > 0 ? [...TAG_DEFINITIONS, ...customTags] : TAG_DEFINITIONS),
    [customTags]
  );

  const tagMap = useMemo(
    () => (customTags.length > 0 ? new Map(tagDefinitions.map((t) => [t.slug, t])) : STATIC_MAP),
    [tagDefinitions, customTags.length]
  );

  const value = useMemo(
    () => ({ tagDefinitions, tagMap, refreshTags: fetchCustomTags }),
    [tagDefinitions, tagMap, fetchCustomTags]
  );

  return <TagContext.Provider value={value}>{children}</TagContext.Provider>;
}

export function useTagMap() {
  return useContext(TagContext).tagMap;
}

export function useTagDefinitions() {
  return useContext(TagContext).tagDefinitions;
}

export function useRefreshTags() {
  return useContext(TagContext).refreshTags;
}
