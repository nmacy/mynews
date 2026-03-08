import { prisma } from "./prisma";
import type { Article } from "@/types";

const RETENTION_DAYS = 14;

function expiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + RETENTION_DAYS);
  return d;
}

/**
 * Bulk upsert articles into SQLite.
 * Uses `url` as the unique key. On conflict, refreshes lastSeen/expiresAt
 * and updates tags/imageUrl if the new data is better.
 */
export async function persistArticles(articles: Article[]): Promise<void> {
  if (articles.length === 0) return;

  const exp = expiresAt();

  await prisma.$transaction(
    articles.map((a) =>
      prisma.article.upsert({
        where: { url: a.url },
        create: {
          id: a.id,
          url: a.url,
          title: a.title,
          description: a.description,
          content: a.content,
          imageUrl: a.imageUrl,
          publishedAt: new Date(a.publishedAt),
          sourceId: a.source.id,
          sourceName: a.source.name,
          categories: JSON.stringify(a.categories ?? []),
          tags: JSON.stringify(a.tags ?? []),
          priority: a.priority,
          paywalled: a.paywalled,
          aiTagged: a._aiTagged ?? false,
          expiresAt: exp,
        },
        update: {
          lastSeen: new Date(),
          expiresAt: exp,
          ...(a.tags && a.tags.length > 0 ? { tags: JSON.stringify(a.tags) } : {}),
          ...(a.imageUrl ? { imageUrl: a.imageUrl } : {}),
          ...(a._aiTagged ? { aiTagged: true } : {}),
        },
      })
    )
  );
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
