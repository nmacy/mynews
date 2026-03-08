interface CacheEntry<T> {
  data: T;
  staleAt: number;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const refreshing = new Set<string>();

const DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes fresh
const STALE_TTL = 15 * 60 * 1000; // 15 minutes stale window after fresh

export interface CacheStatus<T> {
  data: T;
  stale: boolean;
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
  store.set(key, {
    data,
    staleAt: Date.now() + ttl,
    expiresAt: Date.now() + ttl + STALE_TTL,
  });
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
