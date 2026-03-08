import { TAG_DEFINITIONS } from "@/config/tags";
import type { Keyword, TagDefinition } from "@/config/tags";

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

function compileDefs(defs: TagDefinition[]): CompiledTag[] {
  return defs.flatMap((tag) =>
    tag.keywords.map((kw) => ({
      slug: tag.slug,
      pattern: buildPattern(kw),
    }))
  );
}

const staticCompiledTags: CompiledTag[] = compileDefs(TAG_DEFINITIONS);

export function assignTags(
  article: { title: string; description: string },
  extraTags?: TagDefinition[],
): string[] {
  const text = `${article.title} ${article.description}`;
  const matched = new Set<string>();

  const compiled = extraTags && extraTags.length > 0
    ? [...staticCompiledTags, ...compileDefs(extraTags)]
    : staticCompiledTags;

  for (const { slug, pattern } of compiled) {
    if (matched.has(slug)) continue;
    if (pattern.test(text)) {
      matched.add(slug);
    }
  }

  return Array.from(matched);
}
