"use client";
import { useMemo } from "react";
import { useAccounts, useCategories } from "@/lib/queries";
import type { TxnLookups } from "./format";

/** Id → account/category maps for rendering transaction rows. */
export function useTxnLookups() {
  const accountsQ = useAccounts();
  const categoriesQ = useCategories();
  const lookups = useMemo<TxnLookups>(
    () => ({
      accounts: new Map((accountsQ.data ?? []).map((a) => [a.id, a])),
      categories: new Map((categoriesQ.data ?? []).map((c) => [c.id, c])),
    }),
    [accountsQ.data, categoriesQ.data],
  );
  return { lookups, accountsQ, categoriesQ };
}
