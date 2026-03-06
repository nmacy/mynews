import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAllTagDefinitions } from "@/lib/custom-tags";
import { discoverNewTags } from "@/lib/ai-tag-discovery";
import type { AiProvider } from "@/types";

const DISCOVER_LIMIT = 5;
const DISCOVER_WINDOW_MS = 60 * 1000;

export async function POST(request: Request) {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const rl = checkRateLimit(
    `discover-tags:${session!.user!.id}`,
    DISCOVER_LIMIT,
    DISCOVER_WINDOW_MS
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { articles } = body as {
    articles?: { title: string; description: string }[];
  };

  if (!Array.isArray(articles) || articles.length === 0) {
    return NextResponse.json(
      { error: "articles must be a non-empty array" },
      { status: 400 }
    );
  }

  // Find an enabled AI provider
  const stored = await prisma.serverApiKey.findFirst({
    where: { enabled: true },
  });

  if (!stored) {
    return NextResponse.json(
      { error: "No AI provider configured" },
      { status: 400 }
    );
  }

  let apiKey: string;
  try {
    apiKey = decrypt(stored.encryptedKey, stored.iv, stored.authTag);
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt API key" },
      { status: 500 }
    );
  }

  const allTags = await getAllTagDefinitions();
  const existingTags = allTags.map((t) => ({ slug: t.slug, label: t.label }));

  const sanitized = articles.slice(0, 20).map((a) => ({
    title: String(a.title ?? ""),
    description: String(a.description ?? ""),
  }));

  try {
    const suggestions = await discoverNewTags({
      articles: sanitized,
      existingTags,
      provider: stored.provider as AiProvider,
      apiKey,
      model: stored.model,
    });
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[discover-tags]", err);
    return NextResponse.json(
      { error: "Tag discovery failed" },
      { status: 500 }
    );
  }
}
