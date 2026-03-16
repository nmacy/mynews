"use client";

import { useEffect, type RefObject } from "react";

/**
 * Calls `onClose` when a mousedown event occurs outside the referenced element.
 * Only attaches the listener when `active` is true.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  active: boolean
): void {
  useEffect(() => {
    if (!active) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ref, onClose, active]);
}
