"use client";
import { Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button, DateField, Dropdown, type DropdownOption } from "@/components/ui";
import { inputClasses } from "@/components/ui/Field";
import { formatDate } from "@/lib/dates";
import type { Account, Category, CategoryGroup, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCategoryColor } from "./CategoryDot";

/** Date range mode. "month" follows the global period selector. */
export type RangeMode = "month" | "90d" | "year" | "all" | "custom";

export interface TxnFilterValues {
  range: RangeMode;
  /** Only used when range = "custom". */
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  q?: string;
}

export type TxnFilterPatch = Partial<Record<"range" | "from" | "to" | "accountId" | "categoryId" | "type" | "q", string | null>>;

const TYPE_OPTIONS: DropdownOption[] = [
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfers" },
];

const GROUP_LABEL: Record<CategoryGroup, string> = {
  essentials: "Essentials",
  lifestyle: "Lifestyle",
  debt: "Debt",
  savings: "Savings",
  income: "Income",
  other: "Other",
};

export const CLEAR_ALL: TxnFilterPatch = { range: null, from: null, to: null, accountId: null, categoryId: null, type: null, q: null };

export function rangeLabel(v: TxnFilterValues, monthLabel: string): string {
  switch (v.range) {
    case "month":
      return monthLabel;
    case "90d":
      return "Last 90 days";
    case "year":
      return "This year";
    case "all":
      return "All time";
    case "custom":
      if (v.from && v.to) return `${formatDate(v.from, true)} to ${formatDate(v.to)}`;
      if (v.from) return `From ${formatDate(v.from)}`;
      if (v.to) return `Until ${formatDate(v.to)}`;
      return "Custom range";
  }
}

/**
 * Toolbar: search, date range, account, category, type (compact chip controls),
 * then a row of active-filter chips with "Clear all" and the result count.
 */
