import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import {
  getCacheStats,
  flushExtractionCache,
  pruneExpiredExtractions,
} from "@/lib/extraction-cache";

export async function GET() {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  await pruneExpiredExtractions().catch(() => {});

  const stats = await getCacheStats();
  return NextResponse.json(stats);
}

export async function DELETE() {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const deleted = await flushExtractionCache();
  return NextResponse.json({ ok: true, deleted });
}
