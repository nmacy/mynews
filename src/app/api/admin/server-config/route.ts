import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { getServerConfig, setServerConfig, getRankingConfig } from "@/lib/server-config";

export const dynamic = "force-dynamic";

const RANKING_TOGGLE_KEYS = [
  "rankingEnabled",
  "rankLayerAiScore",
  "rankLayerSourcePriority",
  "rankLayerTagInterest",
  "rankLayerTimeDecay",
  "rankLayerDedup",
  "rankDebugScores",
] as const;

export async function GET() {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const [intervalVal, retentionVal, rankingConfig] = await Promise.all([
    getServerConfig("refreshIntervalMinutes"),
    getServerConfig("retentionDays"),
    getRankingConfig(),
  ]);

  return NextResponse.json({
    refreshIntervalMinutes: intervalVal ? parseInt(intervalVal, 10) : 5,
    retentionDays: retentionVal ? parseInt(retentionVal, 10) : 14,
    ranking: rankingConfig,
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = await request.json();
  const { refreshIntervalMinutes, retentionDays, ranking } = body as {
    refreshIntervalMinutes?: number;
    retentionDays?: number;
    ranking?: Record<string, unknown>;
  };

  if (refreshIntervalMinutes !== undefined) {
    if (typeof refreshIntervalMinutes !== "number" || refreshIntervalMinutes < 1 || refreshIntervalMinutes > 60) {
      return NextResponse.json({ error: "refreshIntervalMinutes must be 1-60" }, { status: 400 });
    }
    await setServerConfig("refreshIntervalMinutes", String(refreshIntervalMinutes));
  }

  if (retentionDays !== undefined) {
    if (typeof retentionDays !== "number" || retentionDays < 1 || retentionDays > 90) {
      return NextResponse.json({ error: "retentionDays must be 1-90" }, { status: 400 });
    }
    await setServerConfig("retentionDays", String(retentionDays));
  }

  if (ranking && typeof ranking === "object") {
    for (const key of RANKING_TOGGLE_KEYS) {
      if (key in ranking && typeof ranking[key] === "boolean") {
        await setServerConfig(key, String(ranking[key]));
      }
    }
    if ("rankTimeDecayGravity" in ranking && typeof ranking.rankTimeDecayGravity === "number") {
      const g = Math.max(0.5, Math.min(2.0, ranking.rankTimeDecayGravity));
      await setServerConfig("rankTimeDecayGravity", String(g));
    }
  }

  return NextResponse.json({ ok: true });
}
