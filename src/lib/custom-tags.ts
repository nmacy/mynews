import { prisma } from "@/lib/prisma";
import { TAG_DEFINITIONS, type TagDefinition } from "@/config/tags";

// Curated palette of distinct colors (Tailwind 500/600 range),
// avoiding colors already used by static tags.
export const TAG_COLOR_PALETTE = [
  "#D946EF", // fuchsia-500
  "#F43F5E", // rose-500
  "#84CC16", // lime-500
  "#06B6D4", // cyan-500
  "#8B5CF6", // violet-500
  "#F97316", // orange-500
  "#EAB308", // yellow-500
  "#64748B", // slate-500
  "#2DD4BF", // teal-400
  "#FB7185", // rose-400
  "#A78BFA", // violet-400
  "#38BDF8", // sky-400
  "#4ADE80", // green-400
  "#FACC15", // yellow-400
  "#C084FC", // purple-400
  "#FB923C", // orange-400
  "#E879F9", // fuchsia-400
  "#34D399", // emerald-400
  "#818CF8", // indigo-400
  "#F472B6", // pink-400
];

export function getNextAvailableColor(usedColors: Set<string>): string {
  for (const color of TAG_COLOR_PALETTE) {
    if (!usedColors.has(color)) return color;
  }
  // Fallback: cycle from the beginning
  return TAG_COLOR_PALETTE[usedColors.size % TAG_COLOR_PALETTE.length];
}

export async function getCustomTags(): Promise<TagDefinition[]> {
  try {
    const rows = await prisma.customTag.findMany({
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      slug: r.slug,
      label: r.label,
      color: r.color,
      keywords: [r.label.toLowerCase()],
      ...(r.parent ? { parent: r.parent } : {}),
    }));
  } catch {
    // Table may not exist yet if prisma db push hasn't been run
    return [];
  }
}

export async function getAllTagDefinitions(): Promise<TagDefinition[]> {
  const custom = await getCustomTags();
  return [...TAG_DEFINITIONS, ...custom];
}
