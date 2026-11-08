"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Dropdown, Field, FormDialog, FormGrid, Input, MoneyInput, notify } from "@/components/ui";
import { applyApiErrors } from "@/lib/form-errors";
import { useCreateAccount, useUpdateAccount } from "@/lib/queries";
import type { Account, AccountCreate } from "@/lib/types";
import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES } from "./accountMeta";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80, "Max 80 characters"),
  institution: z.string().trim().max(80, "Max 80 characters").optional(),
  type: z.enum(["bank", "savings", "credit_card", "cash", "loan", "investment"]),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Enter a 3-letter code, such as AED"),
  openingBalanceFils: z.number({ error: "Enter an opening balance" }).int().min(-100_000_000_00).max(100_000_000_00),
  last4: z
    .string()
    .trim()
    .regex(/^(\d{4})?$/, "Exactly 4 digits")
    .optional(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
}) {
  // Remount per opening so defaults re-initialise.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((s) => s + 1);
  }
  return <AccountForm key={session} open={open} onOpenChange={onOpenChange} account={account} />;
}

function AccountForm({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
}) {
  const createM = useCreateAccount();
  const updateM = useUpdateAccount();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: account?.name ?? "",
      institution: account?.institution ?? "",
      type: account?.type ?? "bank",
      currency: account?.currency ?? "AED",
      openingBalanceFils: account?.openingBalanceFils ?? 0,
      last4: account?.last4 ?? "",
    },
  });

  const currency = useWatch({ control, name: "currency" });
  const currencyLabel = /^[A-Za-z]{3}$/.test(currency ?? "") ? currency.toUpperCase() : "AED";

  const onSubmit = handleSubmit(async (v) => {
    const body: AccountCreate = {
      name: v.name,
      institution: v.institution || null,
      type: v.type,
      currency: v.currency,
      openingBalanceFils: v.openingBalanceFils,
      last4: v.last4 || null,
    };
    try {
      if (account) await updateM.mutateAsync({ id: account.id, ...body });
      else await createM.mutateAsync(body);
      notify.success(account ? "Account updated" : "Account added");
      onOpenChange(false);
    } catch (err) {
      const msg = applyApiErrors(err, setError, ["name", "institution", "type", "currency", "openingBalanceFils", "last4"]);
      if (msg) notify.error(err, "Couldn't save account");
    }
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={account ? "Edit account" : "Add account"}
      onSubmit={onSubmit}
      submitLabel={account ? "Save account" : "Add account"}
      submitting={createM.isPending || updateM.isPending}
    >
      <FormGrid>
        <Field label="Name" htmlFor="acc-name" error={errors.name?.message} required>
          <Input id="acc-name" autoComplete="off" placeholder="e.g. Salary account" invalid={Boolean(errors.name)} {...register("name")} />
        </Field>
        <Field label="Institution" htmlFor="acc-inst" error={errors.institution?.message} hint="Optional. The bank or provider.">
          <Input id="acc-inst" autoComplete="off" placeholder="e.g. Emirates NBD" invalid={Boolean(errors.institution)} {...register("institution")} />
        </Field>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Dropdown
              label="Type"
              options={ACCOUNT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABEL[t] }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.type?.message}
            />
          )}
        />
        <Field label="Currency" htmlFor="acc-cur" error={errors.currency?.message}>
          <Input
            id="acc-cur"
            autoComplete="off"
            maxLength={3}
            className="uppercase"
            invalid={Boolean(errors.currency)}
            {...register("currency")}
          />
        </Field>
        <Controller
          control={control}
          name="openingBalanceFils"
          render={({ field }) => (
            <MoneyInput
              label="Opening balance"
              currency={currencyLabel}
              allowNegative
              value={field.value}
              onChange={(f) => field.onChange(f ?? undefined)}
              onBlur={field.onBlur}
              error={errors.openingBalanceFils?.message}
              hint="Balance before the transactions you record here. Enter a negative amount for cards and loans you owe."
            />
          )}
        />
        <Field label="Last 4 digits" htmlFor="acc-last4" error={errors.last4?.message} hint="Optional. Helps tell cards apart.">
          <Input
            id="acc-last4"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="1234"
            invalid={Boolean(errors.last4)}
            className="tabular"
            {...register("last4")}
          />
        </Field>
      </FormGrid>
    </FormDialog>
  );
}
