import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import sourcesConfig from "@/config/sources.json";
import type { Source } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const row = await prisma.serverDefaultSources.findUnique({
      where: { key: "default" },
    });

    if (row) {
      const sources = JSON.parse(row.sources) as Source[];
      if (sources.length > 0) {
        return NextResponse.json({ sources });
      }
    }
  } catch {
    // fall through to static defaults
  }

  return NextResponse.json({ sources: sourcesConfig.sources });
}
