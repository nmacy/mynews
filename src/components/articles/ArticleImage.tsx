"use client";

import Image from "next/image";
import { useState } from "react";

const PLACEHOLDER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450' fill='%23E5E7EB'%3E%3Crect width='800' height='450'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239CA3AF' font-size='48' font-family='system-ui'%3EMyNews%3C/text%3E%3C/svg%3E`;

export function ArticleImage({
  src,
  alt,
  fill,
  className,
  sizes,
  priority,
}: {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [error, setError] = useState(false);
  const isValid = !!src && (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:"));
  const imageSrc = !isValid || error ? PLACEHOLDER_SVG : src;

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      priority={priority}
      onError={() => setError(true)}
      unoptimized={!isValid || error}
    />
  );
}
