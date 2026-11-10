import { Flag, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Why a transaction is flagged, in words. */
export function reviewReasonLabel(reason: string | null | undefined): string {
  switch (reason) {
    case "no_name":
      return "No merchant or payee name";
    case "manual":
      return "Flagged by you";
    default:
      return "Flagged for a check";
  }
}

/** Amber "Needs review" chip; renders nothing for unflagged rows. `compact` = short label for dense rows. */
export function ReviewBadge({ t, compact, className }: { t: Pick<Transaction, "needsReview" | "reviewReason">; compact?: boolean; className?: string }) {
  if (!t.needsReview) return null;
  return (
    <Badge tone="warn" className={cn("shrink-0", className)} title={reviewReasonLabel(t.reviewReason)}>
      <Flag aria-hidden />
      {compact ? "Review" : "Needs review"}
    </Badge>
  );
}

/** "3 items" hint for list rows; nothing when the transaction has no line items. */
export function ItemsHint({ t, className }: { t: Pick<Transaction, "items">; className?: string }) {
  const n = t.items?.length ?? 0;
  if (!n) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs text-ink-2", className)} title={t.items!.map((i) => i.name).join(", ")}>
      <ListChecks className="size-3" aria-hidden />
      {n} {n === 1 ? "item" : "items"}
    </span>
  );
}
