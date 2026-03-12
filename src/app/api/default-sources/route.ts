import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import sourcesConfig from "@/config/sources.json";
import type { Source } from "@/types";

export const revalidate = 300; // revalidate every 5 minutes

export async function GET() {
  try {
    const row = await prisma.serverDefaultSources.findUnique({
      where: { key: "default" },
    });

    if (row) {
      const sources = JSON.parse(row.sources) as Source[];
      if (sources.length > 0) {
        return NextResponse.json({ sources }, {
          headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
        });
      }
    }
  } catch {
    // fall through to static defaults
  }

  return NextResponse.json({ sources: sourcesConfig.sources }, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
  });
}
