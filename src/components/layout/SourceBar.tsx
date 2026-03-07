"use client";

import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useConfig } from "@/components/ConfigProvider";

export interface SourceGroup {
  name: string;
  ids: string[];
}

/** Group enabled sources by name, ordered by sourceBarOrder then natural appearance order */
export function useSourceGroups(): SourceGroup[] {
  const { config, sourceBarOrder } = useConfig();
  const enabledSources = config.sources;

  return useMemo(() => {
    // Build groups keyed by name (only from enabled sources)
    const map = new Map<string, string[]>();
    for (const s of enabledSources) {
      const ids = map.get(s.name) || [];
      ids.push(s.id);
      map.set(s.name, ids);
    }

    // Natural order = order of first appearance in enabledSources
    const naturalOrder = Array.from(map.keys());

    // Ordered sources: sourceBarOrder first (if they exist), then remaining
    const orderedSet = new Set(sourceBarOrder);
    const ordered: string[] = [];
    for (const name of sourceBarOrder) {
      if (map.has(name)) ordered.push(name);
    }
    for (const name of naturalOrder) {
      if (!orderedSet.has(name)) ordered.push(name);
    }

    return ordered.map((name) => ({ name, ids: map.get(name)! }));
  }, [enabledSources, sourceBarOrder]);
}

export function SourceBar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const groups = useSourceGroups();

  // Only show on article-listing pages
  if (pathname !== "/" && !pathname.startsWith("/tag/")) return null;
  if (groups.length === 0) return null;

  const sourcesParam = searchParams.get("sources") || "";
  const activeIds = sourcesParam ? sourcesParam.split(",").filter(Boolean) : [];
  const activeSet = new Set(activeIds);

  const updateSources = (nextIds: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextIds.length > 0) {
      params.set("sources", nextIds.join(","));
    } else {
      params.delete("sources");
    }
    params.delete("source");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const toggleGroup = (group: SourceGroup) => {
    const groupSet = new Set(group.ids);
    const allActive = group.ids.every((id) => activeSet.has(id));

    if (allActive) {
      // Remove all IDs in this group
      updateSources(activeIds.filter((id) => !groupSet.has(id)));
    } else {
      // Add all IDs in this group that aren't already active
      const toAdd = group.ids.filter((id) => !activeSet.has(id));
      updateSources([...activeIds, ...toAdd]);
    }
  };

  const clearSources = () => {
    updateSources([]);
  };

  const isAllActive = activeIds.length === 0;

  return (
    <nav style={{ backgroundColor: "var(--mn-card)", borderBottom: "1px solid var(--mn-border)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 items-center py-1">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            <button
              onClick={clearSources}
              className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-colors"
              style={
                isAllActive
                  ? { backgroundColor: "var(--mn-accent)", color: "white" }
                  : { color: "var(--mn-muted)" }
              }
            >
              All
            </button>

            {groups.map((group) => {
              const isActive = group.ids.every((id) => activeSet.has(id));
              return (
                <button
                  key={group.name}
                  onClick={() => toggleGroup(group)}
                  className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-colors"
                  style={
                    isActive
                      ? { backgroundColor: "var(--mn-accent)", color: "white" }
                      : { color: "var(--mn-muted)" }
                  }
                >
                  {group.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
