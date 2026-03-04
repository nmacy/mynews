import type { LibrarySource } from "@/types";

const STORAGE_KEY = "mynews-custom-library";

export function loadCustomLibrarySources(): LibrarySource[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as LibrarySource[];
  } catch {
    // ignore
  }
  return [];
}

export function saveCustomLibrarySource(source: LibrarySource): void {
  const existing = loadCustomLibrarySources();
  if (existing.some((s) => s.id === source.id)) return;
  existing.push(source);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // storage unavailable
  }
}
