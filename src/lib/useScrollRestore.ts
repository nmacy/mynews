"use client";

import { useEffect, useState } from "react";

/**
 * Restores scroll position from sessionStorage after loading completes.
 * Returns `initialVisible` count for ArticleGrid pre-rendering.
 */
export function useScrollRestore(loading: boolean): number | undefined {
  const [initialVisible, setInitialVisible] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (loading) return;
    const savedY = sessionStorage.getItem("mn-scroll-y");
    if (savedY) {
      sessionStorage.removeItem("mn-scroll-y");
      const scrollY = parseInt(savedY, 10);
      if (!isNaN(scrollY) && scrollY > 0) {
        // Estimate how many cards to pre-render: ~400px per row, 3 cards/row, +30 buffer
        setInitialVisible(Math.ceil(scrollY / 400) * 3 + 30);
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
        });
      }
    }
  }, [loading]);

  return initialVisible;
}
