"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConfig } from "@/components/ConfigProvider";

export function CategoryTabs() {
  const pathname = usePathname();
  const { config } = useConfig();

  const activeSlug =
    pathname === "/"
      ? "top-stories"
      : pathname.startsWith("/category/")
        ? pathname.split("/")[2]
        : null;

  return (
    <nav style={{ backgroundColor: "var(--mn-card)", borderBottom: "1px solid var(--mn-border)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide py-1">
          {config.categories.map((cat) => {
            const isActive = activeSlug === cat.slug;
            const href =
              cat.slug === "top-stories" ? "/" : `/category/${cat.slug}`;

            return (
              <Link
                key={cat.slug}
                href={href}
                className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-full transition-colors"
                style={
                  isActive
                    ? { backgroundColor: cat.color, color: "white" }
                    : { color: "var(--mn-muted)" }
                }
              >
                {cat.name}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
