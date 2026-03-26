import { prisma } from "./prisma";
import { getRetentionDays } from "./server-config";
import type { Article } from "@/types";

const BATCH_SIZE = 50; // 50 × 19 columns = 950 params, under SQLite's 999 limit
const SOURCE_ID_BATCH = 500; // Batch source IDs to stay under SQLite's 999 parameter limit

/** Select clause that excludes the heavy `content` column for list queries. */
const articleListSelect = {
  id: true, title: true, description: true, url: true, imageUrl: true,
  publishedAt: true, sourceId: true, sourceName: true, categories: true,
  tags: true, priority: true, paywalled: true, relevanceScore: true,
  extractable: true, aiTagged: true, hasTimestamp: true,
} as const;

export function safeJsonArray(str: string): string[] {
  try { return JSON.parse(str); } catch { return []; }
}

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
      placeholders.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
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
        a.relevanceScore ?? 5,
      );
    }

    const sql = `
      INSERT INTO Article (id, url, title, description, content, imageUrl, publishedAt, sourceId, sourceName, categories, tags, priority, paywalled, aiTagged, hasTimestamp, firstSeen, lastSeen, expiresAt, relevanceScore)
      VALUES ${placeholders.join(", ")}
      ON CONFLICT(url) DO UPDATE SET
        lastSeen = excluded.lastSeen,
        expiresAt = excluded.expiresAt,
        publishedAt = CASE WHEN excluded.hasTimestamp = 1 THEN excluded.publishedAt ELSE Article.publishedAt END,
        hasTimestamp = CASE WHEN excluded.hasTimestamp = 1 THEN 1 ELSE Article.hasTimestamp END,
        tags = CASE WHEN Article.aiTagged = 1 THEN Article.tags WHEN LENGTH(excluded.tags) > 4 THEN excluded.tags ELSE Article.tags END,
        imageUrl = CASE WHEN excluded.imageUrl IS NOT NULL THEN excluded.imageUrl ELSE Article.imageUrl END,
        aiTagged = CASE WHEN excluded.aiTagged = 1 THEN 1 ELSE Article.aiTagged END,
        relevanceScore = CASE WHEN excluded.relevanceScore != 5 THEN excluded.relevanceScore ELSE Article.relevanceScore END
    `;

    await prisma.$executeRawUnsafe(sql, ...values);
  }
}

/**
 * Load all non-expired articles matching the given source IDs,
 * sorted by publishedAt desc.
 */
export async function loadPersistedArticles(sourceIds: string[], limit?: number): Promise<Article[]> {
  if (sourceIds.length === 0) return [];

  // Batch source IDs to stay under SQLite's 999 bound-parameter limit
  if (sourceIds.length > SOURCE_ID_BATCH) {
    const allRows: Article[] = [];
    for (let i = 0; i < sourceIds.length; i += SOURCE_ID_BATCH) {
      const batch = sourceIds.slice(i, i + SOURCE_ID_BATCH);
      const rows = await prisma.article.findMany({
        select: articleListSelect,
        where: {
          sourceId: { in: batch },
          expiresAt: { gt: new Date() },
        },
        orderBy: { publishedAt: "desc" },
      });
      allRows.push(...rows.map(rowToArticle));
    }
    allRows.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return limit ? allRows.slice(0, limit) : allRows;
  }

  const rows = await prisma.article.findMany({
    select: articleListSelect,
    where: {
      sourceId: { in: sourceIds },
      expiresAt: { gt: new Date() },
    },
    orderBy: { publishedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  return rows.map(rowToArticle);
}

function rowToArticle(r: {
  id: string; title: string; description: string; content?: string;
  url: string; imageUrl: string | null; publishedAt: Date;
  sourceId: string; sourceName: string; categories: string; tags: string;
  priority: number; paywalled: boolean; relevanceScore: number;
  extractable: boolean | null; aiTagged: boolean; hasTimestamp: boolean;
}): Article {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    content: r.content ?? "",
    url: r.url,
    imageUrl: r.imageUrl,
    publishedAt: r.publishedAt.toISOString(),
    source: { id: r.sourceId, name: r.sourceName },
    categories: safeJsonArray(r.categories),
    tags: safeJsonArray(r.tags),
    priority: r.priority,
    paywalled: r.paywalled,
    relevanceScore: r.relevanceScore,
    _extractable: r.extractable,
    _aiTagged: r.aiTagged ? true : undefined,
    _hasTimestamp: r.hasTimestamp,
  };
}

/**
 * Update the extractable status for an article by URL.
 */
export async function setArticleExtractable(url: string, extractable: boolean): Promise<void> {
  await prisma.$executeRawUnsafe(
    "UPDATE Article SET extractable = ? WHERE url = ?",
    extractable ? 1 : 0,
    url
  );
}

/**
 * Load non-expired articles that contain a specific tag, across all sources.
 * Uses SQL LIKE on the JSON tags column for server-side filtering.
 */
export async function loadArticlesByTag(tag: string, limit = 500): Promise<Article[]> {
  // Validate tag slug to prevent SQL injection — only allow alphanumeric + hyphens
  if (!/^[a-z0-9-]+$/.test(tag)) return [];

  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string; title: string; description: string;
    url: string; imageUrl: string | null; publishedAt: string;
    sourceId: string; sourceName: string; categories: string; tags: string;
    priority: number; paywalled: number; relevanceScore: number;
    extractable: number | null; aiTagged: number; hasTimestamp: number;
  }>>(
    `SELECT id, title, description, url, imageUrl, publishedAt,
            sourceId, sourceName, categories, tags, priority, paywalled,
            relevanceScore, extractable, aiTagged, hasTimestamp
     FROM Article
     WHERE expiresAt > datetime('now')
       AND tags LIKE ?
     ORDER BY publishedAt DESC
     LIMIT ?`,
    `%"${tag}"%`,
    limit
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    content: "",
    url: r.url,
    imageUrl: r.imageUrl,
    publishedAt: r.publishedAt,
    source: { id: r.sourceId, name: r.sourceName },
    categories: safeJsonArray(r.categories),
    tags: safeJsonArray(r.tags),
    priority: r.priority,
    paywalled: !!r.paywalled,
    relevanceScore: r.relevanceScore,
    _extractable: r.extractable === null ? null : !!r.extractable,
    _aiTagged: r.aiTagged ? true : undefined,
    _hasTimestamp: !!r.hasTimestamp,
  }));
}

