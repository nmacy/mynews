import { NextResponse } from "next/server";
import { discoverSources } from "@/lib/ai-source-discovery";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import type { AiProvider } from "@/types";

const DISCOVER_LIMIT = 5;
const DISCOVER_WINDOW_MS = 60 * 1000;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { sources: [], error: "Unauthorized" },
      { status: 401 }
    );
  }

  const rl = checkRateLimit(
    `discover:${session.user.id}`,
    DISCOVER_LIMIT,
    DISCOVER_WINDOW_MS
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { sources: [], error: "Too many requests" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { sources: [], error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { query } = body as { query?: unknown };

  if (typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json(
      { sources: [], error: "query must be a non-empty string" },
      { status: 400 }
    );
  }

  if (query.length > 100) {
    return NextResponse.json(
      { sources: [], error: "query must be 100 characters or less" },
      { status: 400 }
    );
  }

  const stored = await prisma.serverApiKey.findFirst({
    where: { enabled: true },
  });

  if (!stored) {
    return NextResponse.json(
      { sources: [], error: "AI not configured" },
      { status: 400 }
    );
  }

  let apiKey: string;
  try {
    apiKey = decrypt(stored.encryptedKey, stored.iv, stored.authTag);
  } catch {
    return NextResponse.json(
      { sources: [], error: "Failed to decrypt server API key" },
      { status: 500 }
    );
  }

  try {
    const sources = await discoverSources({
      query: query.trim(),
      provider: stored.provider as AiProvider,
      apiKey,
      model: stored.model,
    });
    return NextResponse.json({ sources });
  } catch (err) {
    console.error("[ai-source-discovery]", err);
    return NextResponse.json(
      { sources: [], error: "Source discovery failed" },
      { status: 500 }
    );
  }
}
