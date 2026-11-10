import type { Account, Category, Transaction } from "@/lib/types";
import { formatFils } from "@/lib/money";

export interface TxnLookups {
  accounts: Map<string, Account>;
  categories: Map<string, Category>;
}

/**
 * Transfers crossing the household/business line count as household money (spec: business → household
 * = income "From <business>", household → business = spending "To <business>"). Null otherwise.
 */
export function businessFlow(t: Transaction, l: TxnLookups): { dir: "from" | "to"; account: Account } | null {
  if (t.type !== "transfer" || !t.toAccountId) return null;
  const src = l.accounts.get(t.accountId);
  const dst = l.accounts.get(t.toAccountId);
  const srcBiz = src?.purpose === "business";
  const dstBiz = dst?.purpose === "business";
  if (srcBiz && dst && !dstBiz) return { dir: "from", account: src };
  if (dstBiz && src && !srcBiz) return { dir: "to", account: dst };
  return null;
}

export function txnTitle(t: Transaction, l: TxnLookups): string {
  if (t.merchant) return t.merchant;
  const biz = businessFlow(t, l);
  if (biz) return `${biz.dir === "from" ? "From" : "To"} ${biz.account.name}`;
  if (t.type === "transfer") return "Transfer";
  return (t.categoryId && l.categories.get(t.categoryId)?.name) || (t.type === "income" ? "Income" : "Expense");
}

export function txnCategory(t: Transaction, l: TxnLookups): string {
  const biz = businessFlow(t, l);
  if (biz) return biz.dir === "from" ? "Household income" : "Household spending";
  if (t.type === "transfer") return "Transfer";
  if (!t.categoryId) return "Uncategorised";
  return l.categories.get(t.categoryId)?.name ?? "Unknown category";
}

export function accountName(id: string | null | undefined, l: TxnLookups): string {
  if (!id) return "—";
  return l.accounts.get(id)?.name ?? "Archived account";
}

/** Plain-text account label; transfers read "From A to B". */
export function txnAccountLabel(t: Transaction, l: TxnLookups): string {
  if (t.type === "transfer") return `${accountName(t.accountId, l)} to ${accountName(t.toAccountId, l)}`;
  return accountName(t.accountId, l);
}

export function txnCurrency(t: Transaction, l: TxnLookups): string {
  return l.accounts.get(t.accountId)?.currency ?? "AED";
}

/** Money flow for <Money flow>: income in (accent, "+"), expense out (ink, "−"), transfer neutral. */
export function txnFlow(t: Transaction): "in" | "out" | "neutral" {
  return t.type === "income" ? "in" : t.type === "expense" ? "out" : "neutral";
}

/** Signed plain-text amount (for aria labels / non-visual use). */
export function txnAmount(t: Transaction, l: TxnLookups): string {
  const cur = txnCurrency(t, l);
  if (t.type === "income") return formatFils(t.amountFils, cur, { signed: true });
  if (t.type === "expense") return formatFils(-t.amountFils, cur);
  return formatFils(t.amountFils, cur);
}

export const TYPE_LABEL: Record<Transaction["type"], string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
};

/** In / out / net over a set of transactions (AED only; transfers excluded). */
export function txnTotals(rows: Transaction[], l: TxnLookups) {
  let inFils = 0;
  let outFils = 0;
  let foreign = 0;
  for (const t of rows) {
    if (t.type === "transfer") continue;
    if (txnCurrency(t, l) !== "AED") {
      foreign += 1;
      continue;
    }
    if (t.type === "income") inFils += t.amountFils;
    else outFils += t.amountFils;
  }
  return { inFils, outFils, netFils: inFils - outFils, foreign };
}
