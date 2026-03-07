import { NextResponse } from "next/server";
import { discoverSources } from "@/lib/ai-source-discovery";
import { discoverFeeds } from "@/lib/feed-discovery";
import { validateWebSource } from "@/lib/web-scraper";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/rate-limit";
import { SOURCE_LIBRARY } from "@/config/source-library";
import type { AiProvider, LibrarySource } from "@/types";

const DISCOVER_LIMIT = 5;
const DISCOVER_WINDOW_MS = 60 * 1000;
const LIBRARY_THRESHOLD = 8;

// ── Fuzzy search scoring ─────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function scoreSource(source: LibrarySource, query: string): number {
  const q = query.toLowerCase();
  const name = source.name.toLowerCase();
  const category = source.category.toLowerCase();
  const id = source.id.toLowerCase();

  // Exact name match
  if (name === q) return 100;

  // Name starts with query
  if (name.startsWith(q)) return 90;

  // Name contains query
  if (name.includes(q)) return 80;

  // ID contains query
  if (id.includes(q)) return 75;

  // Exact category match
  if (category === q) return 50;

  // Category contains query
  if (category.includes(q)) return 40;

  // Word overlap between query and name
  const qWords = q.split(/\s+/).filter(Boolean);
  const nameWords = name.split(/\s+/).filter(Boolean);
  let matchedWords = 0;
  for (const qw of qWords) {
    if (nameWords.some((nw) => nw.includes(qw) || qw.includes(nw))) {
      matchedWords++;
    }
  }
  if (matchedWords > 0) {
    return 30 + Math.min(matchedWords / qWords.length, 1) * 30;
  }

  return 0;
}

function fuzzySearchLibrary(query: string): LibrarySource[] {
  const scored = SOURCE_LIBRARY
    .map((source) => ({ source, score: scoreSource(source, query) }))
    .filter((s) => s.score >= 20)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.source);
}

// ── Route handler ────────────────────────────────────────────

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { sources: [], error: "Unauthorized" },
      { status: 401 },
    );
  }

  const rl = checkRateLimit(
    `discover:${session.user.id}`,
    DISCOVER_LIMIT,
    DISCOVER_WINDOW_MS,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { sources: [], error: "Too many requests" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { sources: [], error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { query } = body as { query?: unknown };

  if (typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json(
      { sources: [], error: "query must be a non-empty string" },
      { status: 400 },
    );
  }

  if (query.length > 100) {
    return NextResponse.json(
      { sources: [], error: "query must be 100 characters or less" },
      { status: 400 },
    );
  }

  const trimmed = query.trim();

  // ── Layer 1: Fuzzy search curated library ──────────────────
  const libraryMatches = fuzzySearchLibrary(trimmed);
  console.log(`[discover] Library matched ${libraryMatches.length} sources for "${trimmed}"`);

  if (libraryMatches.length >= LIBRARY_THRESHOLD) {
    return NextResponse.json({ sources: libraryMatches });
  }

  // ── Layer 2+3: AI suggestions + feed autodiscovery ─────────
  const stored = await prisma.serverApiKey.findFirst({
    where: { enabled: true },
  });

  if (!stored) {
    // AI not configured — return library results only (no error)
    return NextResponse.json({ sources: libraryMatches });
  }

  let apiKey: string;
  try {
    apiKey = decrypt(stored.encryptedKey, stored.iv, stored.authTag);
  } catch {
    return NextResponse.json(
      { sources: libraryMatches, error: "Failed to decrypt server API key" },
      { status: 500 },
    );
  }

  try {
    const aiSuggestions = await discoverSources({
      query: trimmed,
      provider: stored.provider as AiProvider,
      apiKey,
      model: stored.model,
    });

    console.log(
      `[discover] AI suggested ${aiSuggestions.length} sources for "${trimmed}":`,
      aiSuggestions.map((s) => s.domain),
    );

    // Deduplicate: skip domains already in library results
    const libraryDomains = new Set(
      libraryMatches.map((s) => {
        try {
          return new URL(s.url).hostname.replace(/^www\./, "");
        } catch {
          return "";
        }
      }),
    );

    const newSuggestions = aiSuggestions.filter(
      (s) => !libraryDomains.has(s.domain.replace(/^www\./, "")),
    );

    // For each new suggestion: autodiscover feeds, then try web scraping
    const aiDiscovered: LibrarySource[] = [];
    const category = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    const discoveryResults = await Promise.allSettled(
      newSuggestions.map(async (suggestion) => {
        const siteUrl = `https://${suggestion.domain}`;
        const id = slugify(suggestion.name) || slugify(suggestion.domain);

        // Try feed autodiscovery first
        const feeds = await discoverFeeds(siteUrl);
        if (feeds.length > 0) {
          return {
            id,
            name: suggestion.name,
            url: feeds[0],
            priority: 2,
            paywalled: suggestion.paywalled,
            type: "rss" as const,
            category,
          };
        }

        // Fall back to web source validation
        const webResult = await validateWebSource(siteUrl);
        if (webResult.valid) {
          return {
            id,
            name: suggestion.name,
            url: siteUrl,
            priority: 2,
            paywalled: suggestion.paywalled,
            type: "web" as const,
            category,
          };
        }

        return null;
      }),
    );

    for (const r of discoveryResults) {
      if (r.status === "fulfilled" && r.value) {
        aiDiscovered.push(r.value);
      }
    }

    console.log(`[discover] Validated ${aiDiscovered.length} AI sources`);

    return NextResponse.json({
      sources: [...libraryMatches, ...aiDiscovered],
    });
  } catch (err) {
    console.error("[ai-source-discovery]", err);
    // Return library results even if AI fails
    return NextResponse.json({ sources: libraryMatches });
  }
}
