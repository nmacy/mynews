"use client";

import { useConfig } from "@/components/ConfigProvider";

export function CategoryBadge({ slug }: { slug: string }) {
  const { config } = useConfig();
  const category = config.categories.find((c) => c.slug === slug);
  if (!category) return null;

  return (
    <span
      className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full text-white"
      style={{ backgroundColor: category.color }}
    >
      {category.name}
    </span>
  );
}
