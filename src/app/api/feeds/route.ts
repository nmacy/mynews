import { NextRequest, NextResponse } from "next/server";
import { getAllArticles, getArticlesForSources, getSources, getAllSourcesAcrossUsers, fetchSource, getFailedSources, allSettledWithLimit, RSS_CONCURRENCY, isAiTaggingEnabled } from "@/lib/feeds";
import { clearCache } from "@/lib/cache";
import { getRankingConfig } from "@/lib/server-config";
import { persistArticles, loadPersistedArticles } from "@/lib/article-db";
import { isSafeUrl } from "@/lib/url-validation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { tagArticlesWithAi } from "@/lib/ai-tagger";
import { assignTags } from "@/lib/tagger";
import { getAllTagDefinitions, getCustomTags } from "@/lib/custom-tags";
import type { Article, Source, AiProvider } from "@/types";

export const dynamic = "force-dynamic";

function isValidSource(s: unknown): s is Source {
  if (!s || typeof s !== "object") return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.id === "string" && obj.id.length <= 200 &&
    typeof obj.name === "string" && obj.name.length <= 200 &&
    typeof obj.url === "string" && isSafeUrl(obj.url) &&
    (obj.priority === undefined || typeof obj.priority === "number")
  );
}

export async function GET(request: NextRequest) {
  const sourceIdsParam = request.nextUrl.searchParams.get("sourceIds");
  const sourcesParam = request.nextUrl.searchParams.get("sources");
  const tagParam = request.nextUrl.searchParams.get("tag");

  let articles;
  let cacheKey: string;

  if (tagParam) {
    // Server-side tag filter — queries DB directly for articles with this tag.
    // Returns up to 500 most recent articles matching the tag across all sources.
    cacheKey = `articles:tag:${tagParam}`;
    const { loadArticlesByTag } = await import("@/lib/article-db");
    const { rankArticles } = await import("@/lib/ranker");
    const raw = await loadArticlesByTag(tagParam, 500);
    const rc = await getRankingConfig();
    articles = rc.enabled ? rankArticles(raw, rc, []) : raw;
  } else if (sourcesParam) {
    // Accept full source objects as JSON (for custom user-added sources)
    try {
      const parsed = JSON.parse(sourcesParam) as unknown[];
      const safeSources = (Array.isArray(parsed) ? parsed : []).filter(isValidSource);
      if (safeSources.length === 0) {
        return NextResponse.json({ error: "No valid source URLs" }, { status: 400 });
      }
      cacheKey = `articles:${safeSources.map((s) => s.id).sort().join(",")}`;
      articles = await getArticlesForSources(safeSources);
    } catch {
      return NextResponse.json({ error: "Invalid sources param" }, { status: 400 });
    }
  } else if (sourceIdsParam) {
    // Load articles from DB by source IDs. For single/few sources (e.g. source
    // page), load directly for full results. For many sources, cap at DB level
    // to avoid loading thousands of articles.
    const ids = sourceIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    cacheKey = `articles:${[...ids].sort().join(",")}`;
    const { loadPersistedArticles } = await import("@/lib/article-db");
    const { rankArticles } = await import("@/lib/ranker");
    const dbLimit = ids.length <= 5 ? undefined : 500;
    const raw = await loadPersistedArticles(ids, dbLimit);
    const rc = await getRankingConfig();
    articles = rc.enabled ? rankArticles(raw, rc, []) : raw;
  } else {
    cacheKey = "all-articles";
    articles = await getAllArticles();
  }

  const failedSources = getFailedSources(cacheKey);
  const rankingConfig = await getRankingConfig();

  console.log(`[feeds GET] Loaded ${articles.length} articles for cacheKey=${cacheKey.substring(0, 80)}`);

  // Strip content field — not used on home page, saves ~60% payload
  // Cap response to avoid multi-MB payloads that freeze the browser
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "0", 10);
  const maxArticles = limit > 0 ? limit : 500;
  const capped = articles.slice(0, maxArticles);
  const lightweight = capped.map(({ content, ...rest }) => ({ ...rest, content: "" }));

  return NextResponse.json({
    count: lightweight.length,
    total: articles.length,
    articles: lightweight,
    ...(failedSources.length > 0 ? { failedSources } : {}),
    ranking: rankingConfig,
  }, {
    headers: { "Cache-Control": "private, no-cache" },
  });
}

