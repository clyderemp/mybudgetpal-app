"use client";
import { ArrowLeftRight, BookmarkPlus, CheckCheck, MoreHorizontal, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActionMenu, Badge, Button, Dropdown, Money, inputClasses, type ActionMenuItem } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import type { ImportRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { rowStatusChip } from "./importMeta";
import { useReview } from "./ReviewContext";

/** Short accessible name for a row ("12 Mar 2026, 45.00 out, CARREFOUR…"). */
export function rowLabel(r: ImportRow): string {
  return `${formatDate(r.date)}, ${r.merchant || r.description.slice(0, 40)}`;
}

export function StatusChip({ row }: { row: ImportRow }) {
  const s = rowStatusChip(row);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function AmountCell({ row, className }: { row: ImportRow; className?: string }) {
  const { sectionsByIndex } = useReview();
  const currency = sectionsByIndex.get(row.sectionIndex)?.currency ?? "AED";
  return (
    <Money
      fils={row.amountFils}
      currency={currency}
      flow={row.direction === "in" ? "in" : "out"}
      tone={row.action === "skip" ? "muted" : undefined}
      className={className}
    />
  );
}

/** Include / skip checkbox (action import|skip). */
export function IncludeToggle({ row }: { row: ImportRow }) {
  const { patchRows, readOnly } = useReview();
  const checked = row.action === "import";
  return (
    <label className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control hover:bg-surface-2 has-[:disabled]:cursor-default pointer-coarse:size-10">
      <input
        type="checkbox"
        className="size-4 cursor-pointer accent-[var(--color-accent)] disabled:cursor-default"
        checked={checked}
        disabled={readOnly}
        onChange={(e) => patchRows([{ id: row.id, action: e.target.checked ? "import" : "skip" }])}
      />
      <span className="sr-only">Include {rowLabel(row)}</span>
    </label>
  );
}

/** Raw bank text: one line, expands on click to the full text plus reference details. */
export function DescriptionText({ row, className }: { row: ImportRow; className?: string }) {
  const [open, setOpen] = useState(false);
  const extra = [
    row.ref ? `Ref ${row.ref}` : null,
    row.cardLast4 ? `Card ..${row.cardLast4}` : null,
    row.counterpartyLast4 ? `Account ..${row.counterpartyLast4}` : null,
    row.originalAmount ? `Original ${row.originalAmount}${row.originalCurrency ? ` ${row.originalCurrency}` : ""}` : null,
  ].filter(Boolean) as string[];
  return (
    <div className={cn("min-w-0", className)}>
      <button
        type="button"
        aria-expanded={open}
        title={open ? undefined : row.description}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "block max-w-full text-left text-xs text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
          open ? "break-words whitespace-pre-wrap" : "truncate",
        )}
      >
        <span className="sr-only">Bank description: </span>
        {row.description}
      </button>
      {open && extra.length > 0 ? <p className="mt-0.5 text-xs text-ink-2">{extra.join(", ")}</p> : null}
    </div>
  );
}

/** Why the row got its proposal (and any commit error). */
export function ReasonText({ row }: { row: ImportRow }) {
  const { rowErrors } = useReview();
  const err = rowErrors[row.id];
  return (
    <>
      {row.reason ? <p className="mt-0.5 text-xs text-pretty text-ink-2">{row.reason}</p> : null}
      {err ? (
        <p role="alert" className="mt-0.5 text-xs font-medium text-danger">
          {err}
        </p>
      ) : null}
    </>
  );
}

/** Merchant / payee text input: saves 700 ms after typing stops, or on blur. */
export function MerchantField({ row, className }: { row: ImportRow; className?: string }) {
  const { patchRows, readOnly } = useReview();
  const server = row.merchant ?? "";
  const [draft, setDraft] = useState(server);
  const [prevServer, setPrevServer] = useState(server);
  const [focused, setFocused] = useState(false);
  // Pick up server-side changes (rematch, rules) unless the user is typing here.
  if (server !== prevServer) {
    setPrevServer(server);
    if (!focused) setDraft(server);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = (value: string) => {
    clearTimeout(timer.current);
    const v = value.trim();
    if (v === server.trim()) return;
    patchRows([{ id: row.id, merchant: v }]);
  };

  if (readOnly) {
    return <p className={cn("truncate text-sm font-medium text-ink", className)}>{server || <span className="text-ink-2">No merchant</span>}</p>;
  }
  return (
    <input
      type="text"
      value={draft}
      maxLength={200}
      autoComplete="off"
      placeholder="Add merchant or payee"
      aria-label={`Merchant or payee, ${formatDate(row.date)}`}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => save(v), 700);
      }}
      onBlur={() => {
        setFocused(false);
        save(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          clearTimeout(timer.current);
          setDraft(server);
        }
      }}
      className={cn(inputClasses, "h-8 px-2 font-medium md:text-sm pointer-coarse:h-10", className)}
    />
  );
}

