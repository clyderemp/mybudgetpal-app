"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { FormDialog, FormGrid } from "@/components/ui/FormDialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { notify } from "@/components/ui/notify";
import { applyApiErrors } from "@/lib/form-errors";
import { useAccounts, useCreateDebt, useUpdateDebt } from "@/lib/queries";
import type { Debt, DebtCreate } from "@/lib/types";
import { bpsToPercentInput, DEBT_KIND_OPTIONS, percentToBps } from "./labels";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80, "Max 80 characters"),
  kind: z.enum(["credit_card", "personal_loan", "car_loan", "mortgage", "bnpl", "other"]),
  balanceFils: z.number({ error: "Enter the balance" }).int().min(0, "Balance can't be negative"),
  apr: z
    .string()
    .trim()
    .refine((v) => percentToBps(v) !== null, "Enter a rate like 29.99")
    .refine((v) => (percentToBps(v) ?? 0) <= 10000, "Max 100%"),
  minPaymentFils: z.number({ error: "Enter the minimum payment" }).int().min(0, "Can't be negative"),
  dueDay: z.number({ error: "Enter a day 1–28" }).int("Whole day only").min(1, "Day 1–28").max(28, "Day 1–28"),
  accountId: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** Starting values for a new debt, e.g. from a credit card account that isn't tracked yet. */
export interface DebtPrefill {
  name: string;
  kind: Debt["kind"];
  balanceFils: number;
  accountId: string;
}

export function DebtFormDialog({ debt, prefill, onClose }: { debt: Debt | null; prefill?: DebtPrefill; onClose: () => void }) {
  const accounts = useAccounts();
  const createM = useCreateDebt();
  const updateM = useUpdateDebt();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: debt
      ? {
          name: debt.name,
          kind: debt.kind,
          balanceFils: debt.balanceFils,
          apr: bpsToPercentInput(debt.aprBps),
          minPaymentFils: debt.minPaymentFils,
          dueDay: debt.dueDay,
          accountId: debt.accountId ?? "",
        }
      : {
          name: prefill?.name ?? "",
          kind: prefill?.kind ?? "credit_card",
          balanceFils: prefill?.balanceFils ?? (undefined as unknown as number),
          apr: "",
          minPaymentFils: undefined as unknown as number,
          dueDay: 1,
          accountId: prefill?.accountId ?? "",
        },
  });

  const onSubmit = handleSubmit(async (v) => {
    const body: DebtCreate = {
      name: v.name,
      kind: v.kind,
      balanceFils: v.balanceFils,
      aprBps: percentToBps(v.apr) ?? 0,
      minPaymentFils: v.minPaymentFils,
      dueDay: v.dueDay,
      accountId: v.accountId || null,
    };
    try {
      if (debt) await updateM.mutateAsync({ id: debt.id, ...body });
      else await createM.mutateAsync(body);
      notify.success(debt ? "Debt updated" : "Debt added");
      onClose();
    } catch (err) {
      const msg = applyApiErrors(err, setError, ["name", "kind", "balanceFils", "minPaymentFils", "dueDay", "accountId"]);
      if (msg) notify.error(err, "Couldn't save debt");
    }
  });

  const accountOptions = (accounts.data ?? []).map((a) => ({ value: a.id, label: a.name, description: a.institution ?? undefined }));

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={debt ? "Edit debt" : "Add debt"}
      onSubmit={onSubmit}
      submitLabel={debt ? "Save debt" : "Add debt"}
      submitting={createM.isPending || updateM.isPending}
    >
      <FormGrid>
        <Field label="Name" htmlFor="debt-name" error={errors.name?.message} required className="md:col-span-2">
          <Input id="debt-name" autoComplete="off" placeholder="e.g. Mashreq credit card" invalid={!!errors.name} {...register("name")} />
        </Field>
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Dropdown label="Type" options={DEBT_KIND_OPTIONS} value={field.value} onChange={field.onChange} error={errors.kind?.message} />
          )}
        />
        <Controller
          control={control}
          name="balanceFils"
          render={({ field }) => (
            <MoneyInput label="Current balance" required value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors.balanceFils?.message} />
          )}
        />
        <Field label="Interest rate (APR %)" htmlFor="debt-apr" error={errors.apr?.message} hint="Annual rate, e.g. 29.99" required>
          <Input id="debt-apr" inputMode="decimal" autoComplete="off" placeholder="0.00" className="tabular" invalid={!!errors.apr} {...register("apr")} />
        </Field>
        <Controller
          control={control}
          name="minPaymentFils"
          render={({ field }) => (
            <MoneyInput label="Minimum payment" required value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors.minPaymentFils?.message} />
          )}
        />
        <Field label="Due day of month" htmlFor="debt-due" error={errors.dueDay?.message} hint="1–28" required>
          <Input id="debt-due" type="number" inputMode="numeric" min={1} max={28} className="tabular" invalid={!!errors.dueDay} {...register("dueDay", { valueAsNumber: true })} />
        </Field>
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <Dropdown label="Linked account" options={accountOptions} value={field.value} onChange={field.onChange} clearLabel="None" placeholder="None" />
          )}
        />
      </FormGrid>
    </FormDialog>
  );
}
