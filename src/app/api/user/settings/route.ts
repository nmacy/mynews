import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

const VALID_THEMES = new Set(["light", "dark", "system"]);
const VALID_ACCENTS = new Set(["blue", "indigo", "purple", "violet", "green", "teal", "cyan", "orange", "amber", "red", "pink", "rose", "slate", "brown", "mint"]);
const MAX_SOURCES = 200;
const MAX_TAGS = 100;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  if (!settings) {
    return NextResponse.json({
      sources: [],
      featuredTags: [],
      disabledSourceIds: [],
      customLibrary: [],
      sourceBarOrder: [],
      theme: "system",
      accent: "blue",
    });
  }

  return NextResponse.json({
    sources: safeJsonParse(settings.sources, []),
    featuredTags: safeJsonParse(settings.featuredTags, []),
    disabledSourceIds: safeJsonParse(settings.disabledSourceIds, []),
    customLibrary: safeJsonParse(settings.customLibrary, []),
    sourceBarOrder: safeJsonParse(settings.sourceBarOrder, []),
    theme: settings.theme,
    accent: settings.accent ?? "blue",
  });
}

// POST alias for PUT — sendBeacon can only POST
export async function POST(request: Request) {
  return PUT(request);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as {
    sources?: unknown[];
    featuredTags?: string[];
    disabledSourceIds?: string[];
    customLibrary?: unknown[];
    sourceBarOrder?: string[];
    theme?: string;
    accent?: string;
  };

  // Validate shapes and sizes
  if (data.sources !== undefined) {
    if (!Array.isArray(data.sources) || data.sources.length > MAX_SOURCES) {
      return NextResponse.json({ error: "Invalid sources" }, { status: 400 });
    }
  }
  if (data.featuredTags !== undefined) {
    if (!Array.isArray(data.featuredTags) || data.featuredTags.length > MAX_TAGS) {
      return NextResponse.json({ error: "Invalid featuredTags" }, { status: 400 });
    }
  }
  if (data.disabledSourceIds !== undefined) {
    if (!Array.isArray(data.disabledSourceIds) || data.disabledSourceIds.length > MAX_SOURCES) {
      return NextResponse.json({ error: "Invalid disabledSourceIds" }, { status: 400 });
    }
  }
  if (data.customLibrary !== undefined) {
    if (!Array.isArray(data.customLibrary) || data.customLibrary.length > MAX_SOURCES) {
      return NextResponse.json({ error: "Invalid customLibrary" }, { status: 400 });
    }
  }
  if (data.sourceBarOrder !== undefined) {
    if (!Array.isArray(data.sourceBarOrder) || data.sourceBarOrder.length > MAX_SOURCES) {
      return NextResponse.json({ error: "Invalid sourceBarOrder" }, { status: 400 });
    }
  }
  if (data.theme !== undefined && !VALID_THEMES.has(data.theme)) {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }
  if (data.accent !== undefined && !VALID_ACCENTS.has(data.accent)) {
    return NextResponse.json({ error: "Invalid accent" }, { status: 400 });
  }

  const update: Record<string, string> = {};
  if (data.sources !== undefined) update.sources = JSON.stringify(data.sources);
  if (data.featuredTags !== undefined) update.featuredTags = JSON.stringify(data.featuredTags);
  if (data.disabledSourceIds !== undefined) update.disabledSourceIds = JSON.stringify(data.disabledSourceIds);
  if (data.customLibrary !== undefined) update.customLibrary = JSON.stringify(data.customLibrary);
  if (data.sourceBarOrder !== undefined) update.sourceBarOrder = JSON.stringify(data.sourceBarOrder);
  if (data.theme !== undefined) update.theme = data.theme;
  if (data.accent !== undefined) update.accent = data.accent;

  const settings = await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...update },
    update,
  });

  return NextResponse.json({
    sources: safeJsonParse(settings.sources, []),
    featuredTags: safeJsonParse(settings.featuredTags, []),
    disabledSourceIds: safeJsonParse(settings.disabledSourceIds, []),
    customLibrary: safeJsonParse(settings.customLibrary, []),
    sourceBarOrder: safeJsonParse(settings.sourceBarOrder, []),
    theme: settings.theme,
    accent: settings.accent ?? "blue",
  });
}