/** Category picker filtered to the row's kind (income/expense). Hidden for transfers. */
export function CategoryPicker({ row, className }: { row: ImportRow; className?: string }) {
  const { categories, categoriesById, patchRows, readOnly } = useReview();
  const options = useMemo(
    () =>
      categories
        .filter((c) => !c.archived && c.kind === row.type)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, row.type],
  );
  if (row.type === "transfer") return null;
  if (readOnly) {
    const c = row.categoryId ? categoriesById.get(row.categoryId) : null;
    return <p className={cn("truncate text-sm text-ink-2", className)}>{c?.name ?? "Uncategorised"}</p>;
  }
  return (
    <Dropdown
      className={className}
      options={options}
      value={row.categoryId}
      placeholder="Choose category"
      aria-label={`Category, ${formatDate(row.date)}`}
      onChange={(v) => v && v !== row.categoryId && patchRows([{ id: row.id, categoryId: v }])}
    />
  );
}

/** Transfers: the other own account ("To" on money out, "From" on money in). */
export function CounterAccountPicker({ row, className }: { row: ImportRow; className?: string }) {
  const { accounts, accountsById, sectionsByIndex, patchRows, readOnly } = useReview();
  const own = sectionsByIndex.get(row.sectionIndex)?.accountId ?? null;
  const prefix = row.direction === "out" ? "To" : "From";
  const options = useMemo(
    () =>
      accounts
        .filter((a) => !a.archived && a.id !== own)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({ value: a.id, label: `${prefix} ${a.name}`, description: a.last4 ? `${a.institution ?? ""} ..${a.last4}`.trim() : (a.institution ?? undefined) })),
    [accounts, own, prefix],
  );
  if (row.type !== "transfer") return null;
  if (readOnly) {
    const a = row.counterAccountId ? accountsById.get(row.counterAccountId) : null;
    return <p className={cn("truncate text-sm text-ink-2", className)}>{a ? `${prefix} ${a.name}` : "Other account not set"}</p>;
  }
  return (
    <Dropdown
      className={className}
      options={options}
      value={row.counterAccountId}
      placeholder={`${prefix} which account?`}
      aria-label={`${prefix} account, ${formatDate(row.date)}`}
      onChange={(v) => v && v !== row.counterAccountId && patchRows([{ id: row.id, counterAccountId: v }])}
    />
  );
}

/** Row "More actions": merchant rule, mark reviewed, change type. */
export function RowMenu({ row }: { row: ImportRow }) {
  const { patchRows, openRuleDialog, readOnly } = useReview();
  if (readOnly) return null;
  const items: ActionMenuItem[] = [];
  if (row.type !== "transfer") {
    items.push({
      label: "Always categorise like this",
      icon: <BookmarkPlus />,
      onSelect: () => openRuleDialog(row),
      disabled: !row.categoryId,
    });
  }
  if (row.needsReview) {
    items.push({ label: "Mark reviewed", icon: <CheckCheck />, onSelect: () => patchRows([{ id: row.id, needsReview: false }]) });
  }
  const types = row.direction === "out" ? (["expense", "transfer"] as const) : (["income", "transfer"] as const);
  const typeItems: ActionMenuItem[] = types
    .filter((t) => t !== row.type)
    .map((t) => ({
      label: t === "transfer" ? "Treat as transfer" : t === "expense" ? "Treat as expense" : "Treat as income",
      icon: t === "transfer" ? <ArrowLeftRight /> : t === "expense" ? <TrendingDown /> : <TrendingUp />,
      onSelect: () => patchRows([{ id: row.id, type: t }]),
    }));
  if (items.length && typeItems.length) items.push({ separator: true });
  items.push(...typeItems);
  return (
    <ActionMenu
      items={items}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`More actions, ${rowLabel(row)}`}>
          <MoreHorizontal />
        </Button>
      }
    />
  );
}
