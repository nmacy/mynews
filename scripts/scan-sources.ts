/**
 * Scan all sources: fetch RSS feed, pick one article, test extraction.
 * Usage: npx tsx scripts/scan-sources.ts
 *
 * Requires dev server running on localhost:3001
 */

import Parser from "rss-parser";
import { SOURCE_LIBRARY } from "../src/config/source-library";

const BASE = "http://localhost:3001";
const DELAY_MS = 3500; // ~17 requests/min, under the 20/min rate limit
const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  },
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SourceResult {
  id: string;
  name: string;
  category: string;
  paywalled: boolean;
  feedOk: boolean;
  feedError?: string;
  articleUrl?: string;
  extractOk: boolean;
  extractError?: string;
  contentLength?: number;
  strategy?: string;
  title?: string;
}

async function testSource(
  source: (typeof SOURCE_LIBRARY)[number]
): Promise<SourceResult> {
  const result: SourceResult = {
    id: source.id,
    name: source.name,
    category: source.category,
    paywalled: !!source.paywalled,
    feedOk: false,
    extractOk: false,
  };

  // Skip web-type sources (no RSS feed)
  if (source.type === "web") {
    result.feedError = "web type (no RSS)";
    return result;
  }

  // Step 1: Fetch the RSS feed
  try {
    const feed = await parser.parseURL(source.url);
    const items = feed.items ?? [];
    if (items.length === 0) {
      result.feedError = "empty feed";
      return result;
    }
    result.feedOk = true;

    // Pick a recent article with a link
    const article = items.find((i) => i.link);
    if (!article?.link) {
      result.feedError = "no article links";
      return result;
    }
    result.articleUrl = article.link;
  } catch (err) {
    result.feedError = (err as Error).message?.slice(0, 100);
    return result;
  }

  // Step 2: Test extraction
  try {
    const res = await fetch(
      `${BASE}/api/article/extract?url=${encodeURIComponent(result.articleUrl!)}`,
      { signal: AbortSignal.timeout(60000) }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      result.extractError = `${res.status}: ${(body as Record<string, string>).error ?? res.statusText}`;
      return result;
    }

    const data = await res.json();
    if (data.error) {
      result.extractError = data.error;
      return result;
    }

    const textContent = (data.content ?? "")
      .replace(/<[^>]*>/g, "")
      .trim();
    result.extractOk = textContent.length >= 50;
    result.contentLength = textContent.length;
    result.title = data.title?.slice(0, 60);

    if (!result.extractOk) {
      result.extractError = `content too short (${textContent.length} chars)`;
    }
  } catch (err) {
    result.extractError = (err as Error).message?.slice(0, 100);
  }

  return result;
}

async function main() {
  console.log(`\nScanning ${SOURCE_LIBRARY.length} sources...\n`);

  // Process sources sequentially with delay to avoid rate limiting
  const results: SourceResult[] = [];

  // First pass: fetch all RSS feeds in parallel (no rate limit on feeds)
  console.log("Fetching RSS feeds...\n");
  const feedResults = await Promise.all(
    SOURCE_LIBRARY.map(async (source) => {
      if (source.type === "web" || source.type === "sitemap") {
        return { source, articleUrl: null, feedError: source.type === "web" ? "web type (no RSS)" : undefined, feedOk: false };
      }
      try {
        const feed = await parser.parseURL(source.url);
        const article = feed.items?.find((i) => i.link);
        if (!article?.link) {
          return { source, articleUrl: null, feedError: "no article links", feedOk: false };
        }
        return { source, articleUrl: article.link, feedOk: true };
      } catch (err) {
        return { source, articleUrl: null, feedError: (err as Error).message?.slice(0, 100), feedOk: false };
      }
    })
  );

  // Log feed failures immediately
  const feedFailures = feedResults.filter((f) => !f.feedOk);
  const feedSuccesses = feedResults.filter((f) => f.feedOk && f.articleUrl);
  console.log(`Feeds OK: ${feedSuccesses.length}, Feeds failed: ${feedFailures.length}\n`);
  for (const f of feedFailures) {
    const r: SourceResult = {
      id: f.source.id, name: f.source.name, category: f.source.category,
      paywalled: !!f.source.paywalled, feedOk: false, feedError: f.feedError, extractOk: false,
    };
    results.push(r);
    console.log(`⚠️  ${r.name.padEnd(25)} ${r.category.padEnd(15)} ${r.feedError}`);
  }

  // Second pass: test extraction sequentially with delay
  console.log(`\nTesting extraction for ${feedSuccesses.length} sources (with ${DELAY_MS}ms delay)...\n`);
  for (const f of feedSuccesses) {
    const r: SourceResult = {
      id: f.source.id, name: f.source.name, category: f.source.category,
      paywalled: !!f.source.paywalled, feedOk: true, articleUrl: f.articleUrl!, extractOk: false,
    };

    try {
      const res = await fetch(
        `${BASE}/api/article/extract?url=${encodeURIComponent(r.articleUrl!)}`,
        { signal: AbortSignal.timeout(60000) }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        r.extractError = `${res.status}: ${(body as Record<string, string>).error ?? res.statusText}`;
      } else {
        const data = await res.json();
        if (data.error) {
          r.extractError = data.error;
        } else {
          const textContent = (data.content ?? "").replace(/<[^>]*>/g, "").trim();
          r.extractOk = textContent.length >= 50;
          r.contentLength = textContent.length;
          r.title = data.title?.slice(0, 60);
          if (!r.extractOk) {
            r.extractError = `content too short (${textContent.length} chars)`;
          }
        }
      }
    } catch (err) {
      r.extractError = (err as Error).message?.slice(0, 100);
    }

    results.push(r);
    const icon = r.extractOk ? "✅" : "❌";
    const detail = r.extractOk
      ? `${r.contentLength} chars`
      : r.extractError ?? "unknown";
    console.log(`${icon} ${r.name.padEnd(25)} ${r.category.padEnd(15)} ${detail}`);

    await sleep(DELAY_MS);
  }

  // Summary
  const feedFailed = results.filter((r) => !r.feedOk);
  const extractFailed = results.filter((r) => r.feedOk && !r.extractOk);
  const extractOk = results.filter((r) => r.extractOk);

  console.log("\n" + "=".repeat(70));
  console.log(`RESULTS: ${results.length} sources scanned`);
  console.log(`  ✅ Extraction OK:     ${extractOk.length}`);
  console.log(`  ❌ Extraction Failed: ${extractFailed.length}`);
  console.log(`  ⚠️  Feed Failed:       ${feedFailed.length}`);

  if (extractFailed.length > 0) {
    console.log("\n--- Extraction Failures ---");
    for (const r of extractFailed) {
      console.log(`  ${r.name} (${r.id})`);
      console.log(`    URL: ${r.articleUrl}`);
      console.log(`    Error: ${r.extractError}`);
    }
  }

  if (feedFailed.length > 0) {
    console.log("\n--- Feed Failures ---");
    for (const r of feedFailed) {
      console.log(`  ${r.name} (${r.id}): ${r.feedError}`);
    }
  }
}

main().catch(console.error);
