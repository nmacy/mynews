import { NextRequest, NextResponse } from "next/server";
import { extract } from "@extractus/article-extractor";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { marked } from "marked";
import { isSafeUrl } from "@/lib/url-validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getCachedExtraction, setCachedExtraction } from "@/lib/extraction-cache";

export const dynamic = "force-dynamic";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

interface ExtractionResult {
  title: string | null;
  content: string;
  author: string | null;
  published: string | null;
  image: string | null;
  ttr: number | null;
}

/** CSS selectors commonly used for article body content, in priority order */
const CONTENT_SELECTORS = [
  "[itemprop='articleBody']",
  ".article-body",
  ".article__body",
  ".article-content",
  ".story-body",
  ".entry-content",
  ".caas-body",
  ".content-body",
  ".post-content",
];

/** Clean extracted HTML: remove non-content artifacts from all strategies */
function cleanExtractedHtml(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`);
  const doc = dom.window.document;
  const body = doc.body;

  // Pass 1 — Remove by selector
  const junkSelectors = [
    "nav", "aside", "footer", "header", "form", "button", "input", "select", "textarea",
    '[role="navigation"]', '[role="complementary"]', '[role="banner"]',
    '[role="dialog"]', '[role="alertdialog"]', '[role="status"]', '[role="alert"]',
    '[aria-live]', '[aria-hidden="true"]',
    "script", "style", "iframe", "svg", "noscript",
    "template", "video", "audio", "source", "track", "canvas",
    "time",
    ".ad", ".advertisement", ".sidebar",
    ".social-share", ".share-buttons", ".sharing",
    ".related-posts", ".related-articles", ".recommended",
    ".newsletter", ".subscribe", ".signup",
    ".comments", ".comment-section",
    ".author-bio", ".author-info", ".author-card",
    ".breadcrumb", ".breadcrumbs",
    ".paywall", ".image-credit", ".photo-credit",
  ];
  for (const el of body.querySelectorAll(junkSelectors.join(", "))) {
    el.remove();
  }

  // Pass 1b — Remove skip-to-content / skip-nav links
  for (const a of body.querySelectorAll("a[href^='#']")) {
    const text = a.textContent?.trim() ?? "";
    if (/skip\s+(to\s+)?(main\s+)?content/i.test(text) || /skip\s+nav/i.test(text)) {
      a.remove();
    }
  }

  // Pass 2 — Remove custom web components (hyphenated tag names like nyt-betamax)
  for (const el of body.querySelectorAll("*")) {
    if (!el.parentNode) continue;
    if (el.tagName.includes("-")) {
      el.remove();
    }
  }

  // Pass 3 — Remove by class/id pattern matching
  const junkPattern = /\b(ad[-_]|social|share|related|recommend|newsletter|subscribe|signup|comment|breadcrumb|sidebar|promo|popup|modal|widget|footer[-_]|nav[-_]|menu|paywall|truncat|optimistic)\b/i;
  for (const el of body.querySelectorAll("*")) {
    if (!el.parentNode) continue;
    const cn = el.className;
    const id = el.id;
    const testId = el.getAttribute("data-testid") ?? "";
    if (junkPattern.test(cn) || junkPattern.test(id) || junkPattern.test(testId)) {
      el.remove();
    }
  }

  // Pass 4 — Remove junk images
  const trackingDomains = /doubleclick|pixel|tracking|beacon|analytics/i;
  for (const img of body.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? "";
    const width = img.getAttribute("width");
    const height = img.getAttribute("height");
    if (
      !src ||
      trackingDomains.test(src) ||
      width === "1" || height === "1"
    ) {
      img.remove();
    }
  }

  // Pass 5 — Remove elements with junk text (ads, paywall CTAs, labels, follow prompts)
  const labelPattern = /^\s*(advertisements?|skip\s+ad(vertisement)?s?|video|image|credit)\s*$/i;
  const paywallPattern = /thank\s+you\s+for\s+your\s+patience|verify(ing)?\s+(your\s+)?access|already\s+a\s+subscriber|want\s+all\s+of\s+the\s+times|you\s+have\s+.{0,20}preview|checking\s+(your\s+)?access|full\s+article\s+.{0,20}will\s+load|sign\s+up\s+(for|to)\s+(free|full)|subscribe\s+(now|for\s+all)|unlock\s+(this|the\s+full)|free\s+(trial|article)|reader\s+mode\s+.{0,20}(exit|log\s*in)/i;
  const ctaPattern = /follow\s+(topics?|authors?|this\s+story)|see\s+more\s+like\s+this|personalized\s+homepage|receive\s+email\s+updates|get\s+the\s+.{0,30}newsletter|sign\s+up\s+for\s+.{0,30}newsletter|sent\s+(every|six|five|seven)\s+(day|week)|breakthroughs.*discoveries.*tips/i;
  for (const el of body.querySelectorAll("p, div, span, a, li")) {
    if (!el.parentNode) continue;
    const text = el.textContent?.trim() ?? "";
    if (!text) continue;
    if (labelPattern.test(text)) { el.remove(); continue; }
    if (text.length < 300 && paywallPattern.test(text)) { el.remove(); continue; }
    if (text.length < 300 && ctaPattern.test(text)) { el.remove(); }
  }

  // Pass 5b — Remove empty list items and lists that become empty
  for (const li of body.querySelectorAll("li")) {
    if (!li.parentNode) continue;
    if ((li.textContent?.trim() ?? "") === "" && !li.querySelector("img")) {
      li.remove();
    }
  }
  for (const list of body.querySelectorAll("ul, ol")) {
    if (!list.parentNode) continue;
    if (list.querySelectorAll("li").length === 0) {
      list.remove();
    }
  }

  // Pass 6 — Remove author byline blocks and metadata
  // Skip itemprop="articleBody" since that's the main content container
  for (const el of body.querySelectorAll("[itemprop]:not([itemprop='articleBody']), [rel='author']")) {
    if (!el.parentNode) continue;
    el.remove();
  }
  // Remove interactive role="button" spans (author popovers, follow buttons, etc.)
  for (const el of body.querySelectorAll('[role="button"]')) {
    if (!el.parentNode) continue;
    el.remove();
  }
  // Remove "By ..." / "Reporting from ..." / "is a (senior)? reporter/writer/editor" short paragraphs
  const bylinePattern = /^\s*(by\s|reporting\s+from\s|visuals?\s+by\s|photographs?\s+by\s|written\s+by\s|edited\s+by\s)/i;
  const authorBioPattern = /\bis\s+a\s+(senior\s+)?(reporter|writer|editor|correspondent|columnist|journalist)\b/i;
  for (const el of body.querySelectorAll("p, div, span")) {
    if (!el.parentNode) continue;
    const text = el.textContent?.trim() ?? "";
    if (!text) continue;
    if (text.length < 150 && bylinePattern.test(text)) { el.remove(); continue; }
    if (text.length < 300 && authorBioPattern.test(text)) { el.remove(); continue; }
    // Remove orphaned "by" fragments (leftover after author name removal)
    if (/^\s*by\s*$/i.test(text)) { el.remove(); }
  }

  // Pass 7 — Remove figcaptions that are just photo credits
  for (const el of body.querySelectorAll("figcaption")) {
    if (!el.parentNode) continue;
    const text = el.textContent?.trim() ?? "";
    if (/^credit/i.test(text) || /\bcredit\s*\.\.\./i.test(text)) {
      el.remove();
    }
  }

  // Pass 8 — Remove figures with no img (empty video/media placeholders)
  for (const el of body.querySelectorAll("figure")) {
    if (!el.parentNode) continue;
    if (!el.querySelector("img")) {
      el.remove();
    }
  }

  // Pass 9 — Remove empty containers (repeat until stable)
  const emptyTags = new Set(["DIV", "SPAN", "SECTION", "ARTICLE", "FIGURE"]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const el of body.querySelectorAll("div, span, section, article, figure")) {
      if (!el.parentNode) continue;
      if (
        emptyTags.has(el.tagName) &&
        !el.querySelector("img") &&
        (el.textContent?.trim() ?? "") === ""
      ) {
        el.remove();
        changed = true;
      }
    }
  }

  // Pass 10 — Strip class, id, style, and data-* attributes (source-site styling bleeds through)
  for (const el of body.querySelectorAll("*")) {
    el.removeAttribute("class");
    el.removeAttribute("id");
    el.removeAttribute("style");
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith("data-")) {
        el.removeAttribute(attr.name);
      }
    }
  }

  // Pass 11 — Deduplicate images (same src appearing multiple times)
  const seenSrcs = new Set<string>();
  for (const img of body.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? "";
    if (!src) continue;
    if (seenSrcs.has(src)) {
      img.remove();
    } else {
      seenSrcs.add(src);
    }
  }

  // Pass 12 — Deduplicate paragraphs (same text content appearing multiple times)
  const seenTexts = new Set<string>();
  for (const el of body.querySelectorAll("p, h1, h2, h3, h4, h5, h6")) {
    if (!el.parentNode) continue;
    const text = el.textContent?.trim() ?? "";
    if (text.length < 20) continue; // skip short fragments
    if (seenTexts.has(text)) {
      el.remove();
    } else {
      seenTexts.add(text);
    }
  }

  // Pass 13 — Remove small author avatar images (tiny width/height attributes or small srcset)
  for (const img of body.querySelectorAll("img")) {
    if (!img.parentNode) continue;
    const w = parseInt(img.getAttribute("width") ?? "0", 10);
    const h = parseInt(img.getAttribute("height") ?? "0", 10);
    if ((w > 0 && w <= 96) || (h > 0 && h <= 96)) {
      img.remove();
    }
  }

  return body.innerHTML;
}

/** Try @extractus/article-extractor with browser headers */
async function tryExtractus(url: string): Promise<ExtractionResult | null> {
  const article = await extract(url, {}, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (article?.content && article.content.length > 200) {
    return {
      title: article.title ?? null,
      content: article.content,
      author: article.author ?? null,
      published: article.published ?? null,
      image: article.image ?? null,
      ttr: article.ttr ?? null,
    };
  }
  return null;
}

/** Fetch HTML and try multiple DOM-based strategies, returning the best result */
async function tryDomStrategies(url: string): Promise<ExtractionResult | null> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!res.ok) return null;

  const html = await res.text();
  const candidates: ExtractionResult[] = [];

  // Parse HTML once — reuse for CSS selectors (Readability mutates DOM, so it needs its own)
  const sharedDom = new JSDOM(html, { url });

  // Strategy A: CSS selector extraction (merges all matching elements)
  try {
    const doc = sharedDom.window.document;

    for (const selector of CONTENT_SELECTORS) {
      const containers = doc.querySelectorAll(selector);
      if (containers.length === 0) continue;

      let merged = "";
      for (const container of containers) {
        merged += container.innerHTML.trim();
      }

      if (merged.length > 200) {
        const titleEl = doc.querySelector("h1");
        candidates.push({
          title: titleEl?.textContent?.trim() ?? null,
          content: merged,
          author: null,
          published: null,
          image: null,
          ttr: null,
        });
        break; // use first matching selector
      }
    }
  } catch {
    // selector extraction failed
  }

  // Strategy B: Mozilla Readability (needs its own DOM since it mutates)
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article?.content && article.content.length > 200) {
      candidates.push({
        title: article.title ?? null,
        content: article.content,
        author: article.byline ?? null,
        published: null,
        image: null,
        ttr: null,
      });
    }
  } catch {
    // readability failed
  }

  if (candidates.length === 0) return null;

  // Pick the longest result
  candidates.sort((a, b) => b.content.length - a.content.length);
  return candidates[0];
}

/** Try Google AMP cache for sites that have AMP versions */
async function tryAmpCache(url: string): Promise<ExtractionResult | null> {
  const parsed = new URL(url);
  const ampUrl = `https://cdn.ampproject.org/c/s/${parsed.host}${parsed.pathname}`;
  const res = await fetch(ampUrl, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(10000),
    redirect: "follow",
  });
  if (!res.ok) return null;

  const html = await res.text();
  const dom = new JSDOM(html, { url: ampUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article?.content && article.content.length > 200) {
    return {
      title: article.title ?? null,
      content: article.content,
      author: article.byline ?? null,
      published: null,
      image: null,
      ttr: null,
    };
  }
  return null;
}

