import { NextRequest, NextResponse } from "next/server";
import { extract } from "@extractus/article-extractor";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

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
  ".post-content",
  ".article-body",
  ".article-content",
  ".entry-content",
  ".story-body",
  "[itemprop='articleBody']",
  ".caas-body",
  ".article__body",
  ".content-body",
];

/** Strip non-content elements from a cloned container */
function stripNonContent(el: Element) {
  const remove = el.querySelectorAll(
    "script, style, nav, aside, .ad, .ad-wrapper, .sidebar, " +
    ".social-share, .related-posts, .newsletter, .comments, " +
    "figure figcaption, .image-credit"
  );
  for (const r of remove) r.remove();
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

  // Strategy A: CSS selector extraction (merges all matching elements)
  try {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    for (const selector of CONTENT_SELECTORS) {
      const containers = doc.querySelectorAll(selector);
      if (containers.length === 0) continue;

      let merged = "";
      for (const container of containers) {
        const clone = container.cloneNode(true) as Element;
        stripNonContent(clone);
        merged += clone.innerHTML.trim();
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

  // Strategy B: Mozilla Readability
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

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    // Run extractus and DOM strategies in parallel, pick the best
    const [extractResult, domResult] = await Promise.all([
      tryExtractus(url).catch(() => null),
      tryDomStrategies(url).catch(() => null),
    ]);

    // Collect all successful results and pick the longest content
    const results = [extractResult, domResult].filter(
      (r): r is ExtractionResult => r !== null
    );

    if (results.length > 0) {
      results.sort((a, b) => b.content.length - a.content.length);
      const best = results[0];
      // Merge metadata from extractus if it had richer fields
      const meta = extractResult ?? best;
      return NextResponse.json({
        title: meta.title ?? best.title,
        content: best.content,
        author: meta.author ?? best.author,
        published: meta.published ?? best.published,
        image: meta.image ?? best.image,
        ttr: meta.ttr ?? best.ttr,
      });
    }

    // Fallback: Google AMP cache
    const ampResult = await tryAmpCache(url).catch(() => null);
    if (ampResult) {
      return NextResponse.json(ampResult);
    }

    return NextResponse.json({ error: "Could not extract article" }, { status: 422 });
  } catch (error) {
    console.error("Article extraction failed:", error);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
