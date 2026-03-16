import { prisma } from "./prisma";
import { isSafeUrl } from "./url-validation";

const PROBE_CONCURRENCY = 5;
const PROBE_TIMEOUT_MS = 8000;
const BATCH_SIZE = 50;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Lightweight extraction probe: fetches the page and checks if the HTML
 * has enough article-like content (>500 chars in article selectors or body text).
 * Much faster than full extraction — no Readability, no fallback chain.
 */
async function probeUrl(url: string): Promise<boolean> {
  if (!isSafeUrl(url)) return false;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      redirect: "follow",
    });

    if (!res.ok) return false;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return false;

    // Read a limited amount to avoid downloading huge pages
    const reader = res.body?.getReader();
    if (!reader) return false;

    let html = "";
    const decoder = new TextDecoder();
    const MAX_BYTES = 200_000; // 200KB should be enough to find article content

    while (html.length < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});

    // Quick content check: look for article-like content markers
    // Strip scripts/styles first
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // If less than 500 chars of text content, likely paywalled/blocked
    return stripped.length >= 500;
  } catch {
    return false;
  }
}

/**
 * Probe a batch of article URLs and update their extractable status in the DB.
 * Only probes articles that haven't been tested yet (extractable IS NULL).
 */
export async function probeNewArticles(limit = BATCH_SIZE): Promise<number> {
  const articles = await prisma.$queryRawUnsafe<Array<{ url: string }>>(
    `SELECT url FROM Article
     WHERE extractable IS NULL AND expiresAt > datetime('now')
     ORDER BY publishedAt DESC
     LIMIT ?`,
    limit
  );

  if (articles.length === 0) return 0;

  let updated = 0;
  const urls = articles.map((a) => a.url);

  // Process in concurrent batches
  for (let i = 0; i < urls.length; i += PROBE_CONCURRENCY) {
    const batch = urls.slice(i, i + PROBE_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const extractable = await probeUrl(url);
        return { url, extractable };
      })
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { url, extractable } = result.value;
      try {
        await prisma.$executeRawUnsafe(
          "UPDATE Article SET extractable = ? WHERE url = ?",
          extractable ? 1 : 0,
          url
        );
        updated++;
      } catch {
        // Skip individual failures
      }
    }
  }

  return updated;
}
