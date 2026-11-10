"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { FormDialog, FormGrid, FormSection } from "@/components/ui/FormDialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { notify } from "@/components/ui/notify";
import { currentMonth } from "@/lib/dates";
import { applyApiErrors } from "@/lib/form-errors";
import { useAccounts, useCategories, useCreateBill, useDebts, useUpdateBill } from "@/lib/queries";
import type { Bill, BillCreate } from "@/lib/types";
import { BILL_KIND_OPTIONS, CADENCE_OPTIONS } from "./labels";

const day = (msg: string) => z.number({ error: msg }).int("Whole day only").min(1, "Day 1–31").max(31, "Day 1–31");
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month");

const schema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(100, "Max 100 characters"),
    kind: z.enum(["bill", "subscription", "loan", "bnpl", "debt_payment", "savings", "other"]),
    purpose: z.enum(["household", "business"]),
    amountFils: z.number({ error: "Enter the amount" }).int().min(0, "Can't be negative"),
    amountMode: z.enum(["fixed", "estimate"]),
    cadence: z.enum(["monthly", "quarterly", "yearly"]),
    dueDayFrom: day("Enter a day 1–31"),
    dueDayTo: day("Enter a day 1–31"),
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    debtId: z.string().optional(),
    startMonth: month,
    ends: z.enum(["never", "instalments", "month"]),
    endMonth: z.string().optional(),
    instalmentsTotal: z.number().int().min(1, "At least 1").max(600).optional(),
    instalmentsPaid: z.number().int().min(0, "Can't be negative").max(600).optional(),
    matchText: z.string().max(400),
    amountTolerancePct: z.number({ error: "Enter a percentage" }).int("Whole number").min(0).max(100, "Max 100"),
    notes: z.string().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.dueDayTo < v.dueDayFrom) ctx.addIssue({ code: "custom", path: ["dueDayTo"], message: "On or after the first day" });
    if (v.ends === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v.endMonth ?? ""))
      ctx.addIssue({ code: "custom", path: ["endMonth"], message: "Pick the last month" });
    if (v.ends === "month" && v.endMonth && v.endMonth < v.startMonth)
      ctx.addIssue({ code: "custom", path: ["endMonth"], message: "On or after the first month" });
    if (v.ends === "instalments") {
      if (!v.instalmentsTotal) ctx.addIssue({ code: "custom", path: ["instalmentsTotal"], message: "Enter the number of instalments" });
      else if ((v.instalmentsPaid ?? 0) >= v.instalmentsTotal)
        ctx.addIssue({ code: "custom", path: ["instalmentsPaid"], message: "Fewer than the total" });
    }
  });
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export type BillPrefill = Partial<BillCreate>;

function toForm(b: Partial<Bill> | BillPrefill | null | undefined): FormInput {
  const total = b?.instalmentsTotal ?? undefined;
  return {
    name: b?.name ?? "",
    kind: b?.kind ?? "bill",
    purpose: b?.purpose ?? "household",
    amountFils: b?.amountFils ?? (undefined as unknown as number),
    amountMode: b?.amountMode ?? "fixed",
    cadence: b?.cadence ?? "monthly",
    dueDayFrom: b?.dueDayFrom ?? 1,
    dueDayTo: b?.dueDayTo ?? b?.dueDayFrom ?? 1,
    accountId: b?.accountId ?? "",
    categoryId: b?.categoryId ?? "",
    debtId: b?.debtId ?? "",
    startMonth: b?.startMonth ?? currentMonth(),
    ends: total ? "instalments" : b?.endMonth ? "month" : "never",
    endMonth: b?.endMonth ?? "",
    instalmentsTotal: total,
    instalmentsPaid: b?.instalmentsPaid ?? 0,
    matchText: (b?.matchText ?? []).join(", "),
    amountTolerancePct: b?.amountTolerancePct ?? 10,
    notes: b?.notes ?? "",
  };
}

const ENDS_OPTIONS = [
  { value: "never" as const, label: "No end" },
  { value: "instalments" as const, label: "Instalments" },
  { value: "month" as const, label: "End month" },
];

