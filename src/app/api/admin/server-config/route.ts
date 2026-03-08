import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { getServerConfig, setServerConfig } from "@/lib/server-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const [intervalVal, retentionVal] = await Promise.all([
    getServerConfig("refreshIntervalMinutes"),
    getServerConfig("retentionDays"),
  ]);

  return NextResponse.json({
    refreshIntervalMinutes: intervalVal ? parseInt(intervalVal, 10) : 5,
    retentionDays: retentionVal ? parseInt(retentionVal, 10) : 14,
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = await request.json();
  const { refreshIntervalMinutes, retentionDays } = body as {
    refreshIntervalMinutes?: number;
    retentionDays?: number;
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

  return NextResponse.json({ ok: true });
}
