"use client";
import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { usePeriod } from "@/lib/period";
import { cn } from "@/lib/utils";
import { menuContentClass } from "@/components/ui/Dropdown";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const seg =
  "inline-flex h-8 items-center justify-center text-ink-2 hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40 " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

/** Global month selector (prev | month picker | next). Reads/writes ?month= via usePeriod(). */
export function PeriodSelector({ className }: { className?: string }) {
  const p = usePeriod();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(p.month.slice(0, 4)));
  const thisYear = Number(p.thisMonth.slice(0, 4));

  return (
    <div
      role="group"
      aria-label="Period"
      className={cn("inline-flex h-8 items-stretch overflow-hidden rounded-control border border-line-strong bg-surface", className)}
    >
      <button type="button" className={cn(seg, "w-8 border-r border-line")} onClick={p.prev} aria-label="Previous month">
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <Popover.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setYear(Number(p.month.slice(0, 4)));
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(seg, "min-w-30 gap-1.5 px-2.5 text-meta font-medium text-ink")}
            aria-label={`Period: ${p.label}. Change month`}
          >
            <CalendarDays className="size-3.5 text-ink-2" aria-hidden />
            <span className="tabular">{p.label}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="center" sideOffset={6} collisionPadding={8} className={cn(menuContentClass, "w-64 p-3")}>
            <div className="mb-2 flex items-center justify-between">
              <button type="button" className={cn(seg, "w-8 rounded-control")} onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <span className="tabular text-sm font-semibold" aria-live="polite">
                {year}
              </span>
              <button
                type="button"
                className={cn(seg, "w-8 rounded-control")}
                onClick={() => setYear((y) => y + 1)}
                disabled={year >= thisYear}
                aria-label="Next year"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((m, i) => {
                const value = `${year}-${String(i + 1).padStart(2, "0")}`;
                const selected = value === p.month;
                const future = value > p.thisMonth;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={future}
                    aria-pressed={selected}
                    onClick={() => {
                      p.setMonth(value);
                      setOpen(false);
                    }}
                    className={cn(
                      "h-8 rounded-control text-meta font-medium disabled:opacity-35",
                      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                      selected ? "bg-ink text-ink-fg" : value === p.thisMonth ? "text-accent hover:bg-surface-2" : "text-ink hover:bg-surface-2",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            {!p.isCurrent ? (
              <button
                type="button"
                className="mt-2 h-8 w-full rounded-control border border-line text-meta font-medium text-ink hover:bg-surface-2"
                onClick={() => {
                  p.setMonth(p.thisMonth);
                  setOpen(false);
                }}
              >
                Go to this month
              </button>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <button type="button" className={cn(seg, "w-8 border-l border-line")} onClick={p.next} disabled={!p.canNext} aria-label="Next month">
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}
