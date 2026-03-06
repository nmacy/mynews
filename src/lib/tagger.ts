import { TAG_DEFINITIONS, TAG_MAP } from "@/config/tags";
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

function addWithParents(matched: Set<string>, slug: string, tagMap: Map<string, TagDefinition>) {
  let current: string | undefined = slug;
  while (current && !matched.has(current)) {
    matched.add(current);
    current = tagMap.get(current)?.parent;
  }
}

export function assignTags(
  article: { title: string; description: string },
  extraTags?: TagDefinition[],
): string[] {
  const text = `${article.title} ${article.description}`;
  const matched = new Set<string>();

  const compiled = extraTags && extraTags.length > 0
    ? [...staticCompiledTags, ...compileDefs(extraTags)]
    : staticCompiledTags;

  const tagMap = extraTags && extraTags.length > 0
    ? new Map([...TAG_MAP.entries(), ...extraTags.map((t) => [t.slug, t] as const)])
    : TAG_MAP;

  for (const { slug, pattern } of compiled) {
    if (matched.has(slug)) continue;
    if (pattern.test(text)) {
      addWithParents(matched, slug, tagMap);
    }
  }

  return Array.from(matched);
}
