import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { SOURCE_LIBRARY } from "@/config/source-library";
import type { Source } from "@/types";

export async function GET() {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  try {
    const row = await prisma.serverDefaultSources.findUnique({
      where: { key: "default" },
    });

    if (row) {
      const sources = JSON.parse(row.sources) as Source[];
      return NextResponse.json({ sourceIds: sources.map((s) => s.id) });
    }
  } catch (err) {
    console.error("[admin/default-sources] GET error:", err);
  }

  return NextResponse.json({ sourceIds: [] });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  try {
    const body = await request.json();
    const sourceIds: string[] = body.sourceIds;

    if (!Array.isArray(sourceIds)) {
      return NextResponse.json({ error: "sourceIds must be an array" }, { status: 400 });
    }

    const idSet = new Set(sourceIds);
    const sources: Source[] = SOURCE_LIBRARY
      .filter((s) => idSet.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        priority: s.priority,
        ...(s.paywalled ? { paywalled: s.paywalled } : {}),
        ...(s.type ? { type: s.type } : {}),
      }));

    await prisma.serverDefaultSources.upsert({
      where: { key: "default" },
      update: { sources: JSON.stringify(sources) },
      create: { key: "default", sources: JSON.stringify(sources) },
    });

    return NextResponse.json({ ok: true, count: sources.length });
  } catch (err) {
    console.error("[admin/default-sources] PUT error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save" },
      { status: 500 }
    );
  }
}
