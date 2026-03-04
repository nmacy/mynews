import { NextRequest, NextResponse } from "next/server";
import { getAllArticles, getArticlesForSources, getSources } from "@/lib/feeds";
import type { Source } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sourceIdsParam = request.nextUrl.searchParams.get("sourceIds");
  const sourcesParam = request.nextUrl.searchParams.get("sources");

  let articles;

  if (sourcesParam) {
    // Accept full source objects as JSON (for custom user-added sources)
    try {
      const sources = JSON.parse(sourcesParam) as Source[];
      articles = await getArticlesForSources(sources);
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
