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

export interface RankingConfig {
  enabled: boolean;
  layerAiScore: boolean;
  layerSourcePriority: boolean;
  layerTagInterest: boolean;
  layerTimeDecay: boolean;
  layerDedup: boolean;
  timeDecayGravity: number;
  debugScores: boolean;
}

const RANKING_KEYS = {
  rankingEnabled: "false",
  rankLayerAiScore: "true",
  rankLayerSourcePriority: "true",
  rankLayerTagInterest: "true",
  rankLayerTimeDecay: "true",
  rankLayerDedup: "true",
  rankTimeDecayGravity: "1.2",
  rankDebugScores: "false",
} as const;

export async function getRankingConfig(): Promise<RankingConfig> {
  const values = await Promise.all(
    Object.entries(RANKING_KEYS).map(async ([key, defaultVal]) => {
      const val = await getServerConfig(key);
      return [key, val ?? defaultVal] as const;
    })
  );
  const map = Object.fromEntries(values);
  return {
    enabled: map.rankingEnabled === "true",
    layerAiScore: map.rankLayerAiScore === "true",
    layerSourcePriority: map.rankLayerSourcePriority === "true",
    layerTagInterest: map.rankLayerTagInterest === "true",
    layerTimeDecay: map.rankLayerTimeDecay === "true",
    layerDedup: map.rankLayerDedup === "true",
    timeDecayGravity: parseFloat(map.rankTimeDecayGravity) || 1.2,
    debugScores: map.rankDebugScores === "true",
  };
}
