import Parser from "rss-parser";
import { getCached, setCache } from "./cache";
import { generateArticleId, stripHtml, truncate } from "./articles";
import { extractImageFromItem, extractOgImage } from "./image-extractor";
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
const OG_BATCH_LIMIT = 5; // limit concurrent OG requests

async function fetchSource(source: Source): Promise<Article[]> {
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

      articles.push({
        id: generateArticleId(link),
        title: item.title.trim(),
        description: truncate(description, 300),
        content: item["content:encoded"] ?? item.content ?? item.summary ?? "",
        url: link,
        imageUrl,
        publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
        source: { id: source.id, name: source.name },
        categories: source.categories,
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

async function tryFillOgImages(articles: Article[]): Promise<void> {
  const needImages = articles.filter((a) => !a.imageUrl).slice(0, OG_BATCH_LIMIT);
  const results = await Promise.allSettled(
    needImages.map(async (article) => {
      const ogImage = await extractOgImage(article.url);
      if (ogImage) article.imageUrl = ogImage;
    })
  );
  // results consumed for side effects only
  void results;
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

  // Best-effort OG image fill for top articles missing images
  await tryFillOgImages(unique);

  setCache(ALL_ARTICLES_KEY, unique);
  return unique;
}

export async function getArticlesByCategory(slug: string): Promise<Article[]> {
  const all = await getAllArticles();
  if (slug === "top-stories") {
    return all.filter((a) => a.categories.includes("top-stories"));
  }
  return all.filter((a) => a.categories.includes(slug));
}

export async function getArticleById(id: string): Promise<Article | null> {
  const all = await getAllArticles();
  return all.find((a) => a.id === id) ?? null;
}

export function getCategories() {
  return config.categories;
}

export function getSources() {
  return config.sources;
}

/**
 * Fetch articles only from the provided source list (for user-customized configs).
 * Does NOT use the shared cache — each unique source set gets fresh results.
 */
export async function getArticlesForSources(sources: Source[]): Promise<Article[]> {
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

  await tryFillOgImages(unique);
  return unique;
}
