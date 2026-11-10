"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Dropdown, Field, FormDialog, FormGrid, Input, MoneyInput, notify } from "@/components/ui";
import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES } from "@/features/accounts/accountMeta";
import { applyApiErrors } from "@/lib/form-errors";
import { useCreateAccount } from "@/lib/queries";
import type { Account, ImportSection } from "@/lib/types";
import { toAccountType } from "./importMeta";

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

/** New account prefilled from a statement section; the caller maps the section to it. */
export function CreateAccountDialog({
  section,
  onOpenChange,
  onCreated,
}: {
  /** Open while set. */
  section: ImportSection | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (account: Account, section: ImportSection) => Promise<unknown>;
}) {
  // Keyed per section so defaults re-initialise on each opening.
  return section ? <Form key={section.index} section={section} onOpenChange={onOpenChange} onCreated={onCreated} /> : null;
}

function Form({
  section,
  onOpenChange,
  onCreated,
}: {
  section: ImportSection;
  onOpenChange: (open: boolean) => void;
  onCreated: (account: Account, section: ImportSection) => Promise<unknown>;
}) {
  const createM = useCreateAccount();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: section.suggestedAccountName || section.product || "",
      institution: section.bank || "",
      type: toAccountType(section.accountType),
      currency: section.currency || "AED",
      openingBalanceFils: section.openingFils ?? 0,
      last4: section.last4 && /^\d{4}$/.test(section.last4) ? section.last4 : "",
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    let account: Account;
    try {
      account = await createM.mutateAsync({
        name: v.name,
        institution: v.institution || null,
        type: v.type,
        currency: v.currency,
        openingBalanceFils: v.openingBalanceFils,
        last4: v.last4 || null,
      });
    } catch (err) {
      const msg = applyApiErrors(err, setError, ["name", "institution", "type", "currency", "openingBalanceFils", "last4"]);
      if (msg) notify.error(err, "Couldn't add account");
      return;
    }
    try {
      await onCreated(account, section);
      notify.success(`${account.name} added`, "Statement rows are now matched against it.");
      onOpenChange(false);
    } catch (err) {
      notify.error(err, `${account.name} was added, but couldn't be linked to this statement`);
      onOpenChange(false);
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title="Create account"
      description="Prefilled from the statement. Rows in this section are imported into it."
      onSubmit={onSubmit}
      submitLabel="Create account"
      submitting={isSubmitting}
    >
      <FormGrid>
        <Field label="Name" htmlFor="imp-acc-name" error={errors.name?.message} required>
          <Input id="imp-acc-name" autoComplete="off" invalid={Boolean(errors.name)} {...register("name")} />
        </Field>
        <Field label="Institution" htmlFor="imp-acc-inst" error={errors.institution?.message}>
          <Input id="imp-acc-inst" autoComplete="off" invalid={Boolean(errors.institution)} {...register("institution")} />
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
        <Field label="Currency" htmlFor="imp-acc-cur" error={errors.currency?.message}>
          <Input id="imp-acc-cur" autoComplete="off" maxLength={3} className="uppercase" invalid={Boolean(errors.currency)} {...register("currency")} />
        </Field>
        <Controller
          control={control}
          name="openingBalanceFils"
          render={({ field }) => (
            <MoneyInput
              label="Opening balance"
              currency={section.currency || "AED"}
              allowNegative
              value={field.value}
              onChange={(f) => field.onChange(f ?? undefined)}
              onBlur={field.onBlur}
              error={errors.openingBalanceFils?.message}
              hint="The statement's opening balance. Enter a negative amount for cards and loans you owe."
            />
          )}
        />
        <Field label="Last 4 digits" htmlFor="imp-acc-last4" error={errors.last4?.message}>
          <Input
            id="imp-acc-last4"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            className="tabular"
            invalid={Boolean(errors.last4)}
            {...register("last4")}
          />
        </Field>
      </FormGrid>
    </FormDialog>
  );
}
