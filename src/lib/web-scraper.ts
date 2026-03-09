import { JSDOM } from "jsdom";
import { generateArticleId, stripHtml, truncate } from "./articles";
import { assignTags } from "./tagger";
import { validateRssFeed } from "./feeds";
import { isSafeUrl } from "./url-validation";
import type { TagDefinition } from "@/config/tags";
import type { Article, Source, SourceType } from "@/types";

const FETCH_TIMEOUT = 15_000;
const MAX_ARTICLES = 50;
const MIN_LINK_TEXT_LENGTH = 10;
const MIN_PATH_DEPTH = 2;

const BLOCKLIST_PATHS = [
  "/tag/",
  "/tags/",
  "/category/",
  "/categories/",
  "/author/",
  "/authors/",
  "/login/",
  "/signin/",
  "/signup/",
  "/register/",
  "/about/",
  "/about-us/",
  "/contact/",
  "/privacy/",
  "/terms/",
  "/legal/",
  "/search/",
  "/page/",
  "/feed/",
  "/rss/",
  "/sitemap",
  "/wp-admin/",
  "/wp-login",
  "/cart/",
  "/checkout/",
  "/account/",
];

const NOISE_SELECTORS = [
  "nav",
  "footer",
  "header",
  "aside",
  "script",
  "style",
  "noscript",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
];

const DATE_REGEX =
  /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\w+ \d{1,2},?\s*\d{4})|(\d{1,2} \w+ \d{4})/;

function getPathDepth(url: URL): number {
  return url.pathname.replace(/\/$/, "").split("/").filter(Boolean).length;
}

function isBlocklisted(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return BLOCKLIST_PATHS.some((p) => lower.includes(p));
}

function isTrackingPixel(img: Element): boolean {
  const width = img.getAttribute("width");
  const height = img.getAttribute("height");
  if (width && height) {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    if (w <= 2 || h <= 2) return true;
  }
  return false;
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function findContainer(el: Element): Element {
  let current: Element | null = el.parentElement;
  const containerTags = new Set(["ARTICLE", "LI", "DIV", "SECTION"]);
  while (current) {
    if (containerTags.has(current.tagName)) return current;
    current = current.parentElement;
  }
  return el;
}

function extractTitle(link: Element, container: Element): string {
  const linkText = (link.textContent ?? "").trim();
  if (linkText.length >= MIN_LINK_TEXT_LENGTH) return linkText;

  // Try nearest heading in container
  const heading = container.querySelector("h1, h2, h3, h4, h5, h6");
  if (heading) {
    const headingText = (heading.textContent ?? "").trim();
    if (headingText.length > 0) return headingText;
  }

  return linkText;
}

function extractDate(container: Element): { date: string; hasTimestamp: boolean } {
  // Try <time> element first
  const timeEl = container.querySelector("time");
  if (timeEl) {
    const datetime = timeEl.getAttribute("datetime");
    if (datetime) {
      const parsed = new Date(datetime);
      if (!isNaN(parsed.getTime())) return { date: parsed.toISOString(), hasTimestamp: true };
    }
    const timeText = (timeEl.textContent ?? "").trim();
    if (timeText) {
      const parsed = new Date(timeText);
      if (!isNaN(parsed.getTime())) return { date: parsed.toISOString(), hasTimestamp: true };
    }
  }

  // Try date regex in container text
  const text = container.textContent ?? "";
  const match = text.match(DATE_REGEX);
  if (match) {
    const parsed = new Date(match[0]);
    if (!isNaN(parsed.getTime())) return { date: parsed.toISOString(), hasTimestamp: true };
  }

  return { date: new Date().toISOString(), hasTimestamp: false };
}

function extractImage(
  container: Element,
  baseUrl: string,
): string | null {
  const imgs = container.querySelectorAll("img");
  for (const img of imgs) {
    if (isTrackingPixel(img)) continue;
    const src = img.getAttribute("src") || img.getAttribute("data-src");
    if (src) {
      const resolved = resolveUrl(src, baseUrl);
      if (resolved) return resolved;
    }
  }
  return null;
}

function extractDescription(container: Element): string {
  const paragraphs = container.querySelectorAll("p");
  for (const p of paragraphs) {
    const text = (p.textContent ?? "").trim();
    if (text.length > 20) {
      return truncate(stripHtml(text), 300);
    }
  }
  return "";
}

interface ScrapedLink {
  url: string;
  title: string;
  date: string;
  hasTimestamp: boolean;
  imageUrl: string | null;
  description: string;
}

function scrapeLinks(html: string, baseUrl: string): ScrapedLink[] {
  const dom = new JSDOM(html, { url: baseUrl });
  const doc = dom.window.document;
  const base = new URL(baseUrl);

  // Remove noise elements
  for (const selector of NOISE_SELECTORS) {
    for (const el of doc.querySelectorAll(selector)) {
      el.remove();
    }
  }

  const anchors = doc.querySelectorAll("a[href]");
  const seen = new Set<string>();
  const results: ScrapedLink[] = [];

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");
    if (!href) continue;

    const resolved = resolveUrl(href, baseUrl);
    if (!resolved) continue;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(resolved);
    } catch {
      continue;
    }

    // Same-origin only
    if (parsedUrl.origin !== base.origin) continue;

    // Path depth check
    if (getPathDepth(parsedUrl) < MIN_PATH_DEPTH) continue;

    // Blocklist check
    if (isBlocklisted(parsedUrl.pathname)) continue;

    // Clean URL (remove hash, trailing slash for dedup)
    const cleanUrl = `${parsedUrl.origin}${parsedUrl.pathname.replace(/\/$/, "")}`;
    if (seen.has(cleanUrl)) continue;

    // Link text length check
    const linkText = (anchor.textContent ?? "").trim();
    if (linkText.length < MIN_LINK_TEXT_LENGTH) continue;

    seen.add(cleanUrl);

    const container = findContainer(anchor);
    const { date, hasTimestamp } = extractDate(container);
    results.push({
      url: cleanUrl,
      title: extractTitle(anchor, container),
      date,
      hasTimestamp,
      imageUrl: extractImage(container, baseUrl),
      description: extractDescription(container),
    });

    if (results.length >= MAX_ARTICLES) break;
  }

  dom.window.close();
  return results;
}

