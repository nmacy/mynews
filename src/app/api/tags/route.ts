import { NextResponse } from "next/server";
import { tagArticlesWithAi } from "@/lib/ai-tagger";
import type { AiProvider } from "@/types";

const VALID_PROVIDERS = new Set(["anthropic", "openai", "gemini", "openrouter"]);
const MAX_ARTICLES = 100;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { tags: {}, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { articles, provider, apiKey, model } = body as {
    articles?: unknown;
    provider?: string;
    apiKey?: string;
    model?: string;
  };

  if (!Array.isArray(articles) || articles.length === 0) {
    return NextResponse.json(
      { tags: {}, error: "articles must be a non-empty array" },
      { status: 400 }
    );
  }

  if (articles.length > MAX_ARTICLES) {
    return NextResponse.json(
      { tags: {}, error: `Maximum ${MAX_ARTICLES} articles per request` },
      { status: 400 }
    );
  }

  if (!provider || !VALID_PROVIDERS.has(provider)) {
    return NextResponse.json(
      { tags: {}, error: "Invalid provider" },
      { status: 400 }
    );
  }

  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json(
      { tags: {}, error: "API key is required" },
      { status: 400 }
    );
  }

  if (!model || typeof model !== "string") {
    return NextResponse.json(
      { tags: {}, error: "Model is required" },
      { status: 400 }
    );
  }

  const sanitized = articles.map((a: { id?: string; title?: string; description?: string }) => ({
    id: String(a.id ?? ""),
    title: String(a.title ?? ""),
    description: String(a.description ?? ""),
  }));

  try {
    const tags = await tagArticlesWithAi({
      articles: sanitized,
      provider: provider as AiProvider,
      apiKey,
      model,
    });
    return NextResponse.json({ tags });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI tagging failed";
    return NextResponse.json({ tags: {}, error: message });
  }
}
