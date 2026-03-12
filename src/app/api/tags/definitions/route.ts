import { NextResponse } from "next/server";
import { TAG_DEFINITIONS } from "@/config/tags";
import { getCustomTags } from "@/lib/custom-tags";

export const revalidate = 300; // revalidate every 5 minutes

export async function GET() {
  const customTags = await getCustomTags();

  const tags = [...TAG_DEFINITIONS, ...customTags].map((t) => ({
    slug: t.slug,
    label: t.label,
    color: t.color,
    ...(t.parent ? { parent: t.parent } : {}),
  }));

  return NextResponse.json(
    { tags },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
