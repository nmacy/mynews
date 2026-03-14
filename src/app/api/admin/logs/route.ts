import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { listLogFiles, readLogEntries, readLogFileRaw } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const date = request.nextUrl.searchParams.get("date");
  const level = request.nextUrl.searchParams.get("level") as "info" | "warn" | "error" | null;
  const download = request.nextUrl.searchParams.get("download");

  // Download raw log file
  if (download) {
    const content = readLogFileRaw(download);
    if (!content) {
      return NextResponse.json({ error: "Log file not found" }, { status: 404 });
    }
    return new Response(content, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${download}.log"`,
      },
    });
  }

  // Read entries for a specific date
  if (date) {
    const entries = readLogEntries(date, level || undefined);
    return NextResponse.json({ date, entries });
  }

  // List available log files
  const files = listLogFiles();
  return NextResponse.json({ files });
}