export async function fetchHtml(url: string, timeoutMs = FETCH_TIMEOUT): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWebSource(
  source: Source,
  extraTags?: TagDefinition[],
): Promise<Article[]> {
  const html = await fetchHtml(source.url);
  const links = scrapeLinks(html, source.url);

  return links.map((link) => {
    const title = link.title;
    const description = link.description;
    return {
      id: generateArticleId(link.url),
      title,
      description,
      content: "",
      url: link.url,
      imageUrl: link.imageUrl,
      publishedAt: link.date,
      source: { id: source.id, name: source.name },
      categories: [],
      tags: assignTags({ title, description }, extraTags),
      priority: source.priority,
      paywalled: source.paywalled ?? false,
      _hasTimestamp: link.hasTimestamp,
    };
  });
}

export async function validateWebSource(
  url: string,
  timeoutMs = FETCH_TIMEOUT,
): Promise<{ valid: boolean; itemCount: number }> {
  try {
    if (!isSafeUrl(url)) return { valid: false, itemCount: 0 };

    const html = await fetchHtml(url, timeoutMs);
    const links = scrapeLinks(html, url);
    return {
      valid: links.length >= 3,
      itemCount: links.length,
    };
  } catch {
    return { valid: false, itemCount: 0 };
  }
}

export async function detectSourceType(
  url: string,
  timeoutMs = 10_000,
): Promise<{ type: SourceType; valid: boolean; itemCount: number }> {
  // Try RSS first
  const rssResult = await validateRssFeed(url, timeoutMs);
  if (rssResult.valid) {
    return { type: "rss", ...rssResult };
  }

  // Fall back to web scraping
  const webResult = await validateWebSource(url, timeoutMs);
  if (webResult.valid) {
    return { type: "web", ...webResult };
  }

  return { type: "rss", valid: false, itemCount: 0 };
}
