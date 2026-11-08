"use client";
import { Plus } from "lucide-react";
import { useTransactionDialog } from "@/components/transactions/TransactionDialogProvider";

/** Floating add button on phones; opens the shared TransactionFormDialog. */
export function AddTransactionFab() {
  const { openCreate } = useTransactionDialog();
  return (
    <button
      type="button"
      onClick={() => openCreate()}
      aria-label="New transaction"
      className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex size-12 items-center justify-center rounded-full bg-ink text-ink-fg shadow-pop transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 md:hidden"
    >
      <Plus className="size-5" aria-hidden />
    </button>
  );
}
