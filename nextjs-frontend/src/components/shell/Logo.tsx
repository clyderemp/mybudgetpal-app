import { cn } from "@/lib/utils";

/** Brand mark: a quiet ledger glyph. `inverse` for the dark sidebar. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-control bg-accent text-white", className)} aria-hidden>
      <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 15V9M8 15V5M12 15v-4M16 15V7" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-base font-semibold text-ink", className)}>
      <LogoMark />
      MyBudgetPal
    </span>
  );
}
