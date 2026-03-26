import { NextRequest, NextResponse } from "next/server";
import { getAllArticles, getArticlesForSources, getAllSourcesAcrossUsers, fetchSource, getFailedSources, allSettledWithLimit, RSS_CONCURRENCY, isAiTaggingEnabled, sortArticles, deduplicateByUrl } from "@/lib/feeds";
import { clearCache } from "@/lib/cache";
import { getRankingConfig } from "@/lib/server-config";
import { persistArticles } from "@/lib/article-db";
import { isSafeUrl } from "@/lib/url-validation";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { tagArticlesWithAi } from "@/lib/ai-tagger";
import { assignTags } from "@/lib/tagger";
import { getAllTagDefinitions, getCustomTags } from "@/lib/custom-tags";
import { AI_PROVIDERS } from "@/types";
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

function computeETag(articles: Article[], count: number): string {
  // Lightweight ETag: count + newest article ID + oldest article ID
  const first = articles[0];
  const last = articles[count - 1];
  const key = `${count}:${first?.id ?? ""}:${first?.publishedAt ?? ""}:${last?.id ?? ""}`;
  // Simple hash using string char codes
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return `"${(hash >>> 0).toString(36)}"`;
}

function buildArticleResponse(
  articles: Article[],
  maxArticles: number,
  failedSources: { name: string; url: string; reason: string }[],
  ranking: unknown,
  request?: NextRequest,
) {
  const capped = articles.slice(0, maxArticles);
  const lightweight = capped.map(({ content: _content, ...rest }) => ({ ...rest, content: "" }));

  const etag = computeETag(articles, lightweight.length);

  // Return 304 if client already has this version
  if (request) {
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
        },
      });
    }
  }

  return NextResponse.json({
    count: lightweight.length,
    total: articles.length,
    articles: lightweight,
    ...(failedSources.length > 0 ? { failedSources } : {}),
    ranking,
  }, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      ETag: etag,
    },
  });
}

export async function GET(request: NextRequest) {
  const sourceIdsParam = request.nextUrl.searchParams.get("sourceIds");
  const sourcesParam = request.nextUrl.searchParams.get("sources");
  const tagParam = request.nextUrl.searchParams.get("tag");

  let articles;
  let cacheKey: string;

  if (tagParam) {
    // Validate tag slug — only allow alphanumeric + hyphens
    if (!/^[a-z0-9-]+$/.test(tagParam)) {
      return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
    }
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
    if (ids.length > 200) {
      return NextResponse.json({ error: "Too many source IDs (max 200)" }, { status: 400 });
    }
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

  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "0", 10);
  const maxArticles = limit > 0 ? limit : 500;
  return buildArticleResponse(articles, maxArticles, failedSources, rankingConfig, request);
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
        return buildArticleResponse(articles, postLimit, failedSources, postRankingConfig, request);
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    // JSON body parsed but had no sources array — return error, don't fall through to admin rescan
    return NextResponse.json({ error: "Missing sources array in request body" }, { status: 400 });
  }

  // Admin rescan flow
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  clearCache();

  // Gather ALL sources in use: server defaults + every user's configured sources
  const sources = await getAllSourcesAcrossUsers();
  const total = sources.length;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));

      try {
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
      const unique = deduplicateByUrl(allArticles);

      // Merge DB-only articles (rotated out of RSS but still persisted)
      try {
        const sourceIds = sources.map((s) => s.id);
        const { loadPersistedArticles: loadPersisted } = await import("@/lib/article-db");
        const persisted = await loadPersisted(sourceIds);
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

      sortArticles(unique);

      // AI tagging pass (if enabled) — only tag articles that haven't been AI-tagged yet
      let aiTagCount = 0;
      try {
        const stored = await prisma.serverApiKey.findFirst({ where: { enabled: true } });
        if (stored) {
          const apiKey = decrypt(stored.encryptedKey, stored.iv, stored.authTag);
          const allTagDefs = await getAllTagDefinitions();
          const allTags = allTagDefs.map((t) => ({ slug: t.slug, label: t.label }));
          const batchSize = 20;

          const untagged = unique.filter((a) => !a._aiTagged);
          send({ type: "ai-tagging", total: untagged.length });

          for (let i = 0; i < untagged.length; i += batchSize) {
            const batch = untagged.slice(i, i + batchSize);
            try {
              const tagMap = await tagArticlesWithAi({
                articles: batch.map((a) => ({ id: a.id, title: a.title, description: a.description })),
                allTags,
                provider: (AI_PROVIDERS as readonly string[]).includes(stored.provider) ? stored.provider as AiProvider : "anthropic",
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
            send({ type: "ai-progress", completed: Math.min(i + batchSize, untagged.length), total: untagged.length });
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
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Rescan failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
