import type { Item } from "rss-parser";
import { isSafeUrl } from "./url-validation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeedItem = Item & { [key: string]: any };

function isValidImageUrl(url: unknown): url is string {
  return typeof url === "string" && url.length > 0 && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/"));
}

export function extractImageFromItem(item: FeedItem): string | null {
  // Strategy 1: media:content
  const mediaContent =
    item["media:content"]?.$ ??
    item["media:group"]?.["media:content"]?.[0]?.$ ??
    item["media:content"]?.$;
  if (isValidImageUrl(mediaContent?.url)) return mediaContent.url;

  // Strategy 2: media:thumbnail
  const mediaThumbnail =
    item["media:thumbnail"]?.$ ?? item["media:thumbnail"];
  if (isValidImageUrl(mediaThumbnail?.url)) return mediaThumbnail.url;

  // Strategy 3: enclosure with image MIME type
  if (isValidImageUrl(item.enclosure?.url)) {
    if (item.enclosure.type?.startsWith("image/")) {
      return item.enclosure.url;
    }
    if (/\.(jpg|jpeg|png|gif|webp)/i.test(item.enclosure.url)) {
      return item.enclosure.url;
    }
  }

  // Strategy 4: First <img> in content
  const contentHtml =
    item["content:encoded"] ?? item.content ?? item.summary ?? "";
  const imgMatch = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1] && isValidImageUrl(imgMatch[1])) return imgMatch[1];

  return null;
}

export async function extractOgImage(articleUrl: string): Promise<string | null> {
  if (!articleUrl || !articleUrl.startsWith("http")) return null;
  if (!isSafeUrl(articleUrl)) return null;
  try {
    const ogs = (await import("open-graph-scraper")).default;
    const { result } = await ogs({
      url: articleUrl,
      timeout: 3000,
      fetchOptions: {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MyNewsBot/1.0)",
        },
      },
    });
    if (result.ogImage && result.ogImage.length > 0) {
      return result.ogImage[0].url;
    }
  } catch {
    // Silently fail — OG scraping is a best-effort fallback
  }
  return null;
}
