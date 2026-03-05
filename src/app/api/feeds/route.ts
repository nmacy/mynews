import { NextRequest, NextResponse } from "next/server";
import { getAllArticles, getArticlesForSources, getSources, fetchSource } from "@/lib/feeds";
import { clearCache, setCache } from "@/lib/cache";
import { extractOgImage } from "@/lib/image-extractor";
import { isSafeUrl } from "@/lib/url-validation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import type { Article, Source } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sourceIdsParam = request.nextUrl.searchParams.get("sourceIds");
  const sourcesParam = request.nextUrl.searchParams.get("sources");

  let articles;

  if (sourcesParam) {
    // Accept full source objects as JSON (for custom user-added sources)
    try {
      const sources = JSON.parse(sourcesParam) as Source[];
      const safeSources = sources.filter((s) => isSafeUrl(s.url));
      if (safeSources.length === 0) {
        return NextResponse.json({ error: "No valid source URLs" }, { status: 400 });
      }
      articles = await getArticlesForSources(safeSources);
    } catch {
      return NextResponse.json({ error: "Invalid sources param" }, { status: 400 });
    }
  } else if (sourceIdsParam) {
    // Filter default sources by ID
    const ids = new Set(sourceIdsParam.split(",").map((s) => s.trim()));
    const filtered = getSources().filter((s) => ids.has(s.id));
    articles = await getArticlesForSources(filtered);
  } else {
    articles = await getAllArticles();
  }

  return NextResponse.json({
    count: articles.length,
    articles,
  });
}

export async function POST() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  clearCache();
  const sources = getSources();
  const total = sources.length;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));

      const allArticles: Article[] = [];

      for (let i = 0; i < total; i++) {
        const source = sources[i];
        send({ type: "progress", completed: i, total, source: source.name });
        const articles = await fetchSource(source);
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

      // Best-effort OG image fill
      const needImages = unique.filter((a) => !a.imageUrl).slice(0, 5);
      await Promise.allSettled(
        needImages.map(async (article) => {
          const img = await extractOgImage(article.url);
          if (img) article.imageUrl = img;
        })
      );

      setCache("all-articles", unique);
      send({ type: "done", completed: total, total, count: unique.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
