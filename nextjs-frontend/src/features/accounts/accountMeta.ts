import { Banknote, CreditCard, Landmark, LineChart, PiggyBank, Wallet, type LucideIcon } from "lucide-react";
import type { Account, AccountType } from "@/lib/types";

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

/** Business accounts (e.g. Sessions DXB) hold money that isn't the household's. */
export function isBusiness(a: Pick<Account, "purpose"> | null | undefined) {
  return a?.purpose === "business";
}

/**
 * Dropdown `group` for account pickers: business accounts get their own "Business" section.
 * Returns undefined (no headings at all) when the household has no business accounts.
 */
export function accountPickerGroup(a: Account, all: Account[]): string | undefined {
  if (!all.some(isBusiness)) return undefined;
  return isBusiness(a) ? "Business" : "Household";
}

/** Household accounts first, business accounts after (stable within each). */
export function householdFirst<T extends Pick<Account, "purpose">>(list: T[]): T[] {
  return [...list.filter((a) => !isBusiness(a)), ...list.filter(isBusiness)];
}

/** Synthetic insights category for money moved to/from a business account: "business:<accountId>". */
export const BUSINESS_CATEGORY_PREFIX = "business:";

/** "To Sessions DXB" / "From Sessions DXB" for a synthetic business category id, else null. */
export function businessCategoryLabel(
  categoryId: string | null | undefined,
  accounts: Account[],
  direction: "to" | "from" = "to",
): string | null {
  if (!categoryId?.startsWith(BUSINESS_CATEGORY_PREFIX)) return null;
  const name = accounts.find((a) => a.id === categoryId.slice(BUSINESS_CATEGORY_PREFIX.length))?.name ?? "business account";
  return `${direction === "to" ? "To" : "From"} ${name}`;
}

/** "ending 1234" or null. */
export function last4Label(last4: string | null | undefined) {
  return last4 ? `ending ${last4}` : null;
}
