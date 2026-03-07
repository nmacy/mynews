import { NextRequest, NextResponse } from "next/server";
import { getAllArticles, getArticlesForSources, getSources, fetchSource, getFailedSources } from "@/lib/feeds";
import { clearCache, setCache } from "@/lib/cache";
import { persistArticles } from "@/lib/article-db";
import { isSafeUrl } from "@/lib/url-validation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { tagArticlesWithAi } from "@/lib/ai-tagger";
import { getAllTagDefinitions, getCustomTags } from "@/lib/custom-tags";
import type { Article, Source, AiProvider } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sourceIdsParam = request.nextUrl.searchParams.get("sourceIds");
  const sourcesParam = request.nextUrl.searchParams.get("sources");

  let articles;
  let cacheKey: string;

  if (sourcesParam) {
    // Accept full source objects as JSON (for custom user-added sources)
    try {
      const sources = JSON.parse(sourcesParam) as Source[];
      const safeSources = sources.filter((s) => isSafeUrl(s.url));
      if (safeSources.length === 0) {
        return NextResponse.json({ error: "No valid source URLs" }, { status: 400 });
      }
      cacheKey = `articles:${safeSources.map((s) => s.id).sort().join(",")}`;
      articles = await getArticlesForSources(safeSources);
    } catch {
      return NextResponse.json({ error: "Invalid sources param" }, { status: 400 });
    }
  } else if (sourceIdsParam) {
    // Filter default sources by ID
    const ids = new Set(sourceIdsParam.split(",").map((s) => s.trim()));
    const allSources = await getSources();
    const filtered = allSources.filter((s) => ids.has(s.id));
    cacheKey = `articles:${filtered.map((s) => s.id).sort().join(",")}`;
    articles = await getArticlesForSources(filtered);
  } else {
    cacheKey = "all-articles";
    articles = await getAllArticles();
  }

  const failedSources = getFailedSources(cacheKey);

  return NextResponse.json({
    count: articles.length,
    articles,
    ...(failedSources.length > 0 ? { failedSources } : {}),
  });
}

export async function POST() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  clearCache();
  const sources = await getSources();
  const total = sources.length;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));

      const allArticles: Article[] = [];
      const customTags = await getCustomTags();

      for (let i = 0; i < total; i++) {
        const source = sources[i];
        send({ type: "progress", completed: i, total, source: source.name });
        const articles = await fetchSource(source, customTags);
        allArticles.push(...articles);
      }

      // Deduplicate
      const seen = new Set<string>();
      const unique = allArticles.filter((a) => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
      });
      unique.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

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
              for (const [id, tags] of Object.entries(tagMap)) {
                const article = unique.find((a) => a.id === id);
                if (article) {
                  const merged = new Set([...(article.tags ?? []), ...tags]);
                  article.tags = Array.from(merged);
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
      setCache("all-articles", unique);
      send({ type: "done", completed: total, total, count: unique.length, aiTagged: aiTagCount });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
