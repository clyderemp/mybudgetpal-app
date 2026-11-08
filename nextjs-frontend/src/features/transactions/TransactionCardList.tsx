"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, Button, Money } from "@/components/ui";
import { formatDayLabel } from "@/lib/dates";
import type { Transaction } from "@/lib/types";
import { useCategoryColor } from "./CategoryDot";
import { txnAccountLabel, txnCategory, txnCurrency, txnFlow, txnTitle, txnTotals, type TxnLookups } from "./format";

/** Phone list: grouped by day with a day net total; each row opens the detail drawer. */
export function TransactionCardList({
  rows,
  lookups,
  onOpen,
  showAddedBy = true,
}: {
  rows: Transaction[];
  lookups: TxnLookups;
  onOpen: (t: Transaction) => void;
  showAddedBy?: boolean;
}) {
  const groups: [string, Transaction[]][] = [];
  for (const t of rows) {
    const last = groups[groups.length - 1];
    if (last && last[0] === t.date) last[1].push(t);
    else groups.push([t.date, [t]]);
  }
  return (
    <div className="min-w-0 divide-y divide-line overflow-hidden rounded-container border border-line bg-surface">
      {groups.map(([date, items]) => {
        const { netFils, inFils, outFils } = txnTotals(items, lookups);
        const label = formatDayLabel(date);
        return (
          <section key={date} aria-label={label}>
            <div className="flex h-9 items-center justify-between gap-3 border-b border-line bg-surface-2 px-4">
              <h3 className="truncate text-meta font-semibold text-ink">{label}</h3>
              {inFils || outFils ? (
                <span className="text-xs text-ink-2">
                  <span className="sr-only">Day net </span>
                  <Money fils={netFils} flow={netFils > 0 ? "in" : netFils < 0 ? "out" : "neutral"} className="font-medium" />
                </span>
              ) : null}
            </div>
            <ul className="divide-y divide-line">
              {items.map((t) => (
                <li key={t.id}>
                  <TransactionRowButton t={t} lookups={lookups} onOpen={onOpen} showAddedBy={showAddedBy} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** One dense list row (phones, drawers). */
export function TransactionRowButton({
  t,
  lookups,
  onOpen,
  showAddedBy = true,
  showDate = false,
}: {
  t: Transaction;
  lookups: TxnLookups;
  onOpen: (t: Transaction) => void;
  showAddedBy?: boolean;
  showDate?: boolean;
}) {
  const color = useCategoryColor();
  const cat = t.type !== "transfer" && t.categoryId ? lookups.categories.get(t.categoryId) : null;
  const secondary = t.type === "transfer" ? txnAccountLabel(t, lookups) : `${txnCategory(t, lookups)}, ${txnAccountLabel(t, lookups)}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(t)}
      className="flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color(cat) }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{txnTitle(t, lookups)}</span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-ink-2">
          {showDate ? <span className="shrink-0 tabular">{formatDayLabel(t.date)}</span> : null}
          <span className="truncate">{secondary}</span>
        </span>
      </span>
      {showAddedBy && t.createdByName ? <Avatar name={t.createdByName} size="xs" title={`Added by ${t.createdByName}`} /> : null}
      <Money
        fils={t.amountFils}
        currency={txnCurrency(t, lookups)}
        flow={txnFlow(t)}
        tone={t.type === "transfer" ? "muted" : undefined}
        className="shrink-0 text-sm font-semibold"
      />
    </button>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between gap-2">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft /> Previous
      </Button>
      <span className="tabular text-meta text-ink-2" aria-live="polite">
        {start}–{end} of {total}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next <ChevronRight />
      </Button>
    </nav>
  );
}