/** Fallback: use Jina Reader API to extract JS-rendered pages */
async function tryJinaReader(url: string): Promise<ExtractionResult | null> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      Accept: "text/plain",
      "User-Agent": BROWSER_UA,
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;

  const markdown = await res.text();
  if (markdown.length < 100) return null;

  // Detect error/CAPTCHA responses from Jina
  if (/returned error \d{3}|requiring CAPTCHA|access denied|blocked/i.test(markdown)) return null;

  // Extract title from first markdown heading if present
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? null;

  // Convert markdown to HTML
  const html = await marked.parse(markdown);
  if (html.length < 100) return null;

  return {
    title,
    content: html,
    author: null,
    published: null,
    image: null,
    ttr: null,
  };
}

/** Fallback: fetch article from the Wayback Machine (Internet Archive) */
async function tryWaybackMachine(url: string): Promise<ExtractionResult | null> {
  // Check availability first
  const checkRes = await fetch(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
    { signal: AbortSignal.timeout(5000) }
  );
  if (!checkRes.ok) return null;

  const check = await checkRes.json();
  const snapshotUrl = check?.archived_snapshots?.closest?.url;
  if (!snapshotUrl || check.archived_snapshots.closest.status !== "200") return null;

  // Fetch the archived page and extract with Readability
  const res = await fetch(snapshotUrl, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!res.ok) return null;

  const html = await res.text();
  const dom = new JSDOM(html, { url: snapshotUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article?.content && article.content.length > 200) {
    return {
      title: article.title ?? null,
      content: article.content,
      author: article.byline ?? null,
      published: null,
      image: null,
      ttr: null,
    };
  }
  return null;
}

// 20 extractions per minute per IP
const EXTRACT_LIMIT = 20;
const EXTRACT_WINDOW_MS = 60 * 1000;

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`extract:${ip}`, EXTRACT_LIMIT, EXTRACT_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  if (!isSafeUrl(url)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }

  try {
    // Check extraction cache first
    const cached = await getCachedExtraction(url).catch(() => null);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Run extractus and DOM strategies in parallel, pick the best
    const [extractResult, domResult] = await Promise.all([
      tryExtractus(url).catch((err) => {
        console.warn("[extract] extractus failed:", (err as Error)?.message);
        return null;
      }),
      tryDomStrategies(url).catch((err) => {
        console.warn("[extract] DOM strategies failed:", (err as Error)?.message);
        return null;
      }),
    ]);

    // Collect all successful results and pick the longest content
    const results = [extractResult, domResult].filter(
      (r): r is ExtractionResult => r !== null
    );

    if (results.length > 0) {
      // Clean all candidates first, then pick the one with the most actual text
      // (raw HTML length is unreliable — sidebars with many links can be longer)
      const cleaned = results.map((r) => ({
        ...r,
        cleanedContent: cleanExtractedHtml(r.content),
      }));
      cleaned.sort((a, b) => {
        const aText = a.cleanedContent.replace(/<[^>]*>/g, "").trim().length;
        const bText = b.cleanedContent.replace(/<[^>]*>/g, "").trim().length;
        return bText - aText;
      });
      const best = cleaned[0];
      if (best.cleanedContent.replace(/<[^>]*>/g, "").trim().length >= 50) {
        const meta = extractResult ?? best;
        const result = {
          title: meta.title ?? best.title,
          content: best.cleanedContent,
          author: meta.author ?? best.author,
          published: meta.published ?? best.published,
          image: meta.image ?? best.image,
          ttr: meta.ttr ?? best.ttr,
        };
        setCachedExtraction(url, result).catch(() => {});
        return NextResponse.json(result);
      }
    }

    // Fallbacks: run AMP, Jina, and Wayback in parallel — use first success
    const fallbackResults = await Promise.allSettled([
      tryAmpCache(url),
      tryJinaReader(url),
      tryWaybackMachine(url),
    ]);
    for (const settled of fallbackResults) {
      if (settled.status !== "fulfilled" || !settled.value) continue;
      const cleaned = cleanExtractedHtml(settled.value.content);
      if (cleaned.replace(/<[^>]*>/g, "").trim().length >= 50) {
        const result = { ...settled.value, content: cleaned };
        setCachedExtraction(url, result).catch(() => {});
        return NextResponse.json(result);
      }
    }

    return NextResponse.json({ error: "Could not extract article" }, { status: 422 });
  } catch (error) {
    console.error("Article extraction failed:", error);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
