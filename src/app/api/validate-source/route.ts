import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSafeUrl } from "@/lib/url-validation";
import { detectSourceType } from "@/lib/web-scraper";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url } = body as { url?: unknown };

  if (typeof url !== "string" || url.trim().length === 0) {
    return NextResponse.json(
      { error: "url must be a non-empty string" },
      { status: 400 },
    );
  }

  const trimmedUrl = url.trim();

  try {
    new URL(trimmedUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!isSafeUrl(trimmedUrl)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }

  try {
    const result = await detectSourceType(trimmedUrl);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 500 },
    );
  }
}
