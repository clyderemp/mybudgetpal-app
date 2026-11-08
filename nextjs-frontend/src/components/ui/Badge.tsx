import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "accent" | "danger" | "warn" | "ink" | "outline";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  accent: "bg-accent-soft text-accent border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  ink: "bg-ink text-ink-fg border-transparent",
  outline: "bg-transparent text-ink-2 border-line-strong",
};

/** Small status chip (4px radius, 20px tall). Use `danger` only for overspend/debt. */
export function Badge({ tone = "neutral", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full shrink-0 items-center gap-1 truncate rounded-chip border px-1.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}

/** Alias — chips and badges share one look. */
export const Chip = Badge;