/**
 * Batch-update imageUrl for articles by URL.
 * Used to persist OG images discovered in background.
 */
export async function updateArticleImages(
  updates: { url: string; imageUrl: string }[]
): Promise<void> {
  if (updates.length === 0) return;

  await prisma.$transaction(
    updates.map((u) =>
      prisma.article.updateMany({
        where: { url: u.url },
        data: { imageUrl: u.imageUrl },
      })
    )
  );
}

/**
 * Update tags, aiTagged, and optionally relevanceScore for specific articles by ID.
 * Uses batched raw SQL with CASE/WHEN for performance.
 */
export async function updateArticleAiData(
  updates: { id: string; tags: string[]; relevanceScore?: number }[]
): Promise<void> {
  if (updates.length === 0) return;

  // Batch to stay well under SQLite's 999 parameter limit.
  // Each article uses 3 params (id for CASE, tags value, relevanceScore value) + 1 for IN list.
  const AI_DATA_BATCH = 200;

  for (let i = 0; i < updates.length; i += AI_DATA_BATCH) {
    const batch = updates.slice(i, i + AI_DATA_BATCH);
    const ids = batch.map((u) => u.id);
    const tagsCases = batch.map(() => "WHEN id = ? THEN ?").join(" ");
    const scoreCases = batch.map(() => "WHEN id = ? THEN ?").join(" ");
    const placeholders = ids.map(() => "?").join(", ");

    const params: unknown[] = [];
    // tags CASE params
    for (const u of batch) {
      params.push(u.id, JSON.stringify(u.tags));
    }
    // relevanceScore CASE params
    for (const u of batch) {
      params.push(u.id, u.relevanceScore ?? 5);
    }
    // IN clause params
    params.push(...ids);

    await prisma.$executeRawUnsafe(
      `UPDATE Article SET
        tags = CASE ${tagsCases} ELSE tags END,
        aiTagged = 1,
        relevanceScore = CASE ${scoreCases} ELSE relevanceScore END
      WHERE id IN (${placeholders})`,
      ...params
    );
  }
}


/**
 * Look up a single article by ID directly from the database.
 */
export async function getArticleByIdFromDb(id: string): Promise<Article | null> {
  const row = await prisma.article.findUnique({ where: { id } });
  if (!row) return null;
  return rowToArticle(row as Parameters<typeof rowToArticle>[0]);
}

/**
 * Delete all rows where expiresAt < now.
 */
export async function pruneExpiredArticles(): Promise<void> {
  await prisma.article.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}
