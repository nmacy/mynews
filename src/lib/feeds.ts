import Parser from "rss-parser";
import { getCached, setCache } from "./cache";
import { generateArticleId, stripHtml, truncate } from "./articles";
import { extractImageFromItem, extractOgImage } from "./image-extractor";
import { assignTags } from "./tagger";
import sourcesConfig from "@/config/sources.json";
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
const OG_CONCURRENCY = 10; // max concurrent OG requests

/** Track in-flight OG fill jobs so we don't double-trigger */
const ogFillInFlight = new Set<string>();

export async function fetchSource(source: Source): Promise<Article[]> {
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
        tags: assignTags({ title, description: desc }),
        priority: source.priority,
        paywalled: source.paywalled ?? false,
      });
    }

    return articles;
  } catch (error) {
    console.error(`Failed to fetch ${source.name} (${source.url}):`, error);
    return [];
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

  const results = await Promise.allSettled(
    config.sources.map((source) => fetchSource(source))
  );

  const articles: Article[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Sort by date, most recent first
  unique.sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  setCache(ALL_ARTICLES_KEY, unique);
  fillOgImagesInBackground(unique, ALL_ARTICLES_KEY);
  return unique;
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

  const results = await Promise.allSettled(
    sources.map((source) => fetchSource(source))
  );

  const articles: Article[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  // Sort by date, most recent first
  unique.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  setCache(cacheKey, unique);
  fillOgImagesInBackground(unique, cacheKey);
  return unique;
}