/** Add or edit a recurring bill, subscription, loan or instalment plan. */
export function BillFormDialog({ bill, prefill, onClose }: { bill: Bill | null; prefill?: BillPrefill; onClose: () => void }) {
  const accounts = useAccounts();
  const categories = useCategories();
  const debts = useDebts();
  const createM = useCreateBill();
  const updateM = useUpdateBill();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: toForm(bill ?? prefill) });
  const ends = useWatch({ control, name: "ends" });
  const amountMode = useWatch({ control, name: "amountMode" });

  const onSubmit = handleSubmit(async (v) => {
    const body: BillCreate = {
      name: v.name,
      kind: v.kind,
      purpose: v.purpose,
      amountFils: v.amountFils,
      amountMode: v.amountMode,
      cadence: v.cadence,
      dueDayFrom: v.dueDayFrom,
      dueDayTo: v.dueDayTo,
      accountId: v.accountId || null,
      categoryId: v.categoryId || null,
      debtId: v.debtId || null,
      startMonth: v.startMonth,
      endMonth: v.ends === "month" ? v.endMonth || null : null,
      instalmentsTotal: v.ends === "instalments" ? (v.instalmentsTotal ?? null) : null,
      instalmentsPaid: v.ends === "instalments" ? (v.instalmentsPaid ?? 0) : 0,
      matchText: v.matchText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10),
      amountTolerancePct: v.amountTolerancePct,
      notes: v.notes?.trim() || null,
    };
    try {
      if (bill) await updateM.mutateAsync({ id: bill.id, ...body });
      else await createM.mutateAsync(body);
      notify.success(bill ? "Recurring payment updated" : `${body.name} added`);
      onClose();
    } catch (err) {
      const msg = applyApiErrors(err, setError, [
        "name",
        "kind",
        "amountFils",
        "dueDayFrom",
        "dueDayTo",
        "accountId",
        "categoryId",
        "debtId",
        "startMonth",
        "endMonth",
        "instalmentsTotal",
        "instalmentsPaid",
      ]);
      if (msg) notify.error(err, "Couldn't save recurring payment");
    }
  });

  const accountOptions: DropdownOption[] = (accounts.data ?? [])
    .filter((a) => !a.archived)
    .map((a) => ({ value: a.id, label: a.name, description: a.institution ?? undefined }));
  const categoryOptions: DropdownOption[] = (categories.data ?? [])
    .filter((c) => !c.archived && c.kind === "expense")
    .map((c) => ({ value: c.id, label: c.name }));
  const debtOptions: DropdownOption[] = (debts.data ?? []).map((d) => ({ value: d.id, label: d.name }));

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={bill ? `Edit ${bill.name}` : "Add recurring payment"}
      description="A bill, subscription, loan or instalment you pay on a schedule."
      onSubmit={onSubmit}
      submitLabel={bill ? "Save changes" : "Add recurring payment"}
      submitting={createM.isPending || updateM.isPending}
      size="lg"
    >
      <FormGrid>
        <Field label="Name" htmlFor="bill-name" error={errors.name?.message} required className="md:col-span-2">
          <Input id="bill-name" autoComplete="off" placeholder="e.g. DEWA, Spotify, Zero Max car loan" invalid={!!errors.name} {...register("name")} />
        </Field>
        <Controller
          control={control}
          name="kind"
          render={({ field }) => <Dropdown label="Type" options={BILL_KIND_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} />}
        />
        <Controller
          control={control}
          name="cadence"
          render={({ field }) => <Dropdown label="How often" options={CADENCE_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} />}
        />
        <Controller
          control={control}
          name="amountFils"
          render={({ field }) => (
            <MoneyInput
              label={amountMode === "estimate" ? "Usual amount" : "Amount"}
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.amountFils?.message}
              hint={amountMode === "estimate" ? "Used until there are payments to average." : undefined}
            />
          )}
        />
        <Field label="Amount type" hint={amountMode === "estimate" ? "Expect the average of the last 3 payments." : "The same every time."}>
          <Controller
            control={control}
            name="amountMode"
            render={({ field }) => (
              <SegmentedControl
                aria-label="Amount type"
                fullWidth
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "fixed", label: "Fixed" },
                  { value: "estimate", label: "Varies" },
                ]}
              />
            )}
          />
        </Field>
        <Field label="Usually due from day" htmlFor="bill-from" error={errors.dueDayFrom?.message} required>
          <Input id="bill-from" type="number" inputMode="numeric" min={1} max={31} className="tabular" invalid={!!errors.dueDayFrom} {...register("dueDayFrom", { valueAsNumber: true })} />
        </Field>
        <Field label="To day" htmlFor="bill-to" error={errors.dueDayTo?.message} hint="Same day if it's always on one date" required>
          <Input id="bill-to" type="number" inputMode="numeric" min={1} max={31} className="tabular" invalid={!!errors.dueDayTo} {...register("dueDayTo", { valueAsNumber: true })} />
        </Field>
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <Dropdown label="Paid from" options={accountOptions} value={field.value} onChange={(v) => field.onChange(v ?? "")} clearLabel="Any account" placeholder="Any account" error={errors.accountId?.message} />
          )}
        />
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Dropdown label="Category" options={categoryOptions} value={field.value} onChange={(v) => field.onChange(v ?? "")} clearLabel="None" placeholder="None" error={errors.categoryId?.message} />
          )}
        />
      </FormGrid>

      <FormSection title="Schedule" className="mt-5">
        <FormGrid>
          <Field label="First month" htmlFor="bill-start" error={errors.startMonth?.message} hint="For instalments: the next one to pay" required>
            <Input id="bill-start" type="month" className="tabular" invalid={!!errors.startMonth} {...register("startMonth")} />
          </Field>
          <Field label="Ends">
            <Controller
              control={control}
              name="ends"
              render={({ field }) => <SegmentedControl aria-label="Ends" fullWidth value={field.value} onChange={field.onChange} options={ENDS_OPTIONS} />}
            />
          </Field>
          {ends === "instalments" ? (
            <>
              <Field label="Number of instalments" htmlFor="bill-total" error={errors.instalmentsTotal?.message} required>
                <Input id="bill-total" type="number" inputMode="numeric" min={1} className="tabular" invalid={!!errors.instalmentsTotal} {...register("instalmentsTotal", { setValueAs: numOrUndefined })} />
              </Field>
              <Field label="Already paid" htmlFor="bill-paid" error={errors.instalmentsPaid?.message} hint="Before the first month above">
                <Input id="bill-paid" type="number" inputMode="numeric" min={0} className="tabular" invalid={!!errors.instalmentsPaid} {...register("instalmentsPaid", { setValueAs: numOrUndefined })} />
              </Field>
            </>
          ) : null}
          {ends === "month" ? (
            <Field label="Last month" htmlFor="bill-end" error={errors.endMonth?.message} required>
              <Input id="bill-end" type="month" className="tabular" invalid={!!errors.endMonth} {...register("endMonth")} />
            </Field>
          ) : null}
        </FormGrid>
      </FormSection>

      <FormSection title="Matching and links" className="mt-5">
        <FormGrid>
          <Field
            label="Bank description contains"
            htmlFor="bill-match"
            error={errors.matchText?.message}
            hint="Separate with commas, e.g. openai, chatgpt. Empty uses the name."
            className="md:col-span-2"
          >
            <Input id="bill-match" autoComplete="off" placeholder="e.g. dewa" {...register("matchText")} />
          </Field>
          <Field label="Amount tolerance (%)" htmlFor="bill-tol" error={errors.amountTolerancePct?.message} hint="A bigger difference is flagged as a price change">
            <Input id="bill-tol" type="number" inputMode="numeric" min={0} max={100} className="tabular" invalid={!!errors.amountTolerancePct} {...register("amountTolerancePct", { valueAsNumber: true })} />
          </Field>
          <Controller
            control={control}
            name="purpose"
            render={({ field }) => (
              <Dropdown
                label="Belongs to"
                options={[
                  { value: "household", label: "Household" },
                  { value: "business", label: "Business", description: "Left out of household totals" },
                ]}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "household")}
              />
            )}
          />
          {debtOptions.length ? (
            <Controller
              control={control}
              name="debtId"
              render={({ field }) => (
                <Dropdown label="Linked debt" options={debtOptions} value={field.value} onChange={(v) => field.onChange(v ?? "")} clearLabel="None" placeholder="None" />
              )}
            />
          ) : null}
          <Field label="Notes" htmlFor="bill-notes" className="md:col-span-2">
            <Textarea id="bill-notes" rows={2} {...register("notes")} />
          </Field>
        </FormGrid>
      </FormSection>
    </FormDialog>
  );
}

function numOrUndefined(v: unknown) {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
