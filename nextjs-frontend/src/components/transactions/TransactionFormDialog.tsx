"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { todayISO } from "@/lib/dates";
import { useAccounts, useCategories, useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from "@/lib/queries";
import type { CategoryGroup, Transaction, TransactionCreate, TransactionType } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { Field, Input, Textarea, labelClasses } from "@/components/ui/Field";
import { FormDialog, FormGrid } from "@/components/ui/FormDialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { notify } from "@/components/ui/notify";

const schema = z
  .object({
    type: z.enum(["expense", "income", "transfer"]),
    accountId: z.string().min(1, "Choose an account"),
    toAccountId: z.string().optional(),
    categoryId: z.string().optional(),
    amountFils: z
      .number({ error: "Enter an amount" })
      .int()
      .positive("Amount must be greater than 0")
      .max(100_000_000_00, "Amount is too large"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    merchant: z.string().trim().max(120, "Max 120 characters").optional(),
    note: z.string().trim().max(500, "Max 500 characters").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "transfer") {
      if (!v.toAccountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Choose the destination account" });
      else if (v.toAccountId === v.accountId)
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Choose a different account" });
    } else if (!v.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Choose a category" });
    }
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const GROUP_LABEL: Record<CategoryGroup, string> = {
  essentials: "Essentials",
  lifestyle: "Lifestyle",
  debt: "Debt",
  savings: "Savings",
  income: "Income",
  other: "Other",
};

export interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode when provided. */
  transaction?: Transaction | null;
  /** Prefill for create mode (e.g. current account filter). */
  defaults?: Partial<TransactionCreate>;
  onSaved?: (t: Transaction) => void;
}

/** Shared add/edit transaction form (account, type, category by kind, amount, date, merchant, note, transfer target). */
export function TransactionFormDialog(props: TransactionFormDialogProps) {
  // Remount the form body each time it opens so defaults re-initialise.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setSession((s) => s + 1);
  }
  return <TransactionForm key={session} {...props} />;
}

function TransactionForm({ open, onOpenChange, transaction, defaults, onSaved }: TransactionFormDialogProps) {
  const isEdit = Boolean(transaction);
  const accountsQ = useAccounts();
  const categoriesQ = useCategories();
  const createM = useCreateTransaction();
  const updateM = useUpdateTransaction();
  const deleteM = useDeleteTransaction();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data]);

  const initial: FormInput = transaction
    ? {
        type: transaction.type,
        accountId: transaction.accountId,
        toAccountId: transaction.toAccountId ?? undefined,
        categoryId: transaction.categoryId ?? undefined,
        amountFils: transaction.amountFils,
        date: transaction.date,
        merchant: transaction.merchant ?? "",
        note: transaction.note ?? "",
      }
    : {
        type: defaults?.type ?? "expense",
        accountId: defaults?.accountId ?? "",
        toAccountId: defaults?.toAccountId ?? undefined,
        categoryId: defaults?.categoryId ?? undefined,
        amountFils: defaults?.amountFils ?? (undefined as unknown as number),
        date: defaults?.date ?? todayISO(),
        merchant: defaults?.merchant ?? "",
        note: defaults?.note ?? "",
      };

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: initial });

  const type = useWatch({ control, name: "type" }) as TransactionType;
  const accountId = useWatch({ control, name: "accountId" });

  // Default account once accounts load (create mode only).
  const firstAccountId = accounts[0]?.id;
  useEffect(() => {
    if (!isEdit && !accountId && firstAccountId) setValue("accountId", firstAccountId);
  }, [isEdit, accountId, firstAccountId, setValue]);

  const accountOptions: DropdownOption[] = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    description: [a.institution, a.last4 ? `•••• ${a.last4}` : null, a.currency !== "AED" ? a.currency : null]
      .filter(Boolean)
      .join(", ") || undefined,
  }));

  const categoryOptions: DropdownOption[] = categories
    .filter((c) => !c.archived && c.kind === (type === "income" ? "income" : "expense"))
    .map((c) => ({ value: c.id, label: c.name, group: GROUP_LABEL[c.group] ?? c.group }));

  const saving = createM.isPending || updateM.isPending;

  const onSubmit = handleSubmit(async (v) => {
    const body: TransactionCreate = {
      type: v.type,
      accountId: v.accountId,
      amountFils: v.amountFils,
      date: v.date,
      categoryId: v.type === "transfer" ? null : (v.categoryId ?? null),
      toAccountId: v.type === "transfer" ? (v.toAccountId ?? null) : null,
      merchant: v.merchant ? v.merchant : null,
      note: v.note ? v.note : null,
    };
    try {
      const saved = transaction
        ? await updateM.mutateAsync({ id: transaction.id, ...body })
        : await createM.mutateAsync(body);
      notify.success(transaction ? "Transaction updated" : "Transaction added");
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      notify.error(err, "Could not save transaction");
    }
  });

  const noAccounts = accountsQ.isSuccess && accounts.length === 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit transaction" : "New transaction"}
      onSubmit={onSubmit}
      submitLabel={isEdit ? "Save changes" : "Add transaction"}
      submitting={saving}
      submitDisabled={noAccounts}
      footerStart={
        transaction ? (
          confirmDelete ? (
            <Button
              variant="danger"
              size="sm"
              loading={deleteM.isPending}
              onClick={async () => {
                try {
                  await deleteM.mutateAsync(transaction.id);
                  notify.success("Transaction deleted");
                  onOpenChange(false);
                } catch (err) {
                  notify.error(err, "Could not delete");
                }
              }}
            >
              Delete transaction
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          )
        ) : null
      }
    >
      {noAccounts ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-container border border-line bg-surface-2 px-3 py-2.5">
          <p className="text-meta text-ink-2">You need an account before you can record transactions.</p>
          <Link
            href="/accounts"
            onClick={() => onOpenChange(false)}
            className="shrink-0 text-meta font-semibold text-accent underline-offset-2 hover:underline"
          >
            Add an account
          </Link>
        </div>
      ) : null}
      <FormGrid>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <span id="txn-type-label" className={labelClasses}>
                Type
              </span>
              <SegmentedControl
                aria-label="Transaction type"
                fullWidth
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  setValue("categoryId", undefined);
                  if (v !== "transfer") setValue("toAccountId", undefined);
                }}
                options={[
                  { value: "expense", label: "Expense" },
                  { value: "income", label: "Income" },
                  { value: "transfer", label: "Transfer" },
                ]}
              />
            </div>
          )}
        />

        <Controller
          control={control}
          name="amountFils"
          render={({ field }) => (
            <MoneyInput
              label="Amount"
              required
              autoFocus={!isEdit}
              value={field.value}
              onChange={(f) => field.onChange(f ?? undefined)}
              onBlur={field.onBlur}
              error={errors.amountFils?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DateField label="Date" required value={field.value} onChange={(d) => field.onChange(d ?? "")} onBlur={field.onBlur} error={errors.date?.message} />
          )}
        />

        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <Dropdown
              label={type === "transfer" ? "From account" : "Account"}
              options={accountOptions}
              value={field.value}
              onChange={field.onChange}
              placeholder={accountsQ.isLoading ? "Loading…" : "Choose account"}
              error={errors.accountId?.message}
            />
          )}
        />
        {type === "transfer" ? (
          <Controller
            control={control}
            name="toAccountId"
            render={({ field }) => (
              <Dropdown
                label="To account"
                options={accountOptions.filter((o) => o.value !== accountId)}
                value={field.value}
                onChange={field.onChange}
                placeholder="Choose account"
                error={errors.toAccountId?.message}
              />
            )}
          />
        ) : (
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Dropdown
                label="Category"
                options={categoryOptions}
                value={field.value}
                onChange={field.onChange}
                placeholder={categoriesQ.isLoading ? "Loading…" : "Choose category"}
                error={errors.categoryId?.message}
              />
            )}
          />
        )}

        {type !== "transfer" ? (
          <Field
            label={type === "income" ? "Payer" : "Merchant"}
            htmlFor="txn-merchant"
            error={errors.merchant?.message}
            className="md:col-span-2"
          >
            <Input
              id="txn-merchant"
              autoComplete="off"
              placeholder={type === "income" ? "For example, employer name" : "For example, Carrefour"}
              invalid={Boolean(errors.merchant)}
              {...register("merchant")}
            />
          </Field>
        ) : null}

        <Field label="Note" htmlFor="txn-note" error={errors.note?.message} hint="Optional" className="md:col-span-2">
          <Textarea id="txn-note" rows={2} invalid={Boolean(errors.note)} {...register("note")} />
        </Field>
      </FormGrid>
    </FormDialog>
  );
}
