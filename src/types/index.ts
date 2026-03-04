export interface Category {
  slug: string;
  name: string;
  color: string;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  categories: string[];
  priority: number;
  paywalled?: boolean;
}

export interface SourcesConfig {
  categories: Category[];
  sources: Source[];
}

export interface UserConfig {
  categories: Category[];
  sources: Source[];
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
  /** Debug flag — true when tags came from AI, false/undefined for keyword tags */
  _aiTagged?: boolean;
}

export type AiProvider = "anthropic" | "openai" | "gemini" | "openrouter";

export interface AiTaggerConfig {
  enabled: boolean;
  provider: AiProvider;
  apiKey: string;
  model: string;
}
