import { NextRequest, NextResponse } from "next/server";
import { extract } from "@extractus/article-extractor";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const article = await extract(url, {}, { signal: AbortSignal.timeout(15000) });
    if (!article || !article.content) {
      return NextResponse.json({ error: "Could not extract article" }, { status: 422 });
    }

    return NextResponse.json({
      title: article.title ?? null,
      content: article.content,
      author: article.author ?? null,
      published: article.published ?? null,
      image: article.image ?? null,
      ttr: article.ttr ?? null,
    });
  } catch (error) {
    console.error("Article extraction failed:", error);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
