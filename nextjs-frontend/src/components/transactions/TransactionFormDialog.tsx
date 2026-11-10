"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { ListPlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { todayISO } from "@/lib/dates";
import { useAccounts, useCategories, useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from "@/lib/queries";
import { formatFils } from "@/lib/money";
import type { CategoryGroup, ReceiptReading, Transaction, TransactionCreate, TransactionType, TxnItem } from "@/lib/types";
import { accountPickerGroup, householdFirst } from "@/features/accounts/accountMeta";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { Field, Input, Textarea, labelClasses } from "@/components/ui/Field";
import { FormDialog, FormGrid } from "@/components/ui/FormDialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { notify } from "@/components/ui/notify";
import { emptyDraft, fromDrafts, ItemsEditor, toDrafts, type ItemDraft } from "./ItemsEditor";
import { ReceiptScanner } from "./ReceiptScanner";

/** Stable comparison key for an item list. */
const itemsKey = (items: TxnItem[]) => JSON.stringify(items.map((i) => [i.name, i.amountFils ?? null]));

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
  const [items, setItems] = useState<ItemDraft[]>(() => toDrafts(transaction?.items ?? defaults?.items));
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsOpen, setItemsOpen] = useState(items.length > 0);
  // Items the receipt scanner wrote last (to tell whether the user has edited them since).
  const scannedItems = useRef<TxnItem[]>([]);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

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
    getValues,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: initial });

  const type = useWatch({ control, name: "type" }) as TransactionType;
  const accountId = useWatch({ control, name: "accountId" });
  const amountFils = useWatch({ control, name: "amountFils" });

  // Default account once accounts load (create mode only).
  const firstAccountId = accounts[0]?.id;
  useEffect(() => {
    if (!isEdit && !accountId && firstAccountId) setValue("accountId", firstAccountId);
  }, [isEdit, accountId, firstAccountId, setValue]);

  const accountOptions: DropdownOption[] = householdFirst(accounts).map((a) => ({
    value: a.id,
    label: a.name,
    description: [a.institution, a.last4 ? `•••• ${a.last4}` : null, a.currency !== "AED" ? a.currency : null]
      .filter(Boolean)
      .join(", ") || undefined,
    group: accountPickerGroup(a, accounts),
  }));

  const categoryOptions: DropdownOption[] = categories
    .filter((c) => !c.archived && c.kind === (type === "income" ? "income" : "expense"))
    .map((c) => ({ value: c.id, label: c.name, group: GROUP_LABEL[c.group] ?? c.group }));

  const saving = createM.isPending || updateM.isPending;
  const accountCurrency = accounts.find((a) => a.id === accountId)?.currency ?? "AED";

  // A scanned receipt is always an expense. Only fields it found are written. On the AI pass
  // (`prev` = the first, text-only reading), a field the user has changed since is left alone.
  function applyReceipt(r: ReceiptReading, prev: ReceiptReading | null) {
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    const fill = <K extends "amountFils" | "date" | "merchant" | "categoryId" | "accountId" | "note">(
      name: K,
      value: FormInput[K] | null | undefined,
      before: FormInput[K] | null | undefined,
    ) => {
      if (value == null || value === "") return;
      if (prev && (getValues(name) ?? null) !== (before ?? null) && getValues(name)) return;
      setValue(name, value as never, opts);
    };
    // Items go to the items list; the note keeps only VAT and a foreign-currency total.
    const note = (x: ReceiptReading) => {
      const c = x.currency ?? accountCurrency;
      return [
        x.vatFils ? `VAT ${formatFils(x.vatFils, c)}` : null,
        x.currency && x.currency !== accountCurrency && x.amountFils != null ? `Receipt total ${formatFils(x.amountFils, x.currency)}` : null,
      ]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 500);
    };
    if (!prev) {
      setValue("type", "expense", opts);
      setValue("toAccountId", undefined);
    }
    if (getValues("type") !== "expense") return;
    fill("amountFils", r.amountFils && r.amountFils > 0 ? r.amountFils : null, prev?.amountFils);
    fill("date", r.date, prev?.date);
    fill("merchant", r.merchant, prev?.merchant);
    fill("categoryId", r.categoryId, prev?.categoryId);
    fill("accountId", r.accountId, prev?.accountId);
    fill("note", note(r) || null, prev ? note(prev) : null);
    // Line items: written when found, unless the user edited the list after the first pass.
    // Prices are only kept when the receipt is in the account's currency.
    const sameCurrency = !r.currency || r.currency === accountCurrency;
    const scanned = r.items
      .filter((i) => i.name.trim())
      .map((i) => ({ name: i.name.trim().slice(0, 200), amountFils: sameCurrency ? i.amountFils : null }));
    if (scanned.length) {
      const cur = itemsRef.current;
      const untouched = !prev || itemsKey(fromDrafts(cur).items) === itemsKey(scannedItems.current);
      if (untouched || !cur.some((d) => d.name.trim())) {
        scannedItems.current = scanned;
        setItems(toDrafts(scanned));
        setItemsError(null);
        setItemsOpen(true);
      }
    }
  }

  const onSubmit = handleSubmit(async (v) => {
    const parsed = fromDrafts(items);
    if (parsed.error) {
      setItemsError(parsed.error);
      setItemsOpen(true);
      return;
    }
    setItemsError(null);
    const body: TransactionCreate = {
      items: parsed.items,
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
      {!isEdit && !noAccounts ? <ReceiptScanner onRead={applyReceipt} expectedCurrency={accountCurrency} /> : null}
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

        {type !== "transfer" || items.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-1.5 md:col-span-2">
            <span className={labelClasses}>
              Items <span className="font-normal text-ink-2">(optional)</span>
            </span>
            {itemsOpen || items.length > 0 ? (
              <ItemsEditor
                value={items}
                onChange={(next) => {
                  setItems(next);
                  if (itemsError) setItemsError(null);
                }}
                totalFils={amountFils}
                currency={accountCurrency}
                error={itemsError}
              />
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setItems([emptyDraft()]);
                    setItemsOpen(true);
                  }}
                >
                  <ListPlus /> Add items
                </Button>
                <span className="text-xs text-ink-2">What was bought, for example from a receipt.</span>
              </div>
            )}
          </div>
        ) : null}
      </FormGrid>
    </FormDialog>
  );
}
