import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = await prisma.serverApiKey.findFirst({
    where: { enabled: true },
    select: { provider: true, model: true },
  });

  if (!key) {
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({
    enabled: true,
    provider: key.provider,
    model: key.model,
  });
}
