import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getServerConfig } from "@/lib/server-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  try {
    const [lastRefreshAt, countResult, oldest, newest, sizeResult] = await Promise.all([
      getServerConfig("lastRefreshAt"),
      prisma.$queryRawUnsafe<{ cnt: number }[]>("SELECT COUNT(*) as cnt FROM Article"),
      prisma.$queryRawUnsafe<{ publishedAt: string }[]>(
        "SELECT publishedAt FROM Article ORDER BY publishedAt ASC LIMIT 1"
      ),
      prisma.$queryRawUnsafe<{ publishedAt: string }[]>(
        "SELECT publishedAt FROM Article ORDER BY publishedAt DESC LIMIT 1"
      ),
      prisma.$queryRawUnsafe<{ size: string }[]>(
        "SELECT CAST(COALESCE(SUM(LENGTH(id) + LENGTH(url) + LENGTH(title) + LENGTH(description) + LENGTH(content) + COALESCE(LENGTH(imageUrl), 0) + LENGTH(categories) + LENGTH(tags) + LENGTH(sourceName) + LENGTH(sourceId)), 0) AS TEXT) as size FROM Article"
      ),
    ]);

    const articleCount = Number(countResult[0]?.cnt ?? 0);
    const storageSizeKb = Math.round(parseInt(sizeResult[0]?.size ?? "0", 10) / 1024);

    return NextResponse.json({
      lastRefreshAt: lastRefreshAt || null,
      articleCount,
      storageSizeKb,
      oldestArticle: oldest[0]?.publishedAt || null,
      newestArticle: newest[0]?.publishedAt || null,
    });
  } catch (err) {
    console.error("[system-status] Error:", err);
    return NextResponse.json({ error: "Failed to load system status" }, { status: 500 });
  }
}
