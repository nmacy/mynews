import type { Article } from "@/types";

const KEY_PREFIX = "mynews-article-";

export function storeArticle(article: Article) {
  try {
    sessionStorage.setItem(KEY_PREFIX + article.id, JSON.stringify(article));
  } catch {
    // storage full or unavailable
  }
}

export function getStoredArticle(id: string): Article | null {
  try {
    const stored = sessionStorage.getItem(KEY_PREFIX + id);
    if (stored) return JSON.parse(stored) as Article;
  } catch {
    // ignore
  }
  return null;
}
