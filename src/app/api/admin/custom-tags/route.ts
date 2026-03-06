import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { TAG_DEFINITIONS } from "@/config/tags";
import { getNextAvailableColor, TAG_COLOR_PALETTE } from "@/lib/custom-tags";

const SLUG_RE = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

export async function GET() {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  try {
    const tags = await prisma.customTag.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ tags });
  } catch {
    // Table may not exist yet
    return NextResponse.json({ tags: [] });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, label, color, parent } = body as {
    slug?: string;
    label?: string;
    color?: string;
    parent?: string;
  };

  if (!slug || typeof slug !== "string" || !SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: "Invalid slug (lowercase, hyphens, 3-30 chars)" },
      { status: 400 }
    );
  }

  if (!label || typeof label !== "string" || label.trim().length === 0) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  // Check collision with static tags
  if (TAG_DEFINITIONS.some((t) => t.slug === slug)) {
    return NextResponse.json(
      { error: "Tag slug conflicts with a built-in tag" },
      { status: 409 }
    );
  }

  try {
    // Check collision with existing custom tags
    const existing = await prisma.customTag.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "Tag slug already exists" },
        { status: 409 }
      );
    }

    // Auto-assign color from palette if not provided
    let tagColor = color;
    if (!tagColor) {
      const allCustom = await prisma.customTag.findMany({ select: { color: true } });
      const staticColors = new Set(TAG_DEFINITIONS.map((t) => t.color));
      const customColors = new Set(allCustom.map((t) => t.color));
      const usedColors = new Set([...staticColors, ...customColors]);
      tagColor = getNextAvailableColor(usedColors);
    }

    // Validate color is a valid hex
    if (!/^#[0-9A-Fa-f]{6}$/.test(tagColor)) {
      tagColor = TAG_COLOR_PALETTE[0];
    }

    const tag = await prisma.customTag.create({
      data: {
        slug,
        label: label.trim(),
        color: tagColor,
        parent: parent || null,
      },
    });

    return NextResponse.json({ tag });
  } catch (err) {
    console.error("[custom-tags] POST failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to create tag: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json(
      { error: "slug query param required" },
      { status: 400 }
    );
  }

  try {
    await prisma.customTag.deleteMany({ where: { slug } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[custom-tags] DELETE failed:", err);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}
