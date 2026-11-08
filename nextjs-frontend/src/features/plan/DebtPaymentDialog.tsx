"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { DateField } from "@/components/ui/DateField";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormDialog } from "@/components/ui/FormDialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { notify } from "@/components/ui/notify";
import { todayISO } from "@/lib/dates";
import { applyApiErrors } from "@/lib/form-errors";
import { formatFils } from "@/lib/money";
import { useAccounts, useDebtPayment } from "@/lib/queries";
import type { Debt } from "@/lib/types";

export function DebtPaymentDialog({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const accounts = useAccounts();
  const payM = useDebtPayment();
  const schema = z.object({
    amountFils: z
      .number({ error: "Enter an amount" })
      .int()
      .positive("Amount must be greater than 0")
      .max(Math.max(debt.balanceFils, 1), `Max is the balance (${formatFils(debt.balanceFils)})`),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    accountId: z.string().min(1, "Choose the account you paid from"),
  });
  type F = z.infer<typeof schema>;

  const payFrom = (accounts.data ?? []).filter((a) => a.type !== "loan" && a.id !== debt.accountId);
  const defaultAccount = payFrom.find((a) => a.type === "bank")?.id ?? payFrom[0]?.id ?? "";

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: {
      amountFils: Math.min(debt.minPaymentFils, debt.balanceFils) || (undefined as unknown as number),
      date: todayISO(),
      accountId: defaultAccount,
    },
  });

  const chosen = useWatch({ control, name: "accountId" });
  useEffect(() => {
    if (!chosen && defaultAccount) setValue("accountId", defaultAccount);
  }, [chosen, defaultAccount, setValue]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await payM.mutateAsync({ id: debt.id, ...v });
      notify.success("Payment recorded", `${formatFils(v.amountFils)} paid to ${debt.name}`);
      onClose();
    } catch (err) {
      const msg = applyApiErrors(err, setError, ["amountFils", "date", "accountId"]);
      if (msg) notify.error(err, "Couldn't record payment");
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Record payment"
      description={`${debt.name}, balance ${formatFils(debt.balanceFils)}. Records a debt payment expense and reduces the balance.`}
      onSubmit={onSubmit}
      submitLabel="Record payment"
      submitting={payM.isPending}
      submitDisabled={accounts.isSuccess && payFrom.length === 0}
    >
      <div className="flex flex-col gap-4">
        <Controller
          control={control}
          name="amountFils"
          render={({ field }) => (
            <MoneyInput label="Amount" required autoFocus value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors.amountFils?.message} />
          )}
        />
        <Controller
          control={control}
          name="date"
          render={({ field }) => <DateField label="Date" required value={field.value} onChange={(d) => field.onChange(d ?? "")} error={errors.date?.message} />}
        />
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <Dropdown
              label="Paid from"
              options={payFrom.map((a) => ({ value: a.id, label: a.name, description: a.institution ?? undefined }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.accountId?.message ?? (accounts.isSuccess && payFrom.length === 0 ? "Add a bank or cash account first" : undefined)}
            />
          )}
        />
      </div>
    </FormDialog>
  );
}
