"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTransactionDialog } from "@/components/transactions/TransactionDialogProvider";
import { AccountFormDialog } from "@/features/accounts/AccountFormDialog";
import { DebtFormDialog } from "@/features/plan/DebtFormDialog";
import { GoalFormDialog } from "@/features/plan/GoalFormDialog";

export type CreateKind = "transaction" | "account" | "debt" | "goal";

const CreateContext = createContext<((kind: CreateKind) => void) | null>(null);

/**
 * Global "New …" actions (top bar New menu, command palette, FAB). Mount inside
 * TransactionDialogProvider. Pages may call `useCreate()("debt")` etc.
 */
export function CreateProvider({ children }: { children: ReactNode }) {
  const { openCreate } = useTransactionDialog();
  const [accountOpen, setAccountOpen] = useState(false);
  const [debtOpen, setDebtOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  const create = useCallback(
    (kind: CreateKind) => {
      if (kind === "transaction") openCreate();
      else if (kind === "account") setAccountOpen(true);
      else if (kind === "debt") setDebtOpen(true);
      else setGoalOpen(true);
    },
    [openCreate],
  );
  const value = useMemo(() => create, [create]);

  return (
    <CreateContext.Provider value={value}>
      {children}
      <AccountFormDialog open={accountOpen} onOpenChange={setAccountOpen} account={null} />
      {debtOpen ? <DebtFormDialog debt={null} onClose={() => setDebtOpen(false)} /> : null}
      {goalOpen ? <GoalFormDialog goal={null} onClose={() => setGoalOpen(false)} /> : null}
    </CreateContext.Provider>
  );
}

export function useCreate() {
  const ctx = useContext(CreateContext);
  if (!ctx) throw new Error("useCreate must be used inside CreateProvider");
  return ctx;
}
