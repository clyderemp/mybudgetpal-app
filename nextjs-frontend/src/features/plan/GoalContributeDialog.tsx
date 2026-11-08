"use client";
import { useState } from "react";
import { FormDialog } from "@/components/ui/FormDialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { notify } from "@/components/ui/notify";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { formatFils } from "@/lib/money";
import { useGoalContribution } from "@/lib/queries";
import type { Goal } from "@/lib/types";

export function GoalContributeDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const m = useGoalContribution();
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const remaining = Math.max(0, goal.targetFils - goal.savedFils);

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={mode === "add" ? `Contribute to ${goal.name}` : `Withdraw from ${goal.name}`}
      description={`Saved ${formatFils(goal.savedFils)} of ${formatFils(goal.targetFils)}`}
      submitLabel={mode === "add" ? "Add contribution" : "Record withdrawal"}
      submitting={m.isPending}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!amount || amount <= 0) return setError("Enter an amount greater than 0");
        if (mode === "withdraw" && amount > goal.savedFils) return setError(`You can withdraw up to ${formatFils(goal.savedFils)}`);
        setError(undefined);
        try {
          await m.mutateAsync({ id: goal.id, amountFils: mode === "add" ? amount : -amount });
          notify.success(mode === "add" ? "Contribution added" : "Withdrawal recorded");
          onClose();
        } catch (err) {
          notify.error(err, "Couldn't update goal");
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <SegmentedControl
          aria-label="Contribution type"
          fullWidth
          value={mode}
          onChange={(v) => {
            setMode(v);
            setError(undefined);
          }}
          options={[
            { value: "add", label: "Contribute" },
            { value: "withdraw", label: "Withdraw", disabled: goal.savedFils <= 0 },
          ]}
        />
        <MoneyInput
          label="Amount"
          required
          autoFocus
          value={amount}
          onChange={setAmount}
          error={error}
          hint={mode === "add" && remaining > 0 ? `${formatFils(remaining)} to go` : undefined}
        />
        <p className="text-xs text-ink-2">This updates the goal&apos;s progress only; it doesn&apos;t move money between accounts.</p>
      </div>
    </FormDialog>
  );
}
