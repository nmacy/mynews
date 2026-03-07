import Parser from "rss-parser";
import { getCached, setCache } from "./cache";
import { generateArticleId, stripHtml, truncate } from "./articles";
import { extractImageFromItem, extractOgImage } from "./image-extractor";
import { assignTags } from "./tagger";
import { getCustomTags } from "./custom-tags";
import { persistArticles, loadPersistedArticles, pruneExpiredArticles } from "./article-db";
import type { TagDefinition } from "@/config/tags";
import sourcesConfig from "@/config/sources.json";
import { fetchWebSource } from "./web-scraper";
import type { Article, Source, SourcesConfig } from "@/types";

const config = sourcesConfig as SourcesConfig;
const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "media:content", { keepArray: false }],
      ["media:thumbnail", "media:thumbnail", { keepArray: false }],
      ["media:group", "media:group", { keepArray: false }],
      ["content:encoded", "content:encoded"],
    ],
  },
  timeout: 10000,
});

const ALL_ARTICLES_KEY = "all-articles";
const FAILED_SOURCES_KEY = "failed-sources";
const OG_CONCURRENCY = 10; // max concurrent OG requests

/** Track in-flight OG fill jobs so we don't double-trigger */
const ogFillInFlight = new Set<string>();

/** Validate that a URL serves a parseable RSS/Atom feed. */
export async function validateRssFeed(
  url: string,
  timeoutMs = 5000,
): Promise<{ valid: boolean; itemCount: number }> {
  try {
    const result = await Promise.race([
      parser.parseURL(url).then((feed) => ({
        valid: feed.items.length > 0,
        itemCount: feed.items.length,
      })),
      new Promise<{ valid: false; itemCount: 0 }>((resolve) =>
        setTimeout(() => resolve({ valid: false, itemCount: 0 }), timeoutMs)
      ),
    ]);
    return result;
  } catch {
    return { valid: false, itemCount: 0 };
  }
}

export interface FailedSource {
  name: string;
  url: string;
  reason: string;
}

export function getFailedSources(cacheKey: string): FailedSource[] {
  return getCached<FailedSource[]>(`${FAILED_SOURCES_KEY}:${cacheKey}`) ?? [];
}

export async function fetchSource(
  source: Source,
  extraTags?: TagDefinition[],
): Promise<Article[]> {
  if (source.type === "web") return fetchWebSource(source, extraTags);

  try {
    const feed = await parser.parseURL(source.url);
    const articles: Article[] = [];

    for (const item of feed.items) {
      const link = typeof item.link === "string" ? item.link.trim() : "";
      if (!item.title || !link || !link.startsWith("http")) continue;

      const imageUrl = extractImageFromItem(item);
      const description = stripHtml(
        item.contentSnippet ?? item.content ?? item.summary ?? ""
      );

      const title = item.title.trim();
      const desc = truncate(description, 300);

      articles.push({
        id: generateArticleId(link),
        title,
        description: desc,
        content: item["content:encoded"] ?? item.content ?? item.summary ?? "",
        url: link,
        imageUrl,
        publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
        source: { id: source.id, name: source.name },
        categories: [],
        tags: assignTags({ title, description: desc }, extraTags),
        priority: source.priority,
        paywalled: source.paywalled ?? false,
      });
    }

    return articles;
  } catch (error) {
    console.error(`Failed to fetch ${source.name} (${source.url}):`, error);
    throw error;
  }
}

/**
 * Fill missing OG images in the background and update the cache when done.
 * Non-blocking — the caller returns articles immediately.
 */
function fillOgImagesInBackground(articles: Article[], cacheKey: string): void {
  const needImages = articles.filter((a) => !a.imageUrl);
  if (needImages.length === 0 || ogFillInFlight.has(cacheKey)) return;

  ogFillInFlight.add(cacheKey);

  (async () => {
    for (let i = 0; i < needImages.length; i += OG_CONCURRENCY) {
      const batch = needImages.slice(i, i + OG_CONCURRENCY);
      await Promise.allSettled(
        batch.map(async (article) => {
          const ogImage = await extractOgImage(article.url);
          if (ogImage) article.imageUrl = ogImage;
        })
      );
    }
    // Update cache with images filled in (articles array was mutated)
    setCache(cacheKey, articles);
    ogFillInFlight.delete(cacheKey);
  })().catch(() => {
    ogFillInFlight.delete(cacheKey);
  });
}

export async function getAllArticles(): Promise<Article[]> {
  const cached = getCached<Article[]>(ALL_ARTICLES_KEY);
  if (cached) return cached;

  const customTags = await getCustomTags();

  const results = await Promise.allSettled(
    config.sources.map((source) => fetchSource(source, customTags))
  );

  const articles: Article[] = [];
  const failed: FailedSource[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    } else {
      const source = config.sources[i];
      failed.push({
        name: source.name,
        url: source.url,
        reason: result.reason instanceof Error ? result.reason.message : "Failed to fetch",
      });
    }
  }

  if (failed.length > 0) {
    setCache(`${FAILED_SOURCES_KEY}:${ALL_ARTICLES_KEY}`, failed);
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Persist fresh articles to DB, then load full 7-day set
  let final = unique;
  try {
    const sourceIds = config.sources.map((s) => s.id);
    await persistArticles(unique);
    final = await loadPersistedArticles(sourceIds);
    pruneExpiredArticles().catch(() => {});
  } catch (err) {
    console.warn("[article-db] DB persist/load failed, using RSS-only results:", err);
  }

  // Sort by date, most recent first
  final.sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  setCache(ALL_ARTICLES_KEY, final);
  fillOgImagesInBackground(final, ALL_ARTICLES_KEY);

  return final;
}

export async function getArticleById(id: string): Promise<Article | null> {
  const all = await getAllArticles();
  return all.find((a) => a.id === id) ?? null;
}

export function getSources() {
  return config.sources;
}

/**
 * Fetch articles only from the provided source list (for user-customized configs).
 * Caches by a key derived from the sorted source IDs.
 */
export async function getArticlesForSources(sources: Source[]): Promise<Article[]> {
  const cacheKey = `articles:${sources.map((s) => s.id).sort().join(",")}`;
  const cached = getCached<Article[]>(cacheKey);
  if (cached) return cached;

  const customTags = await getCustomTags();

  const results = await Promise.allSettled(
    sources.map((source) => fetchSource(source, customTags))
  );

  const articles: Article[] = [];
  const failed: FailedSource[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    } else {
      const source = sources[i];
      failed.push({
        name: source.name,
        url: source.url,
        reason: result.reason instanceof Error ? result.reason.message : "Failed to fetch",
      });
    }
  }

  if (failed.length > 0) {
    setCache(`${FAILED_SOURCES_KEY}:${cacheKey}`, failed);
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Persist fresh articles to DB, then load full 7-day set
  let final = unique;
  try {
    const sourceIds = sources.map((s) => s.id);
    await persistArticles(unique);
    final = await loadPersistedArticles(sourceIds);
    pruneExpiredArticles().catch(() => {});
  } catch (err) {
    console.warn("[article-db] DB persist/load failed, using RSS-only results:", err);
  }

  // Sort by date, most recent first
  final.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  setCache(cacheKey, final);
  fillOgImagesInBackground(final, cacheKey);

  return final;
}
