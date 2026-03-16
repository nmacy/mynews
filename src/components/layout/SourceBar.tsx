"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useConfig } from "@/components/ConfigProvider";
import { useClickOutside } from "@/lib/useClickOutside";

export interface SourceGroup {
  name: string;
  ids: string[];
}

const SOURCE_COLORS = [
  "#E53E3E", // red
  "#DD6B20", // orange
  "#D69E2E", // yellow
  "#38A169", // green
  "#319795", // teal
  "#3182CE", // blue
  "#5A67D8", // indigo
  "#805AD5", // purple
  "#D53F8C", // pink
  "#2B6CB0", // dark blue
  "#276749", // dark green
  "#9B2C2C", // dark red
  "#744210", // brown
  "#285E61", // dark teal
  "#553C9A", // dark purple
  "#97266D", // dark pink
];

/** Stable color per source name using simple string hash */
export function sourceColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return SOURCE_COLORS[Math.abs(hash) % SOURCE_COLORS.length];
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
  const { sourceBarOrder, setSourceBarOrder } = useConfig();
  const groups = useSourceGroups();
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState("");
  const moreRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Suppress initial render to avoid hydration mismatch —
  // server renders with default sources, client has user's sources from localStorage
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  const closeDropdown = useCallback(() => { setMoreOpen(false); setSearch(""); }, []);
  useClickOutside(moreRef, closeDropdown, moreOpen);

  useEffect(() => {
    if (moreOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [moreOpen]);

  const isListingPage = pathname === "/" || pathname.startsWith("/tag/");
  const sourcesParam = searchParams.get("sources") || "";
  const urlActiveIds = sourcesParam ? sourcesParam.split(",").filter(Boolean) : [];

  // Restore active sources from sessionStorage after hydration (non-listing pages only)
  const [restoredIds, setRestoredIds] = useState<string[]>([]);
  useEffect(() => {
    if (isListingPage) {
      // Persist current selection
      if (urlActiveIds.length > 0) {
        sessionStorage.setItem("mn-active-sources", urlActiveIds.join(","));
      } else {
        sessionStorage.removeItem("mn-active-sources");
      }
      setRestoredIds([]);
    } else {
      // Restore from sessionStorage
      const stored = sessionStorage.getItem("mn-active-sources");
      setRestoredIds(stored ? stored.split(",").filter(Boolean) : []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListingPage, sourcesParam]);

  const activeIds = isListingPage ? urlActiveIds : restoredIds;
  const activeSet = useMemo(() => new Set(activeIds), [activeIds]);

  // Split into featured (inline) vs overflow groups
  const hasCustomOrder = sourceBarOrder.length > 0;
  const featuredSet = useMemo(() => new Set(sourceBarOrder), [sourceBarOrder]);
  const featuredGroups = useMemo(
    () => hasCustomOrder ? groups.filter((g) => featuredSet.has(g.name)) : groups,
    [hasCustomOrder, groups, featuredSet]
  );
  const overflowGroups = useMemo(
    () => hasCustomOrder ? groups.filter((g) => !featuredSet.has(g.name)) : [],
    [hasCustomOrder, groups, featuredSet]
  );

  // Check if the active source is in the overflow
  const activeOverflowGroup = useMemo(
    () => overflowGroups.find((g) => g.ids.every((id) => activeSet.has(id)) && activeIds.length === g.ids.length),
    [overflowGroups, activeSet, activeIds.length]
  );

  const filteredOverflow = useMemo(() => {
    if (!search) return overflowGroups;
    const q = search.toLowerCase();
    return overflowGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [overflowGroups, search]);

  // Hide on auth pages only
  if (pathname === "/login" || pathname === "/signup") return null;
  if (!hydrated || groups.length === 0) return null;

  const updateSources = (nextIds: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextIds.length > 0) {
      params.set("sources", nextIds.join(","));
    } else {
      params.delete("sources");
    }
    params.delete("source");
    // When selecting a source, navigate to home so the tag bar reverts to "All"
    const basePath = nextIds.length > 0 ? "/" : pathname;
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  const toggleGroup = (group: SourceGroup) => {
    const allActive = group.ids.every((id) => activeSet.has(id)) && activeIds.length === group.ids.length;

    if (allActive) {
      // Deselect back to "All"
      updateSources([]);
    } else {
      // Select only this group
      updateSources(group.ids);
    }
  };

  const clearSources = () => {
    updateSources([]);
  };

  const isAllActive = activeIds.length === 0;

  const PinIcon = ({ filled }: { filled: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  );

  const togglePin = (groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasCustomOrder) {
      // Initialize order with all names except the one being unpinned
      setSourceBarOrder(groups.map((g) => g.name).filter((n) => n !== groupName));
    } else if (featuredSet.has(groupName)) {
      setSourceBarOrder(sourceBarOrder.filter((n) => n !== groupName));
    } else {
      setSourceBarOrder([...sourceBarOrder, groupName]);
    }
  };

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

            {featuredGroups.map((group) => {
              const isActive = group.ids.every((id) => activeSet.has(id)) && activeIds.length === group.ids.length;
              const color = sourceColor(group.name);
              return (
                <button
                  key={group.name}
                  onClick={() => toggleGroup(group)}
                  className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center gap-1"
                  style={
                    isActive
                      ? { backgroundColor: color, color: "white" }
                      : { color: "var(--mn-muted)" }
                  }
                >
                  {group.name}
                  {isActive && (
                    <span
                      onClick={(e) => togglePin(group.name, e)}
                      title="Unpin from bar"
                      className="ml-0.5 opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <PinIcon filled />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* More dropdown — outside the overflow container */}
          {overflowGroups.length > 0 && (
            <div className="relative flex-shrink-0" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-full transition-colors"
                style={{
                  color: activeOverflowGroup ? "white" : "var(--mn-muted)",
                  backgroundColor: activeOverflowGroup ? sourceColor(activeOverflowGroup.name) : "transparent",
                }}
              >
                {activeOverflowGroup ? activeOverflowGroup.name : "More"}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition-transform ${moreOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {moreOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg max-h-80 overflow-hidden min-w-[200px] flex flex-col"
                  style={{
                    backgroundColor: "var(--mn-card)",
                    border: "1px solid var(--mn-border)",
                  }}
                >
                  <div className="px-2 pt-2 pb-1">
                    <input
                      ref={searchRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search sources..."
                      className="w-full px-2.5 py-1.5 text-sm rounded-md outline-none"
                      style={{
                        backgroundColor: "var(--mn-bg)",
                        color: "var(--mn-fg)",
                        border: "1px solid var(--mn-border)",
                      }}
                    />
                  </div>
                  <div className="overflow-y-auto py-1">
                    {filteredOverflow.length === 0 && (
                      <div className="px-3 py-2 text-sm" style={{ color: "var(--mn-muted)" }}>
                        No sources found
                      </div>
                    )}
                    {filteredOverflow.map((group) => {
                      const isActive = group.ids.every((id) => activeSet.has(id)) && activeIds.length === group.ids.length;
                      const color = sourceColor(group.name);
                      return (
                        <button
                          key={group.name}
                          onClick={() => { toggleGroup(group); setMoreOpen(false); setSearch(""); }}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:opacity-80 transition-opacity w-full text-left"
                          style={{
                            color: isActive ? "white" : "var(--mn-fg)",
                            backgroundColor: isActive ? color : "transparent",
                          }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="flex-1">{group.name}</span>
                          {isActive && (
                            <span
                              onClick={(e) => { togglePin(group.name, e); setMoreOpen(false); setSearch(""); }}
                              title="Pin to bar"
                              className="opacity-70 hover:opacity-100 transition-opacity"
                            >
                              <PinIcon filled={false} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
