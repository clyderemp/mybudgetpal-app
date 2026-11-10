"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { addMonths, currentMonth, monthRange, todayISO } from "@/lib/dates";
import type {
  ExploreFlow,
  ExploreGranularity,
  ExploreGroupBy,
  ExploreParams,
} from "@/lib/types";

/** Insights filters live in the URL so a view can be bookmarked, shared and survives reloads. */

export const RANGE_PRESETS = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "ytd", label: "This year" },
  { value: "last-year", label: "Last year" },
  { value: "custom", label: "Custom dates" },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]["value"];

export const VIEWS = [
  "overview",
  "trends",
  "breakdown",
  "patterns",
  "forecast",
  "health",
] as const;
export type InsightsView = (typeof VIEWS)[number];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const GRANS: ExploreGranularity[] = ["day", "week", "month"];
const GROUPS: ExploreGroupBy[] = [
  "category",
  "group",
  "account",
  "member",
  "merchant",
  "weekday",
];

export function presetRange(
  preset: RangePreset,
  today = todayISO(),
): [string, string] {
  const month = currentMonth();
  const year = today.slice(0, 4);
  switch (preset) {
    case "this-month":
      return [monthRange(month)[0], today];
    case "last-month":
      return monthRange(addMonths(month, -1));
    case "3m":
      return [monthRange(addMonths(month, -2))[0], today];
    case "6m":
      return [monthRange(addMonths(month, -5))[0], today];
    case "ytd":
      return [`${year}-01-01`, today];
    case "last-year":
      return [`${Number(year) - 1}-01-01`, `${Number(year) - 1}-12-31`];
    case "12m":
    case "custom":
    default:
      return [monthRange(addMonths(month, -11))[0], today];
  }
}

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

export interface ExploreFilters {
  view: InsightsView;
  preset: RangePreset;
  from: string;
  to: string;
  flow: ExploreFlow;
  granularity: ExploreGranularity | undefined;
  groupBy: ExploreGroupBy;
  categories: string[];
  accounts: string[];
  members: string[];
  merchant: string;
  /** Number of active narrowing filters (categories, accounts, members, merchant). */
  activeCount: number;
  params: ExploreParams;
  set: (
    patch: Partial<
      Record<
        | "view"
        | "range"
        | "from"
        | "to"
        | "flow"
        | "int"
        | "by"
        | "cat"
        | "acct"
        | "who"
        | "q",
        string | string[] | null
      >
    >,
  ) => void;
  clearNarrowing: () => void;
}

export function useExploreFilters(): ExploreFilters {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const set = useCallback<ExploreFilters["set"]>(
    (patch) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        const s = Array.isArray(v) ? v.join(",") : v;
        if (s == null || s === "") next.delete(k);
        else next.set(k, s);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );

  return useMemo(() => {
    const rawView = sp.get("view");
    const view = (VIEWS as readonly string[]).includes(rawView ?? "")
      ? (rawView as InsightsView)
      : "overview";
    const rawPreset = sp.get("range");
    const preset = (
      RANGE_PRESETS.some((p) => p.value === rawPreset) ? rawPreset : "6m"
    ) as RangePreset;
    let [from, to] = presetRange(preset);
    if (preset === "custom") {
      const f = sp.get("from");
      const t = sp.get("to");
      if (f && ISO.test(f)) from = f;
      if (t && ISO.test(t)) to = t;
      if (from > to) [from, to] = [to, from];
    }
    const flow: ExploreFlow =
      sp.get("flow") === "income" ? "income" : "expense";
    const rawInt = sp.get("int") as ExploreGranularity | null;
    const granularity = rawInt && GRANS.includes(rawInt) ? rawInt : undefined;
    const rawBy = sp.get("by") as ExploreGroupBy | null;
    const groupBy = rawBy && GROUPS.includes(rawBy) ? rawBy : "category";
    const categories = list(sp.get("cat"));
    const accounts = list(sp.get("acct"));
    const members = list(sp.get("who"));
    const merchant = sp.get("q") ?? "";
    const activeCount =
      (categories.length ? 1 : 0) +
      (accounts.length ? 1 : 0) +
      (members.length ? 1 : 0) +
      (merchant ? 1 : 0);
    return {
      view,
      preset,
      from,
      to,
      flow,
      granularity,
      groupBy,
      categories,
      accounts,
      members,
      merchant,
      activeCount,
      params: {
        from,
        to,
        flow,
        granularity,
        groupBy,
        categories,
        accounts,
        members,
        merchant,
        horizon: 3,
      },
      set,
      clearNarrowing: () => set({ cat: null, acct: null, who: null, q: null }),
    };
  }, [sp, set]);
}
