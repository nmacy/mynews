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
  priority: number;
  paywalled: boolean;
}
