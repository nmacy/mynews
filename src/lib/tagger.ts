import { TAG_DEFINITIONS } from "@/config/tags";

const MAX_TAGS = 3;

interface CompiledTag {
  slug: string;
  pattern: RegExp;
}

const compiledTags: CompiledTag[] = TAG_DEFINITIONS.flatMap((tag) =>
  tag.keywords.map((kw) => ({
    slug: tag.slug,
    pattern: new RegExp(
      `\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      kw.length <= 2 ? "" : "i"
    ),
  }))
);

export function assignTags(article: {
  title: string;
  description: string;
}): string[] {
  const text = `${article.title} ${article.description}`;
  const matched = new Set<string>();

  for (const { slug, pattern } of compiledTags) {
    if (matched.size >= MAX_TAGS) break;
    if (matched.has(slug)) continue;
    if (pattern.test(text)) {
      matched.add(slug);
    }
  }

  return Array.from(matched);
}
