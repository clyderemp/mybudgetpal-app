"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { addMonths, currentMonth, formatMonth, isMonth, monthRange } from "./dates";

export interface Period {
  /** Selected month "YYYY-MM" (from ?month=, defaults to the current Dubai month). */
  month: string;
  /** Current Dubai month. */
  thisMonth: string;
  isCurrent: boolean;
  /** First/last day of the month: ["2026-11-01", "2026-11-30"]. */
  range: [string, string];
  /** "Nov 2026". */
  label: string;
  /** Updates ?month= (replace, no scroll). Passing the current month removes the param. */
  setMonth: (month: string) => void;
  prev: () => void;
  next: () => void;
  canNext: boolean;
}

const PeriodContext = createContext<Period | null>(null);

function usePeriodState(): Period {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const thisMonth = currentMonth();
  const raw = params.get("month");
  const month = raw && isMonth(raw) && raw <= thisMonth ? raw : thisMonth;

  const setMonth = useCallback(
    (m: string) => {
      const next = new URLSearchParams(params.toString());
      if (!isMonth(m) || m === thisMonth) next.delete("month");
      else next.set("month", m > thisMonth ? thisMonth : m);
      next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, router, pathname, thisMonth],
  );

  return useMemo(
    () => ({
      month,
      thisMonth,
      isCurrent: month === thisMonth,
      range: monthRange(month),
      label: formatMonth(month),
      setMonth,
      prev: () => setMonth(addMonths(month, -1)),
      next: () => setMonth(addMonths(month, 1)),
      canNext: month < thisMonth,
    }),
    [month, thisMonth, setMonth],
  );
}

/** Mounted once by the app shell. */
export function PeriodProvider({ children }: { children: ReactNode }) {
  const value = usePeriodState();
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

/**
 * Global month selected in the top bar (URL ?month=YYYY-MM, shareable). Pages that are
 * month-scoped (Dashboard, Insights, Transactions, Budget) read this instead of keeping their own state.
 */
export function usePeriod(): Period {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod must be used inside the app shell (PeriodProvider)");
  return ctx;
}
