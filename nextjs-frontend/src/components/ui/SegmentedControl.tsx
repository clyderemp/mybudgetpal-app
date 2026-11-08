"use client";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

/** Radio-group style toggle (e.g. Expense | Income | Transfer, Avalanche | Snowball). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
  size = "md",
  fullWidth,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = options.length;
    for (let step = 1; step <= n; step++) {
      const j = (i + dir * step + n) % n;
      if (!options[j].disabled) {
        onChange(options[j].value);
        refs.current[j]?.focus();
        return;
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex max-w-full gap-0.5 rounded-control border border-line bg-surface-2 p-0.5", fullWidth && "flex w-full", className)}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "min-w-0 truncate whitespace-nowrap rounded-chip",
              fullWidth ? "flex-1" : "flex-none",
              " font-medium transition-colors disabled:opacity-50",
              "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-accent",
              size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-3 text-meta",
              active ? "bg-surface text-ink ring-1 ring-line-strong" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
