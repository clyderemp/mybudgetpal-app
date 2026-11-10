"use client";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  DateField,
  Dropdown,
  SegmentedControl,
  type DropdownOption,
} from "@/components/ui";
import { inputClasses } from "@/components/ui/Field";
import { useCategoryColor } from "@/features/transactions/CategoryDot";
import { formatDate, todayISO } from "@/lib/dates";
import { useAccounts, useCategories, useMe } from "@/lib/queries";
import type { ExploreFlow } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  RANGE_PRESETS,
  type ExploreFilters,
  type RangePreset,
} from "./filters";

/**
 * One filter bar for every Insights view: range, spending vs income, and narrowing by category,
 * account, person and merchant. Active narrowing shows as removable chips underneath.
 */
export function FilterBar({ f }: { f: ExploreFilters }) {
  const categories = useCategories();
  const accounts = useAccounts();
  const me = useMe();
  const color = useCategoryColor();
  const [q, setQ] = useState(f.merchant);
  const [open, setOpen] = useState(false);
  // Follow outside changes (chip removed, merchant clicked elsewhere) without an effect.
  const [seen, setSeen] = useState(f.merchant);
  if (seen !== f.merchant) {
    setSeen(f.merchant);
    setQ(f.merchant);
  }
  useEffect(() => {
    if (q === f.merchant) return;
    const id = setTimeout(() => f.set({ q: q.trim() || null }), 350);
    return () => clearTimeout(id);
  }, [q, f]);

  const catOptions = useMemo<DropdownOption[]>(() => {
    const kind = f.flow === "income" ? "income" : "expense";
    const rows = (categories.data ?? []).filter(
      (c) => !c.archived && c.kind === kind,
    );
    return [
      ...rows.map((c) => ({
        value: c.id,
        label: c.name,
        icon: (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color(c) }}
          />
        ),
      })),
      { value: "none", label: "Uncategorised" },
    ];
  }, [categories.data, f.flow, color]);
  const acctOptions = useMemo<DropdownOption[]>(
    () =>
      (accounts.data ?? [])
        .filter((a) => !a.archived)
        .map((a) => ({ value: a.id, label: a.name })),
    [accounts.data],
  );
  const members = me.data?.household.members ?? [];
  const memberOptions: DropdownOption[] = members.map((m) => ({
    value: m.id,
    label: m.name,
  }));

  const name = (opts: DropdownOption[], ids: string[]) =>
    ids.map((id) => opts.find((o) => o.value === id)?.label ?? "Unknown");
  const chips: {
    key: string;
    label: string;
    clear: Parameters<ExploreFilters["set"]>[0];
  }[] = [];
  if (f.categories.length)
    chips.push({
      key: "cat",
      label: summarise("Category", name(catOptions, f.categories)),
      clear: { cat: null },
    });
  if (f.accounts.length)
    chips.push({
      key: "acct",
      label: summarise("Account", name(acctOptions, f.accounts)),
      clear: { acct: null },
    });
  if (f.members.length)
    chips.push({
      key: "who",
      label: summarise("Added by", name(memberOptions, f.members)),
      clear: { who: null },
    });
  if (f.merchant)
    chips.push({
      key: "q",
      label: `Merchant: ${f.merchant}`,
      clear: { q: null },
    });

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div
        className="flex min-w-0 flex-wrap items-center gap-2"
        role="search"
        aria-label="Filter insights"
      >
        <SegmentedControl<ExploreFlow>
          size="sm"
          aria-label="Measure"
          value={f.flow}
          onChange={(v) =>
            f.set({ flow: v === "expense" ? null : v, cat: null })
          }
          options={[
            { value: "expense", label: "Spending" },
            { value: "income", label: "Income" },
          ]}
        />
        <Dropdown
          appearance="chip"
          aria-label="Date range"
          options={RANGE_PRESETS.map((p) => ({
            value: p.value,
            label: p.label,
          }))}
          value={f.preset}
          onChange={(v) => {
            const preset = v as RangePreset;
            f.set(
              preset === "custom"
                ? { range: preset, from: f.from, to: f.to }
                : {
                    range: preset === "6m" ? null : preset,
                    from: null,
                    to: null,
                  },
            );
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="sm:hidden"
          aria-expanded={open}
          aria-controls="insights-more-filters"
          onClick={() => setOpen((o) => !o)}
        >
          <SlidersHorizontal /> Filters
          {f.activeCount ? ` (${f.activeCount})` : ""}
        </Button>
        <div
          id="insights-more-filters"
          className={cn(
            "w-full flex-wrap items-center gap-2 sm:contents",
            open ? "flex" : "hidden",
          )}
        >
          <Dropdown
            appearance="chip"
            multiple
            aria-label="Categories"
            placeholder="All categories"
            options={catOptions}
            value={f.categories}
            onChange={(v) => f.set({ cat: v })}
          />
          <Dropdown
            appearance="chip"
            multiple
            aria-label="Accounts"
            placeholder="All accounts"
            options={acctOptions}
            value={f.accounts}
            onChange={(v) => f.set({ acct: v })}
          />
          {memberOptions.length > 1 ? (
            <Dropdown
              appearance="chip"
              multiple
              aria-label="Added by"
              placeholder="Everyone"
              options={memberOptions}
              value={f.members}
              onChange={(v) => f.set({ who: v })}
            />
          ) : null}
          <div className="relative w-full min-w-0 sm:w-52">
            <label htmlFor="insights-merchant" className="sr-only">
              Filter by merchant
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3"
              aria-hidden
            />
            <input
              id="insights-merchant"
              type="search"
              value={q}
              placeholder="Merchant"
              onChange={(e) => setQ(e.target.value)}
              className={cn(inputClasses, "h-8 pl-8 pointer-coarse:h-11")}
            />
          </div>
        </div>
      </div>

      {f.preset === "custom" ? (
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:max-w-sm">
          <DateField
            label="From"
            value={f.from}
            max={f.to}
            onChange={(v) => v && f.set({ from: v })}
          />
          <DateField
            label="To"
            value={f.to}
            min={f.from}
            max={todayISO()}
            onChange={(v) => v && f.set({ to: v })}
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-ink-2">
        <span className="tabular">
          {formatDate(f.from, true)} to {formatDate(f.to)}
        </span>
        {chips.map((c) => (
          <span
            key={c.key}
            className="inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-chip border border-line bg-surface-2 pr-0.5 pl-2 font-medium text-ink"
          >
            <span className="truncate">{c.label}</span>
            <button
              type="button"
              aria-label={`Remove filter: ${c.label}`}
              onClick={() => f.set(c.clear)}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-chip text-ink-2 hover:bg-line hover:text-ink pointer-coarse:size-7"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        {chips.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={f.clearNarrowing}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function summarise(prefix: string, names: string[]) {
  if (names.length <= 2) return `${prefix}: ${names.join(", ")}`;
  return `${prefix}: ${names[0]} +${names.length - 1}`;
}
