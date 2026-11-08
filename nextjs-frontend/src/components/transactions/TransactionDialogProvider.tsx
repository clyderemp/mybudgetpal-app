"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Transaction, TransactionCreate } from "@/lib/types";
import { TransactionFormDialog } from "./TransactionFormDialog";

interface Ctx {
  /** Open the add-transaction dialog, optionally prefilled. */
  openCreate: (defaults?: Partial<TransactionCreate>) => void;
  /** Open the dialog in edit mode. */
  openEdit: (txn: Transaction) => void;
}

const TransactionDialogContext = createContext<Ctx | null>(null);

/** Mounted once in the (app) layout; any page can call useTransactionDialog(). */
export function TransactionDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [defaults, setDefaults] = useState<Partial<TransactionCreate> | undefined>();

  const openCreate = useCallback((d?: Partial<TransactionCreate>) => {
    setTxn(null);
    setDefaults(d);
    setOpen(true);
  }, []);
  const openEdit = useCallback((t: Transaction) => {
    setTxn(t);
    setDefaults(undefined);
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ openCreate, openEdit }), [openCreate, openEdit]);

  return (
    <TransactionDialogContext.Provider value={value}>
      {children}
      <TransactionFormDialog open={open} onOpenChange={setOpen} transaction={txn} defaults={defaults} />
    </TransactionDialogContext.Provider>
  );
}

export function useTransactionDialog(): Ctx {
  const ctx = useContext(TransactionDialogContext);
  if (!ctx) throw new Error("useTransactionDialog must be used inside TransactionDialogProvider");
  return ctx;
}
