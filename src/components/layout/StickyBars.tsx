"use client";

import { useEffect, useRef, useState } from "react";

export function StickyBars({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        // Show bars when scrolling up or near top
        if (y < 56 || y < lastY.current) {
          setVisible(true);
        } else if (y > lastY.current) {
          setVisible(false);
        }
        lastY.current = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={barRef}
      className="sticky z-40"
      style={{
        top: "3.5rem", // below the h-14 header
        transform: visible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.25s ease",
      }}
    >
      {children}
    </div>
  );
}