export function TransactionFilters({
  values,
  accounts,
  categories,
  monthLabel,
  resultCount,
  onChange,
}: {
  values: TxnFilterValues;
  accounts: Account[];
  categories: Category[];
  monthLabel: string;
  resultCount: number | null;
  onChange: (patch: TxnFilterPatch) => void;
}) {
  const color = useCategoryColor();

  // Debounced search; local text re-syncs when the URL value changes from elsewhere (e.g. Clear all).
  const [text, setText] = useState(values.q ?? "");
  const [syncedQ, setSyncedQ] = useState(values.q ?? "");
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  if ((values.q ?? "") !== syncedQ) {
    setSyncedQ(values.q ?? "");
    if (pendingQ === null || pendingQ !== (values.q ?? "")) setText(values.q ?? "");
    setPendingQ(null);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onSearch(v: string) {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPendingQ(v.trim());
      onChange({ q: v.trim() || null });
    }, 300);
  }
  function clearAll() {
    setText("");
    if (timer.current) clearTimeout(timer.current);
    onChange(CLEAR_ALL);
  }

  const rangeOptions = useMemo<DropdownOption[]>(
    () => [
      { value: "month", label: monthLabel, description: "Follows the period selector" },
      { value: "90d", label: "Last 90 days" },
      { value: "year", label: "This year" },
      { value: "all", label: "All time" },
      { value: "custom", label: "Custom range" },
    ],
    [monthLabel],
  );

  const accountOptions = useMemo<DropdownOption[]>(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: a.name,
        description: [a.institution, a.last4 ? `ending ${a.last4}` : null].filter(Boolean).join(", ") || undefined,
      })),
    [accounts],
  );

  const categoryOptions = useMemo<DropdownOption[]>(
    () =>
      categories
        .filter((c) => !c.archived && (!values.type || values.type === "transfer" || c.kind === values.type))
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "expense" ? -1 : 1))
        .map((c) => ({
          value: c.id,
          label: c.name,
          group: GROUP_LABEL[c.group] ?? c.group,
          icon: <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color(c) }} />,
        })),
    [categories, values.type, color],
  );

  // Active filter chips (the default month range is not a "filter").
  const chips: { key: string; label: string; clear: TxnFilterPatch }[] = [];
  if (values.q) chips.push({ key: "q", label: `Search: ${values.q}`, clear: { q: null } });
  if (values.range !== "month") chips.push({ key: "range", label: rangeLabel(values, monthLabel), clear: { range: null, from: null, to: null } });
  if (values.accountId)
    chips.push({ key: "acc", label: `Account: ${accounts.find((a) => a.id === values.accountId)?.name ?? "Archived account"}`, clear: { accountId: null } });
  if (values.categoryId)
    chips.push({
      key: "cat",
      label: `Category: ${categories.find((c) => c.id === values.categoryId)?.name ?? "Unknown"}`,
      clear: { categoryId: null },
    });
  if (values.type) chips.push({ key: "type", label: `Type: ${TYPE_OPTIONS.find((o) => o.value === values.type)?.label}`, clear: { type: null } });

  return (
    <div className="mb-4 flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2" role="search" aria-label="Filter transactions">
        <div className="relative w-full min-w-0 sm:w-64">
          <label htmlFor="txn-search" className="sr-only">
            Search merchant or note
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            id="txn-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Search merchant or note"
            value={text}
            onChange={(e) => onSearch(e.target.value)}
            className={cn(inputClasses, "h-8 pl-8 pointer-coarse:h-11")}
          />
        </div>
        <Dropdown
          appearance="chip"
          aria-label="Date range"
          options={rangeOptions}
          value={values.range}
          onChange={(v) => {
            const r = v as RangeMode;
            onChange({ range: r === "month" ? null : r, ...(r !== "custom" ? { from: null, to: null } : {}) });
          }}
        />
        <Dropdown
          appearance="chip"
          aria-label="Account"
          options={accountOptions}
          value={values.accountId ?? ""}
          placeholder="All accounts"
          clearLabel="All accounts"
          onChange={(v) => onChange({ accountId: v || null })}
        />
        {values.type !== "transfer" ? (
          <Dropdown
            appearance="chip"
            aria-label="Category"
            options={categoryOptions}
            value={values.categoryId ?? ""}
            placeholder="All categories"
            clearLabel="All categories"
            onChange={(v) => onChange({ categoryId: v || null })}
          />
        ) : null}
        <Dropdown
          appearance="chip"
          aria-label="Type"
          options={TYPE_OPTIONS}
          value={values.type ?? ""}
          placeholder="All types"
          clearLabel="All types"
          onChange={(v) => {
            const cat = categories.find((c) => c.id === values.categoryId);
            const dropCat = Boolean(v && cat && (v === "transfer" || cat.kind !== v));
            onChange({ type: v || null, ...(dropCat ? { categoryId: null } : {}) });
          }}
        />
        {resultCount !== null ? (
          <p className="tabular ml-auto hidden text-meta text-ink-2 md:block" aria-live="polite">
            {resultCount.toLocaleString("en-US")} {resultCount === 1 ? "result" : "results"}
          </p>
        ) : null}
      </div>

      {values.range === "custom" ? (
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:max-w-sm">
          <DateField label="From" value={values.from ?? null} max={values.to} onChange={(d) => onChange({ from: d })} />
          <DateField label="To" value={values.to ?? null} min={values.from} onChange={(d) => onChange({ to: d })} />
        </div>
      ) : null}

      {chips.length > 0 || resultCount !== null ? (
        <div className={cn("flex min-w-0 flex-wrap items-center gap-2", chips.length === 0 && "md:hidden")}>
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-chip border border-line bg-surface-2 pr-0.5 pl-2 text-xs font-medium text-ink"
            >
              <span className="truncate">{c.label}</span>
              <button
                type="button"
                onClick={() => {
                  if (c.key === "q") {
                    setText("");
                    if (timer.current) clearTimeout(timer.current);
                  }
                  onChange(c.clear);
                }}
                aria-label={`Remove filter ${c.label}`}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-chip text-ink-2 hover:bg-line hover:text-ink"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          {chips.length > 0 ? (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={clearAll}>
              Clear all
            </Button>
          ) : null}
          {resultCount !== null ? (
            <p className="tabular ml-auto text-xs text-ink-2 md:hidden">
              {resultCount.toLocaleString("en-US")} {resultCount === 1 ? "result" : "results"}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
