import { prisma } from "./prisma";

const cache = new Map<string, { value: string; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function getServerConfig(key: string): Promise<string | null> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const rows = await prisma.$queryRawUnsafe<{ value: string }[]>(
    "SELECT value FROM ServerConfig WHERE key = ?",
    key
  );
  if (rows.length > 0) {
    cache.set(key, { value: rows[0].value, fetchedAt: Date.now() });
    return rows[0].value;
  }
  return null;
}

export async function setServerConfig(key: string, value: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO ServerConfig (key, value, updatedAt) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    key,
    value
  );
  cache.set(key, { value, fetchedAt: Date.now() });
}

export async function getRefreshIntervalMs(): Promise<number> {
  const val = await getServerConfig("refreshIntervalMinutes");
  const minutes = val ? parseInt(val, 10) : 5;
  return (isNaN(minutes) || minutes < 1 ? 5 : minutes) * 60_000;
}

export async function getRetentionDays(): Promise<number> {
  const val = await getServerConfig("retentionDays");
  const days = val ? parseInt(val, 10) : 14;
  return isNaN(days) || days < 1 ? 14 : days;
}