export async function POST(request: NextRequest) {
  // If the request has a JSON body with "sources", treat it as an article fetch
  // (used by the homepage to avoid URL length limits with many sources)
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();
      if (body.sources && Array.isArray(body.sources)) {
        const safeSources = (body.sources as unknown[]).filter(isValidSource);
        if (safeSources.length === 0) {
          return NextResponse.json({ error: "No valid source URLs" }, { status: 400 });
        }
        const cacheKey = `articles:${safeSources.map((s) => s.id).sort().join(",")}`;
        const articles = await getArticlesForSources(safeSources);
        const failedSources = getFailedSources(cacheKey);
        const postRankingConfig = await getRankingConfig();
        const postLimit = typeof body.limit === "number" && body.limit > 0 ? body.limit : 500;
        const postCapped = articles.slice(0, postLimit);
        const postLightweight = postCapped.map(({ content, ...rest }) => ({ ...rest, content: "" }));
        return NextResponse.json({
          count: postLightweight.length,
          total: articles.length,
          articles: postLightweight,
          ...(failedSources.length > 0 ? { failedSources } : {}),
          ranking: postRankingConfig,
        }, {
          headers: { "Cache-Control": "private, no-cache" },
        });
      }
    } catch {
      // Not valid JSON or no sources — fall through to admin rescan
    }
  }

  // Admin rescan flow
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  clearCache();

  // Gather ALL sources in use: server defaults + every user's configured sources
  const sources = await getAllSourcesAcrossUsers();
  const total = sources.length;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));

      const allArticles: Article[] = [];
      const customTags = await getCustomTags();
      const skipKeywordTags = await isAiTaggingEnabled();
      let completedCount = 0;

      const results = await allSettledWithLimit(
        sources.map((source) => async () => {
          const articles = await fetchSource(source, customTags, skipKeywordTags);
          completedCount++;
          send({ type: "progress", completed: completedCount, total, source: source.name });
          return articles;
        }),
        RSS_CONCURRENCY,
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          allArticles.push(...result.value);
        }
      }

      // Deduplicate fresh articles
      const seen = new Set<string>();
      const unique = allArticles.filter((a) => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
      });

      // Merge DB-only articles (rotated out of RSS but still persisted)
      try {
        const sourceIds = sources.map((s) => s.id);
        const persisted = await loadPersistedArticles(sourceIds);
        const rssUrls = new Set(unique.map((a) => a.url));
        const dbOnly = persisted.filter((a) => !rssUrls.has(a.url));
        // Re-apply keyword tags to DB-only articles (skip if AI tagging handles it)
        if (!skipKeywordTags) {
          for (const article of dbOnly) {
            article.tags = assignTags({ title: article.title, description: article.description }, customTags);
          }
        }
        unique.push(...dbOnly);
      } catch (err) {
        console.warn("[rescan] DB article merge failed:", err);
      }

      unique.sort((a, b) => {
        const aHasTs = a._hasTimestamp !== false;
        const bHasTs = b._hasTimestamp !== false;
        if (aHasTs !== bHasTs) return aHasTs ? -1 : 1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });

      // AI tagging pass (if enabled)
      let aiTagCount = 0;
      try {
        const stored = await prisma.serverApiKey.findFirst({ where: { enabled: true } });
        if (stored) {
          const apiKey = decrypt(stored.encryptedKey, stored.iv, stored.authTag);
          const allTagDefs = await getAllTagDefinitions();
          const allTags = allTagDefs.map((t) => ({ slug: t.slug, label: t.label }));
          const batchSize = 20;

          send({ type: "ai-tagging", total: unique.length });

          for (let i = 0; i < unique.length; i += batchSize) {
            const batch = unique.slice(i, i + batchSize);
            try {
              const tagMap = await tagArticlesWithAi({
                articles: batch.map((a) => ({ id: a.id, title: a.title, description: a.description })),
                allTags,
                provider: stored.provider as AiProvider,
                apiKey,
                model: stored.model,
              });
              for (const [id, result] of Object.entries(tagMap)) {
                const article = unique.find((a) => a.id === id);
                if (article) {
                  const merged = new Set([...(article.tags ?? []), ...result.tags]);
                  article.tags = Array.from(merged);
                  article.relevanceScore = result.score;
                  aiTagCount++;
                }
              }
            } catch (err) {
              console.warn(`[rescan] AI batch ${i / batchSize + 1} failed:`, err);
            }
            send({ type: "ai-progress", completed: Math.min(i + batchSize, unique.length), total: unique.length });
          }
        }
      } catch (err) {
        console.warn("[rescan] AI tagging skipped:", err);
      }

      try { await persistArticles(unique); } catch (err) {
        console.warn("[rescan] article persist failed:", err);
      }
      clearCache(); // Invalidate DB-read caches so next request picks up fresh data
      send({ type: "done", completed: total, total, count: unique.length, aiTagged: aiTagCount });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
