import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { tagArticlesWithAi } from "@/lib/ai-tagger";
import { discoverNewTags } from "@/lib/ai-tag-discovery";
import { getAllTagDefinitions, getNextAvailableColor } from "@/lib/custom-tags";
import { updateArticleAiData } from "@/lib/article-db";
import { setCache } from "@/lib/cache";
import type { Article, AiProvider } from "@/types";

const AI_TAG_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const TAG_DISCOVERY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_UNTAGGED_PER_RUN = 40;
const BATCH_SIZE = 20;

let lastAiTagRun = 0;
let lastDiscoveryRun = 0;
let aiTaggingInProgress = false;

interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

async function getAiConfig(): Promise<AiConfig | null> {
  try {
    const row = await prisma.serverApiKey.findFirst({
      where: { enabled: true },
    });
    if (!row) return null;

    const apiKey = decrypt(row.encryptedKey, row.iv, row.authTag);
    return {
      provider: row.provider as AiProvider,
      apiKey,
      model: row.model,
    };
  } catch (err) {
    console.warn("[auto-tagger] Failed to load AI config:", err);
    return null;
  }
}

export async function autoTagArticles(articles: Article[]): Promise<void> {
  const now = Date.now();
  if (now - lastAiTagRun < AI_TAG_COOLDOWN_MS) return;
  if (aiTaggingInProgress) return;

  const config = await getAiConfig();
  if (!config) return;

  const untagged = articles
    .filter((a) => !a._aiTagged)
    .slice(0, MAX_UNTAGGED_PER_RUN);

  if (untagged.length === 0) {
    console.log("[auto-tagger] No untagged articles, skipping");
    lastAiTagRun = now;
    return;
  }

  aiTaggingInProgress = true;
  lastAiTagRun = now;
  console.log(`[auto-tagger] Tagging ${untagged.length} articles with AI`);

  const allTags = await getAllTagDefinitions();
  const tagList = allTags.map((t) => ({ slug: t.slug, label: t.label }));
  const pendingMutations = new Map<string, { tags: string[]; score: number }>();

  for (let i = 0; i < untagged.length; i += BATCH_SIZE) {
    const batch = untagged.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const tagMap = await tagArticlesWithAi({
        articles: batch.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
        })),
        allTags: tagList,
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
      });

      let tagged = 0;
      for (const article of batch) {
        const result = tagMap[article.id];
        if (result && result.tags.length > 0) {
          const merged = Array.from(new Set([...article.tags, ...result.tags]));
          pendingMutations.set(article.id, { tags: merged, score: result.score });
          tagged++;
        }
      }

      console.log(`[auto-tagger] Batch ${batchNum}: tagged ${tagged} articles`);
    } catch (err) {
      console.warn(`[auto-tagger] Batch ${batchNum} failed:`, err);
    }
  }

  // Persist tag updates to DB first, then apply to in-memory articles
  if (pendingMutations.size > 0) {
    const dbUpdates = Array.from(pendingMutations, ([id, { tags, score }]) => ({
      id,
      tags,
      relevanceScore: score,
    }));
    try {
      await updateArticleAiData(dbUpdates);

      // DB succeeded — now apply mutations to in-memory articles and update cache
      for (const article of articles) {
        const mutation = pendingMutations.get(article.id);
        if (mutation) {
          article.tags = mutation.tags;
          article.relevanceScore = mutation.score;
          article._aiTagged = true;
        }
      }
      setCache("all-articles", articles);
    } catch (err) {
      console.warn("[auto-tagger] DB persist failed, skipping in-memory update:", err);
    }
  }

  aiTaggingInProgress = false;
}

export async function autoDiscoverTags(articles: Article[]): Promise<void> {
  const now = Date.now();
  if (now - lastDiscoveryRun < TAG_DISCOVERY_COOLDOWN_MS) return;

  const config = await getAiConfig();
  if (!config) return;

  lastDiscoveryRun = now;
  console.log("[auto-tagger] Running tag discovery");

  const existingTags = await getAllTagDefinitions();
  const sample = articles.slice(0, 20);

  const suggestions = await discoverNewTags({
    articles: sample.map((a) => ({ title: a.title, description: a.description })),
    existingTags: existingTags.map((t) => ({ slug: t.slug, label: t.label })),
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
  });

  if (suggestions.length === 0) {
    console.log("[auto-tagger] No new tags discovered");
    return;
  }

  const existingCustom = await prisma.customTag.findMany();
  const usedColors = new Set(existingCustom.map((t) => t.color));

  for (const tag of suggestions) {
    try {
      const color = getNextAvailableColor(usedColors);
      await prisma.customTag.create({
        data: {
          slug: tag.slug,
          label: tag.label,
          color,
        },
      });
      usedColors.add(color);
      console.log(`[auto-tagger] Created new tag: ${tag.slug} (${tag.label}) — ${tag.reason}`);
    } catch (err) {
      // Unique constraint violation is harmless (tag already exists)
      console.warn(`[auto-tagger] Failed to create tag "${tag.slug}":`, err);
    }
  }
}
