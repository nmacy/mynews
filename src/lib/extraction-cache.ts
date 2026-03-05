import { prisma } from "./prisma";

/** Cache TTL: 24 hours */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedArticle {
  title: string | null;
  content: string;
  author: string | null;
  published: string | null;
  image: string | null;
  ttr: number | null;
}

/**
 * Look up a cached extraction by URL.
 * Returns null on miss or if the entry has expired.
 */
export async function getCachedExtraction(url: string): Promise<CachedArticle | null> {
  const row = await prisma.cachedExtraction.findUnique({ where: { url } });
  if (!row) return null;

  if (row.expiresAt < new Date()) {
    await prisma.cachedExtraction.delete({ where: { url } }).catch(() => {});
    return null;
  }

  return {
    title: row.title,
    content: row.content,
    author: row.author,
    published: row.published,
    image: row.image,
    ttr: row.ttr,
  };
}

/**
 * Store an extraction result in the cache.
 * Uses upsert so re-extractions update the existing row.
 */
export async function setCachedExtraction(url: string, data: CachedArticle): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

  await prisma.cachedExtraction.upsert({
    where: { url },
    create: {
      url,
      title: data.title,
      content: data.content,
      author: data.author,
      published: data.published,
      image: data.image,
      ttr: data.ttr,
      expiresAt,
    },
    update: {
      title: data.title,
      content: data.content,
      author: data.author,
      published: data.published,
      image: data.image,
      ttr: data.ttr,
      expiresAt,
      createdAt: new Date(),
    },
  });
}

/**
 * Get cache statistics for the admin dashboard.
 */
export async function getCacheStats(): Promise<{
  count: number;
  totalSizeKb: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}> {
  const count = await prisma.cachedExtraction.count();

  if (count === 0) {
    return { count: 0, totalSizeKb: 0, oldestEntry: null, newestEntry: null };
  }

  const sizeResult = await prisma.$queryRaw<[{ total_bytes: bigint }]>`
    SELECT COALESCE(SUM(LENGTH(content)), 0) as total_bytes FROM CachedExtraction
  `;
  const totalSizeKb = Math.round(Number(sizeResult[0].total_bytes) / 1024);

  const oldest = await prisma.cachedExtraction.findFirst({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const newest = await prisma.cachedExtraction.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return {
    count,
    totalSizeKb,
    oldestEntry: oldest?.createdAt.toISOString() ?? null,
    newestEntry: newest?.createdAt.toISOString() ?? null,
  };
}

/**
 * Delete all cached extractions.
 */
export async function flushExtractionCache(): Promise<number> {
  const result = await prisma.cachedExtraction.deleteMany();
  return result.count;
}

/**
 * Delete expired entries. Called opportunistically.
 */
export async function pruneExpiredExtractions(): Promise<number> {
  const result = await prisma.cachedExtraction.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
