import { NextResponse } from "next/server";
import { tagArticlesWithAi } from "@/lib/ai-tagger";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAllTagDefinitions } from "@/lib/custom-tags";
import type { AiProvider } from "@/types";

const VALID_PROVIDERS = new Set(["anthropic", "openai", "gemini", "openrouter"]);
const MAX_ARTICLES = 100;

// 10 tagging requests per minute per user
const TAG_LIMIT = 10;
const TAG_WINDOW_MS = 60 * 1000;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { tags: {}, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const rl = checkRateLimit(`tags:${session.user.id}`, TAG_LIMIT, TAG_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { tags: {}, error: "Too many requests" },
      { status: 429 }
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { tags: {}, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { articles, provider, model: bodyModel } = body as {
    articles?: unknown;
    provider?: string;
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

  // Resolve API key from server-level config
  const stored = await prisma.serverApiKey.findUnique({
    where: { provider },
  });

  if (!stored || !stored.enabled) {
    return NextResponse.json(
      { tags: {}, error: "AI tagging not configured" },
      { status: 400 }
    );
  }

  let apiKey: string;
  try {
    apiKey = decrypt(stored.encryptedKey, stored.iv, stored.authTag);
  } catch {
    return NextResponse.json(
      { tags: {}, error: "Failed to decrypt server API key" },
      { status: 500 }
    );
  }

  const model = bodyModel || stored.model;

  if (!model || typeof model !== "string") {
    return NextResponse.json(
      { tags: {}, error: "Model is required" },
      { status: 400 }
    );
  }

  // Validate model name to prevent path traversal
  if (!/^[a-zA-Z0-9._\-/:]+$/.test(model)) {
    return NextResponse.json(
      { tags: {}, error: "Invalid model name" },
      { status: 400 }
    );
  }

  const sanitized = articles.map((a: { id?: string; title?: string; description?: string }) => ({
    id: String(a.id ?? ""),
    title: String(a.title ?? ""),
    description: String(a.description ?? ""),
  }));

  try {
    const allTagDefs = await getAllTagDefinitions();
    const allTags = allTagDefs.map((t) => ({ slug: t.slug, label: t.label }));

    const tags = await tagArticlesWithAi({
      articles: sanitized,
      allTags,
      provider: provider as AiProvider,
      apiKey,
      model,
    });
    return NextResponse.json({ tags });
  } catch (err) {
    console.error("[ai-tagger]", err);
    return NextResponse.json({ tags: {}, error: "AI tagging failed" }, { status: 500 });
  }
}
