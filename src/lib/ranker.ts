import type { Article } from "@/types";

export interface RankingConfig {
  enabled: boolean;
  layerAiScore: boolean;
  layerSourcePriority: boolean;
  layerTagInterest: boolean;
  layerTimeDecay: boolean;
  layerDedup: boolean;
  timeDecayGravity: number;
  debugScores: boolean;
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  enabled: false,
  layerAiScore: true,
  layerSourcePriority: true,
  layerTagInterest: true,
  layerTimeDecay: true,
  layerDedup: true,
  timeDecayGravity: 1.2,
  debugScores: false,
};

// Layer 2: source priority → multiplier
function sourcePriorityWeight(priority: number): number {
  if (priority === 0) return 1.5;
  if (priority === 1) return 1.2;
  return 1.0;
}

// Layer 3: tag interest boost
function tagInterestBoost(articleTags: string[], featuredTags: string[]): number {
  if (featuredTags.length === 0) return 1.0;
  const hasMatch = articleTags.some((t) => featuredTags.includes(t));
  return hasMatch ? 1.3 : 1.0;
}

// Layer 4: time decay
function timeDecay(ageHours: number, gravity: number): number {
  return Math.pow(ageHours + 2, gravity);
}

// Layer 5: title similarity for deduplication
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^\w\s]/g, "").trim();
}

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  const maxSize = Math.max(wordsA.size, wordsB.size);
  return overlap / maxSize;
}

export function deduplicateArticles(articles: Article[]): Article[] {
  const normalized = articles.map((a) => ({
    article: a,
    norm: normalizeTitle(a.title),
  }));

  const used = new Set<number>();
  const result: Article[] = [];

  for (let i = 0; i < normalized.length; i++) {
    if (used.has(i)) continue;

    let representative = normalized[i];
    let dupCount = 0;

    for (let j = i + 1; j < normalized.length; j++) {
      if (used.has(j)) continue;
      if (wordOverlap(representative.norm, normalized[j].norm) > 0.7) {
        used.add(j);
        dupCount++;
        // Prefer extractable articles; break ties by rank score
        const cur = representative.article;
        const cand = normalized[j].article;
        const curExtractable = cur._extractable !== false;
        const candExtractable = cand._extractable !== false;
        if (
          (candExtractable && !curExtractable) ||
          (candExtractable === curExtractable && (cand._rankScore ?? 0) > (cur._rankScore ?? 0))
        ) {
          representative = normalized[j];
        }
      }
    }

    representative.article._dedupCount = dupCount > 0 ? dupCount : undefined;
    result.push(representative.article);
  }

  return result;
}

export function rankArticles(
  articles: Article[],
  config: RankingConfig,
  userFeaturedTags: string[] = []
): Article[] {
  if (!config.enabled) return articles;

  const now = Date.now();

  for (const article of articles) {
    // Layer 1: AI relevance score (1-10)
    let score = config.layerAiScore ? article.relevanceScore : 5;

    // Layer 2: source priority weight
    if (config.layerSourcePriority) {
      score *= sourcePriorityWeight(article.priority);
    }

    // Layer 3: tag interest boost (only if featuredTags provided)
    if (config.layerTagInterest && userFeaturedTags.length > 0) {
      score *= tagInterestBoost(article.tags, userFeaturedTags);
    }

    // Layer 4: time decay
    if (config.layerTimeDecay) {
      const ageMs = now - new Date(article.publishedAt).getTime();
      const ageHours = Math.max(0, ageMs / (1000 * 60 * 60));
      score = score / timeDecay(ageHours, config.timeDecayGravity);
    }

    // Layer 4b: extraction penalty — demote articles known to fail extraction.
    // Paywalled articles with unknown extraction status get a lighter penalty.
    if (article._extractable === false) {
      score *= 0.5;
    } else if (article._extractable === null && article.paywalled) {
      score *= 0.7;
    }

    article._rankScore = score;
  }

  // Sort by rank score descending
  articles.sort((a, b) => (b._rankScore ?? 0) - (a._rankScore ?? 0));

  // Layer 5: deduplication
  if (config.layerDedup) {
    return deduplicateArticles(articles);
  }

  return articles;
}
