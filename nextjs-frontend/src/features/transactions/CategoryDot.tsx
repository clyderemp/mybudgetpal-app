"use client";
import { useCallback } from "react";
import { CATEGORICAL, useChartMode } from "@/lib/chart-theme";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Stable colour per category: the category's own colour, else a fixed categorical slot (never red). */
export function useCategoryColor() {
  const mode = useChartMode();
  return useCallback(
    (c: Pick<Category, "id" | "color"> | null | undefined) => {
      if (!c) return "var(--color-ink-3)";
      if (c.color && /^#[0-9a-f]{3,8}$/i.test(c.color)) return c.color;
      const pal = CATEGORICAL[mode];
      return pal[hash(c.id) % pal.length];
    },
    [mode],
  );
}

/** 8px colour dot + label. Decorative dot; the label carries the meaning. */
export function CategoryLabel({
  category,
  label,
  className,
}: {
  category: Pick<Category, "id" | "color"> | null | undefined;
  label: string;
  className?: string;
}) {
  const color = useCategoryColor();
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color(category) }} />
      <span className="truncate">{label}</span>
    </span>
  );
}
