import Parser from "rss-parser";
import { getCachedWithStatus, setCache, isRefreshing, markRefreshing, unmarkRefreshing } from "./cache";
import { generateArticleId, stripHtml, truncate, decodeHtmlEntities } from "./articles";
import { extractImageFromItem, extractOgImage } from "./image-extractor";
import { assignTags } from "./tagger";
import { getCustomTags } from "./custom-tags";
import { persistArticles, loadPersistedArticles, pruneExpiredArticles } from "./article-db";
import type { TagDefinition } from "@/config/tags";
import sourcesConfig from "@/config/sources.json";
import { fetchWebSource } from "./web-scraper";
import { fetchSitemapSource } from "./sitemap-parser";
import { prisma } from "./prisma";
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
export const RSS_CONCURRENCY = 10; // max concurrent RSS fetches

/** Track in-flight OG fill jobs so we don't double-trigger */
const ogFillInFlight = new Set<string>();

/**
 * Worker-pool style concurrency limiter for Promise.allSettled.
 * Takes an array of thunk functions (not already-started promises).
 */
export async function allSettledWithLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

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
  const status = getCachedWithStatus<FailedSource[]>(`${FAILED_SOURCES_KEY}:${cacheKey}`);
  return status?.data ?? [];
}

export async function fetchSource(
  source: Source,
  extraTags?: TagDefinition[],
): Promise<Article[]> {
  if (source.type === "web") return fetchWebSource(source, extraTags);
  if (source.type === "sitemap") return fetchSitemapSource(source, extraTags);

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

      const title = decodeHtmlEntities(item.title.trim());
      const desc = truncate(description, 300);
      const hasTimestamp = !!(item.isoDate || item.pubDate);

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
        _hasTimestamp: hasTimestamp,
      });
    }

    // Log timestamp analysis per source
    const withTs = articles.filter((a) => a._hasTimestamp).length;
    if (withTs < articles.length) {
      console.log(
        `[feeds] ${source.name}: ${withTs}/${articles.length} items have real timestamps (${articles.length - withTs} using pull time)`
      );
    }

    return articles;
  } catch (rssError) {
    // RSS parsing failed — try sitemap as fallback (but NOT web scraping,
    // which produces phantom articles from inline content links)
    try {
      const articles = await fetchSitemapSource(source, extraTags);
      if (articles.length > 0) {
        console.log(`[feeds] ${source.name}: RSS failed, sitemap fallback succeeded (${articles.length} articles)`);
        return articles;
      }
    } catch {
      // sitemap also failed
    }

    console.error(`Failed to fetch ${source.name} (${source.url}):`, rssError);
    throw rssError;
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

/**
 * Core fetch+deduplicate logic shared by getAllArticles and getArticlesForSources.
 * Returns deduplicated, sorted articles merged with DB history.
 */
async function refreshArticles(
  sources: Source[],
  cacheKey: string,
): Promise<Article[]> {
  const customTags = await getCustomTags();

  const results = await allSettledWithLimit(
    sources.map((source) => () => fetchSource(source, customTags)),
    RSS_CONCURRENCY,
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

  // Fire-and-forget DB persist
  persistArticles(unique).catch((err) => {
    console.warn("[article-db] Background persist failed:", err);
  });
  pruneExpiredArticles().catch(() => {});

  // Load persisted articles for historical data, merge with fresh
  let final = unique;
  try {
    const sourceIds = sources.map((s) => s.id);
    const persisted = await loadPersistedArticles(sourceIds);

    // For articles without real timestamps, use stable DB publishedAt
    // instead of fresh new Date() from this refresh cycle
    const dbMap = new Map(persisted.map((a) => [a.url, a]));
    for (const article of unique) {
      if (article._hasTimestamp === false) {
        const dbArticle = dbMap.get(article.url);
        if (dbArticle) {
          article.publishedAt = dbArticle.publishedAt;
        }
      }
    }

    const rssUrls = new Set(unique.map((a) => a.url));
    const dbOnly = persisted.filter((a) => !rssUrls.has(a.url));
    final = [...unique, ...dbOnly];
  } catch (err) {
    console.warn("[article-db] DB load failed, using RSS-only results:", err);
  }

  // Sort by date, most recent first.
  // Articles without real timestamps sort after those with real timestamps
  // to prevent them from jumping to the top on every refresh.
  final.sort((a, b) => {
    const aHasTs = a._hasTimestamp !== false;
    const bHasTs = b._hasTimestamp !== false;
    if (aHasTs !== bHasTs) return aHasTs ? -1 : 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  setCache(cacheKey, final);
  fillOgImagesInBackground(final, cacheKey);

  return final;
}

/**
 * Background refresh that doesn't block callers.
 */
function triggerBackgroundRefresh(sources: Source[], cacheKey: string): void {
  markRefreshing(cacheKey);
  refreshArticles(sources, cacheKey)
    .catch((err) => console.warn("[feeds] Background refresh failed:", err))
    .finally(() => unmarkRefreshing(cacheKey));
}

export async function getAllArticles(): Promise<Article[]> {
  const status = getCachedWithStatus<Article[]>(ALL_ARTICLES_KEY);

  if (status && !status.stale) {
    // Fresh cache — return immediately
    return status.data;
  }

  const sources = await getSources();

  if (status && status.stale) {
    // Stale cache — return stale data, trigger background refresh if not already running
    if (!isRefreshing(ALL_ARTICLES_KEY)) {
      triggerBackgroundRefresh(sources, ALL_ARTICLES_KEY);
    }
    return status.data;
  }

  // Cache miss — synchronous refresh
  return refreshArticles(sources, ALL_ARTICLES_KEY);
}

export async function getArticleById(id: string): Promise<Article | null> {
  const all = await getAllArticles();
  return all.find((a) => a.id === id) ?? null;
}

export async function getSources(): Promise<Source[]> {
  try {
    const row = await prisma.serverDefaultSources.findUnique({
      where: { key: "default" },
    });
    if (row) {
      const sources = JSON.parse(row.sources) as Source[];
      if (sources.length > 0) return sources;
    }
  } catch {
    // fall through to static defaults
  }
  return config.sources;
}

/**
 * Fetch articles only from the provided source list (for user-customized configs).
 * Caches by a key derived from the sorted source IDs.
 * Uses stale-while-revalidate: stale data returned instantly while refreshing in background.
 */
export async function getArticlesForSources(sources: Source[]): Promise<Article[]> {
  const cacheKey = `articles:${sources.map((s) => s.id).sort().join(",")}`;
  const status = getCachedWithStatus<Article[]>(cacheKey);

  if (status && !status.stale) {
    // Fresh cache — return immediately
    return status.data;
  }

  if (status && status.stale) {
    // Stale cache — return stale data, trigger background refresh if not already running
    if (!isRefreshing(cacheKey)) {
      triggerBackgroundRefresh(sources, cacheKey);
    }
    return status.data;
  }

  // Cache miss — synchronous refresh
  return refreshArticles(sources, cacheKey);
}
