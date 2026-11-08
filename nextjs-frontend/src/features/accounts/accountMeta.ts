import { Banknote, CreditCard, Landmark, LineChart, PiggyBank, Wallet, type LucideIcon } from "lucide-react";
import type { AccountType } from "@/lib/types";

export const ACCOUNT_TYPES: AccountType[] = ["bank", "savings", "credit_card", "cash", "loan", "investment"];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  bank: "Bank",
  savings: "Savings",
  credit_card: "Credit card",
  cash: "Cash",
  loan: "Loan",
  investment: "Investment",
};

/** Plural headings for the grouped accounts table. */
export const ACCOUNT_GROUP_LABEL: Record<AccountType, string> = {
  bank: "Bank accounts",
  savings: "Savings",
  credit_card: "Credit cards",
  cash: "Cash",
  loan: "Loans",
  investment: "Investments",
};

export const ACCOUNT_TYPE_ICON: Record<AccountType, LucideIcon> = {
  bank: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  cash: Banknote,
  loan: Wallet,
  investment: LineChart,
};

/** Liability types: a negative balance is debt (shown red). */
export function isLiability(t: AccountType) {
  return t === "credit_card" || t === "loan";
}

/** "ending 1234" or null. */
export function last4Label(last4: string | null | undefined) {
  return last4 ? `ending ${last4}` : null;
}
