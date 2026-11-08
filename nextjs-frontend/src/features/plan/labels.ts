import type { DebtKind } from "@/lib/types";

export const DEBT_KIND_LABEL: Record<DebtKind, string> = {
  credit_card: "Credit card",
  personal_loan: "Personal loan",
  car_loan: "Car loan",
  mortgage: "Mortgage",
  bnpl: "Buy now, pay later",
  other: "Other",
};

export const DEBT_KIND_OPTIONS = (Object.keys(DEBT_KIND_LABEL) as DebtKind[]).map((k) => ({
  value: k,
  label: DEBT_KIND_LABEL[k],
}));

/** 1 → "1st", 22 → "22nd". */
export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** Percent string ("29.99") → basis points (2999), or null if invalid. */
export function percentToBps(input: string): number | null {
  const s = input.trim().replace(/%$/, "");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  return Number(w) * 100 + Number((f + "00").slice(0, 2));
}

export function bpsToPercentInput(bps: number) {
  return (bps / 100).toFixed(2).replace(/\.00$/, "");
}

export const PRIORITY_OPTIONS = [1, 2, 3, 4, 5].map((p) => ({
  value: String(p),
  label: p === 1 ? "1 — Highest" : p === 5 ? "5 — Lowest" : String(p),
}));

/** Next due date (YYYY-MM-DD) for a monthly due day, counting today as due. */
export function nextDueDate(dueDay: number, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  let year = y;
  let month = m;
  if (d > dueDay) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Approximate interest charged this month on a balance at an APR in basis points. */
export function monthlyInterestFils(balanceFils: number, aprBps: number): number {
  return Math.round((balanceFils * aprBps) / 10000 / 12);
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
