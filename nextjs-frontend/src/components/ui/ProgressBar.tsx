"use client";
import * as Progress from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

/**
 * Budget-style progress. value/max in the same units (e.g. fils).
 * <85% accent, 85–100% warn, >100% danger (over budget). `invertColors` for goals (never red).
 */
export function ProgressBar({
  value,
  max,
  label,
  className,
  size = "md",
  invertColors = false,
}: {
  value: number;
  max: number;
  /** Accessible label, e.g. "Groceries budget used". */
  label?: string;
  className?: string;
  size?: "sm" | "md";
  invertColors?: boolean;
}) {
  const ratio = max > 0 ? value / max : value > 0 ? Infinity : 0;
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const over = !invertColors && ratio > 1;
  const warn = !invertColors && !over && ratio >= 0.85;
  return (
    <Progress.Root
      value={Math.min(value, max)}
      max={max > 0 ? max : 1}
      aria-label={label}
      aria-valuetext={max > 0 ? `${Math.round(ratio * 100)}%` : undefined}
      className={cn("relative w-full overflow-hidden rounded-full bg-line", size === "sm" ? "h-1" : "h-1.5", className)}
    >
      <Progress.Indicator
        className={cn("h-full rounded-full transition-[width] duration-300", over ? "bg-danger" : warn ? "bg-warn" : "bg-accent")}
        style={{ width: `${pct}%` }}
      />
    </Progress.Root>
  );
}
