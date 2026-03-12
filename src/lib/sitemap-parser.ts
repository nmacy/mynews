import { JSDOM } from "jsdom";
import { generateArticleId, stripHtml, truncate } from "./articles";
import { assignTags } from "./tagger";
import type { TagDefinition } from "@/config/tags";
import type { Article, Source } from "@/types";

const FETCH_TIMEOUT = 15_000;

/**
 * Parse a Google News Sitemap XML and return articles.
 * Expects <url> elements with <loc>, <news:title>, <news:publication_date>,
 * and optionally <image:loc>.
 */
export async function fetchSitemapSource(
  source: Source,
  extraTags?: TagDefinition[],
  skipKeywordTags?: boolean,
): Promise<Article[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  let xml: string;
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MyNewsBot/1.0)",
        Accept: "application/xml, text/xml, */*",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${source.url}`);
    xml = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const doc = dom.window.document;
  const urlElements = doc.querySelectorAll("url");

  const articles: Article[] = [];

  for (const urlEl of urlElements) {
    const loc = urlEl.querySelector("loc")?.textContent?.trim();
    if (!loc) continue;

    const title = stripHtml(
      urlEl.getElementsByTagName("news:title")[0]?.textContent ?? ""
    ).trim();
    if (!title) continue;

    const rawPubDate = urlEl.getElementsByTagName("news:publication_date")[0]?.textContent?.trim();
    const hasTimestamp = !!rawPubDate;
    const pubDate = rawPubDate ?? new Date().toISOString();

    const imageUrl =
      urlEl.getElementsByTagName("image:loc")[0]?.textContent?.trim() ?? null;

    const desc = truncate(title, 300);

    articles.push({
      id: generateArticleId(loc),
      title,
      description: desc,
      content: "",
      url: loc,
      imageUrl,
      publishedAt: pubDate,
      source: { id: source.id, name: source.name },
      categories: [],
      tags: skipKeywordTags ? [] : assignTags({ title, description: desc }, extraTags),
      priority: source.priority,
      paywalled: source.paywalled ?? false,
      _hasTimestamp: hasTimestamp,
    });
  }

  dom.window.close();
  return articles;
}
