export type SourceType = "rss" | "web" | "sitemap";

export interface Source {
  id: string;
  name: string;
  url: string;
  priority: number;
  paywalled?: boolean;
  type?: SourceType;
}

export interface LibrarySource extends Source {
  category: string;
}

export interface UserConfig {
  sources: Source[];
  featuredTags?: string[];
  sourceBarOrder?: string[];
}

export interface Article {
  id: string;
  title: string;
  description: string;
  content: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  source: {
    id: string;
    name: string;
  };
  categories: string[];
  tags: string[];
  priority: number;
  paywalled: boolean;
  relevanceScore: number;
  /** Debug flag — true when tags came from AI, false/undefined for keyword tags */
  _aiTagged?: boolean;
  /** Whether the source provided a real timestamp (false = we used pull time) */
  _hasTimestamp?: boolean;
  /** Whether this article can be fully extracted (null = untested) */
  _extractable?: boolean | null;
  /** Computed rank score (transient, not persisted) */
  _rankScore?: number;
  /** Number of deduplicated similar articles (transient) */
  _dedupCount?: number;
}

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

export const AI_PROVIDERS = ["anthropic", "openai", "gemini", "openrouter"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];
