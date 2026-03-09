import { prisma } from "./prisma";
import { getRetentionDays } from "./server-config";
import type { Article } from "@/types";

const BATCH_SIZE = 50; // 50 × 17 columns = 850 params, under SQLite's 999 limit

function expiresAt(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Bulk upsert articles into SQLite using raw SQL for performance.
 * Batches in chunks of 50 to stay under SQLite's 999 parameter limit.
 */
export async function persistArticles(articles: Article[]): Promise<void> {
  if (articles.length === 0) return;

  const retention = await getRetentionDays();
  const exp = expiresAt(retention);
  const now = new Date();

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const placeholders: string[] = [];
    const values: unknown[] = [];

    for (const a of batch) {
      placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      values.push(
        a.id,
        a.url,
        a.title,
        a.description,
        a.content,
        a.imageUrl ?? null,
        new Date(a.publishedAt).toISOString(),
        a.source.id,
        a.source.name,
        JSON.stringify(a.categories ?? []),
        JSON.stringify(a.tags ?? []),
        a.priority ?? 2,
        a.paywalled ? 1 : 0,
        a._aiTagged ? 1 : 0,
        a._hasTimestamp !== false ? 1 : 0,
        now.toISOString(),  // firstSeen
        now.toISOString(),  // lastSeen
        exp.toISOString(),  // expiresAt
      );
    }

    const sql = `
      INSERT INTO Article (id, url, title, description, content, imageUrl, publishedAt, sourceId, sourceName, categories, tags, priority, paywalled, aiTagged, hasTimestamp, firstSeen, lastSeen, expiresAt)
      VALUES ${placeholders.join(", ")}
      ON CONFLICT(url) DO UPDATE SET
        lastSeen = excluded.lastSeen,
        expiresAt = excluded.expiresAt,
        publishedAt = CASE WHEN excluded.hasTimestamp = 1 THEN excluded.publishedAt ELSE Article.publishedAt END,
        hasTimestamp = CASE WHEN excluded.hasTimestamp = 1 THEN 1 ELSE Article.hasTimestamp END,
        tags = CASE WHEN LENGTH(excluded.tags) > 4 THEN excluded.tags ELSE Article.tags END,
        imageUrl = CASE WHEN excluded.imageUrl IS NOT NULL THEN excluded.imageUrl ELSE Article.imageUrl END,
        aiTagged = CASE WHEN excluded.aiTagged = 1 THEN 1 ELSE Article.aiTagged END
    `;

    await prisma.$executeRawUnsafe(sql, ...values);
  }
}

/**
 * Load all non-expired articles matching the given source IDs,
 * sorted by publishedAt desc.
 */
export async function loadPersistedArticles(sourceIds: string[]): Promise<Article[]> {
  if (sourceIds.length === 0) return [];

  const rows = await prisma.article.findMany({
    where: {
      sourceId: { in: sourceIds },
      expiresAt: { gt: new Date() },
    },
    orderBy: { publishedAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    content: r.content,
    url: r.url,
    imageUrl: r.imageUrl,
    publishedAt: r.publishedAt.toISOString(),
    source: { id: r.sourceId, name: r.sourceName },
    categories: JSON.parse(r.categories) as string[],
    tags: JSON.parse(r.tags) as string[],
    priority: r.priority,
    paywalled: r.paywalled,
    _aiTagged: r.aiTagged || undefined,
    _hasTimestamp: r.hasTimestamp,
  }));
}

/**
 * Update only tags and aiTagged for specific articles by ID.
 * More efficient than persistArticles() which does a full upsert.
 */
export async function updateArticleTags(
  updates: { id: string; tags: string[] }[]
): Promise<void> {
  if (updates.length === 0) return;

  await prisma.$transaction(
    updates.map((u) =>
      prisma.article.update({
        where: { id: u.id },
        data: { tags: JSON.stringify(u.tags), aiTagged: true },
      })
    )
  );
}

/**
 * Delete all rows where expiresAt < now.
 */
export async function pruneExpiredArticles(): Promise<void> {
  await prisma.article.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
