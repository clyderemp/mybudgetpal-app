"use client";
import { useCallback, useState } from "react";

/**
 * Tracks an element's content width with a ResizeObserver. Returns a callback ref and the
 * width (0 until measured). Used to drop optional DataTable columns when a panel is narrow.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(): [(el: T | null) => void, number] {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
