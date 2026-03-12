interface CacheEntry<T> {
  data: T;
  staleAt: number;
  expiresAt: number;
  lastAccessed: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const refreshing = new Set<string>();

const DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes fresh
const STALE_TTL = 15 * 60 * 1000; // 15 minutes stale window after fresh
const MAX_ENTRIES = 200; // LRU eviction threshold

export interface CacheStatus<T> {
  data: T;
  stale: boolean;
}

/** Evict least-recently-accessed entries when cache exceeds MAX_ENTRIES */
function evictIfNeeded(): void {
  if (store.size <= MAX_ENTRIES) return;

  // Sort entries by lastAccessed ascending (oldest first)
  const entries = [...store.entries()].sort(
    (a, b) => a[1].lastAccessed - b[1].lastAccessed
  );

  const toEvict = store.size - MAX_ENTRIES;
  for (let i = 0; i < toEvict; i++) {
    store.delete(entries[i][0]);
  }
}

/**
 * Returns data with staleness info. Returns null only when truly expired.
 */
export function getCachedWithStatus<T>(key: string): CacheStatus<T> | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const now = Date.now();
  if (now > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  entry.lastAccessed = now;
  return { data: entry.data, stale: now > entry.staleAt };
}

/**
 * Backward-compatible getter. Returns data within the full window (fresh + stale),
 * null only when truly expired.
 */
export function getCached<T>(key: string): T | null {
  const result = getCachedWithStatus<T>(key);
  return result ? result.data : null;
}

export function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  const now = Date.now();
  store.set(key, {
    data,
    staleAt: now + ttl,
    expiresAt: now + ttl + STALE_TTL,
    lastAccessed: now,
  });
  evictIfNeeded();
}

export function isRefreshing(key: string): boolean {
  return refreshing.has(key);
}

export function markRefreshing(key: string): void {
  refreshing.add(key);
}

export function unmarkRefreshing(key: string): void {
  refreshing.delete(key);
}

export function clearCache(): void {
  store.clear();
}
