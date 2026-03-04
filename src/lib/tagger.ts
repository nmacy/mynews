import { TAG_DEFINITIONS, TAG_MAP } from "@/config/tags";
import type { Keyword } from "@/config/tags";

interface CompiledTag {
  slug: string;
  pattern: RegExp;
}

function buildPattern(kw: Keyword): RegExp {
  const term = typeof kw === "string" ? kw : kw.term;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (typeof kw !== "string" && kw.caseSensitive) {
    return new RegExp(`\\b${escaped}\\b`);
  }
  // Default: case-sensitive for <=2 chars, insensitive otherwise
  return new RegExp(`\\b${escaped}\\b`, term.length <= 2 ? "" : "i");
}

const compiledTags: CompiledTag[] = TAG_DEFINITIONS.flatMap((tag) =>
  tag.keywords.map((kw) => ({
    slug: tag.slug,
    pattern: buildPattern(kw),
  }))
);

function addWithParents(matched: Set<string>, slug: string) {
  let current: string | undefined = slug;
  while (current && !matched.has(current)) {
    matched.add(current);
    current = TAG_MAP.get(current)?.parent;
  }
}

export function assignTags(article: {
  title: string;
  description: string;
}): string[] {
  const text = `${article.title} ${article.description}`;
  const matched = new Set<string>();

  for (const { slug, pattern } of compiledTags) {
    if (matched.has(slug)) continue;
    if (pattern.test(text)) {
      addWithParents(matched, slug);
    }
  }

  return Array.from(matched);
}
