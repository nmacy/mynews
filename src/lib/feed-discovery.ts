import { fetchHtml } from "./web-scraper";
import { validateRssFeed } from "./feeds";
import { isSafeUrl } from "./url-validation";

const COMMON_FEED_PATHS = [
  "/feed",
  "/rss",
  "/feed.xml",
  "/rss.xml",
  "/atom.xml",
  "/index.xml",
  "/feed/",
  "/rss/",
  "/feeds/posts/default",       // Blogger
  "/blog/rss.xml",
  "/blog/feed",
  "/?feed=rss2",                 // WordPress
];

const LINK_TAG_REGEX =
  /<link[^>]+rel=["']alternate["'][^>]*>/gi;

const TYPE_REGEX = /type=["']([^"']+)["']/i;
const HREF_REGEX = /href=["']([^"']+)["']/i;

const FEED_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/xml",
  "text/xml",
]);

function extractFeedLinksFromHtml(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const matches = html.match(LINK_TAG_REGEX);
  if (!matches) return urls;

  for (const tag of matches) {
    const typeMatch = tag.match(TYPE_REGEX);
    if (!typeMatch || !FEED_TYPES.has(typeMatch[1])) continue;

    const hrefMatch = tag.match(HREF_REGEX);
    if (!hrefMatch) continue;

    try {
      const resolved = new URL(hrefMatch[1], baseUrl).href;
      if (isSafeUrl(resolved)) urls.push(resolved);
    } catch {
      // skip invalid URLs
    }
  }

  return urls;
}

async function validateBatch(urls: string[]): Promise<string[]> {
  const valid: string[] = [];
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const result = await validateRssFeed(url);
      return { url, ...result };
    }),
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.valid) {
      valid.push(r.value.url);
    }
  }
  return valid;
}

/**
 * Discover RSS/Atom feed URLs for a given site.
 * 1. Fetch homepage HTML, look for <link rel="alternate"> feed tags
 * 2. If none found, probe common feed paths
 * Returns validated feed URLs.
 */
export async function discoverFeeds(siteUrl: string): Promise<string[]> {
  if (!isSafeUrl(siteUrl)) return [];

  let baseUrl: string;
  try {
    const parsed = new URL(siteUrl);
    baseUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {
    return [];
  }

  // Layer 1: Parse HTML for feed link tags
  try {
    const html = await fetchHtml(siteUrl);
    const linkFeeds = extractFeedLinksFromHtml(html, baseUrl);

    if (linkFeeds.length > 0) {
      // Validate in batch of up to 5
      const valid = await validateBatch(linkFeeds.slice(0, 5));
      if (valid.length > 0) return valid;
    }
  } catch {
    // Homepage fetch failed — fall through to path probing
  }

  // Layer 2: Probe common feed paths in batches of 5
  const probeUrls = COMMON_FEED_PATHS.map((path) => `${baseUrl}${path}`).filter(isSafeUrl);

  for (let i = 0; i < probeUrls.length; i += 5) {
    const batch = probeUrls.slice(i, i + 5);
    const valid = await validateBatch(batch);
    if (valid.length > 0) return valid;
  }

  return [];
}
