import type { BadgeTone } from "@/components/ui/Badge";
import { formatDate } from "@/lib/dates";
import type { BillCadence, BillKind, BillStatus, IncomeKind, IncomeStatus } from "@/lib/types";
import { ordinal } from "@/features/plan/labels";

export const BILL_KIND_LABEL: Record<BillKind, string> = {
  bill: "Bill",
  subscription: "Subscription",
  loan: "Loan",
  bnpl: "Buy now, pay later",
  debt_payment: "Debt payment",
  savings: "Savings",
  other: "Other",
};

/** Short plural labels for grouped totals. */
export const BILL_KIND_GROUP: Record<BillKind, string> = {
  bill: "Bills",
  subscription: "Subscriptions",
  loan: "Loans",
  bnpl: "Tabby, Tamara and other instalments",
  debt_payment: "Debt payments",
  savings: "Savings",
  other: "Other",
};

export const BILL_KIND_OPTIONS = (Object.keys(BILL_KIND_LABEL) as BillKind[]).map((k) => ({ value: k, label: BILL_KIND_LABEL[k] }));

export const CADENCE_LABEL: Record<BillCadence, string> = { monthly: "Monthly", quarterly: "Every 3 months", yearly: "Yearly" };
export const CADENCE_OPTIONS = (Object.keys(CADENCE_LABEL) as BillCadence[]).map((k) => ({ value: k, label: CADENCE_LABEL[k] }));

export const INCOME_KIND_LABEL: Record<IncomeKind, string> = {
  salary: "Salary",
  cash_deposit: "Cash deposit",
  transfer: "Transfer",
  other: "Other",
};
export const INCOME_KIND_OPTIONS = (Object.keys(INCOME_KIND_LABEL) as IncomeKind[]).map((k) => ({ value: k, label: INCOME_KIND_LABEL[k] }));

export const BILL_STATUS: Record<BillStatus, { label: string; tone: BadgeTone }> = {
  paid: { label: "Paid", tone: "accent" },
  overdue: { label: "Overdue", tone: "danger" },
  due_soon: { label: "Due soon", tone: "warn" },
  upcoming: { label: "Upcoming", tone: "neutral" },
  skipped: { label: "Skipped", tone: "outline" },
};

export const INCOME_STATUS: Record<IncomeStatus, { label: string; tone: BadgeTone }> = {
  received: { label: "Received", tone: "accent" },
  overdue: { label: "Late", tone: "warn" },
  due_soon: { label: "Expected now", tone: "neutral" },
  upcoming: { label: "Expected", tone: "outline" },
};

/** "4th" or "4th to 7th". */
export function dayRange(from: number, to: number): string {
  return from === to ? ordinal(from) : `${ordinal(from)} to ${ordinal(to)}`;
}

/** "14 Nov" or "4 to 7 Nov". */
export function dateRange(from: string, to: string): string {
  if (from === to) return formatDate(from, true);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8, 10))} to ${formatDate(to, true)}`;
  return `${formatDate(from, true)} to ${formatDate(to, true)}`;
}

/** Monthly-equivalent and yearly totals for a monthly amount. */
export function yearly(monthlyFils: number) {
  return monthlyFils * 12;
}
