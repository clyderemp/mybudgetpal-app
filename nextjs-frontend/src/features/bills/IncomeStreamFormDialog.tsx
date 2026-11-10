"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { FormDialog, FormGrid } from "@/components/ui/FormDialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { notify } from "@/components/ui/notify";
import { applyApiErrors } from "@/lib/form-errors";
import { useAccounts, useCreateIncomeStream, useMe, useUpdateIncomeStream } from "@/lib/queries";
import type { IncomeStream, IncomeStreamCreate } from "@/lib/types";
import { INCOME_KIND_OPTIONS } from "./labels";

const day = z.number({ error: "Day 1–31" }).int("Whole day only").min(1, "Day 1–31").max(31, "Day 1–31");
const optFils = z.number().int().min(0).nullable().optional();

const partSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().trim().min(1, "Enter a label").max(100),
    kind: z.enum(["salary", "cash_deposit", "transfer", "other"]),
    amountFils: z.number({ error: "Enter the usual amount" }).int().positive("Enter the usual amount"),
    amountMinFils: optFils,
    amountMaxFils: optFils,
    dayFrom: day,
    dayTo: day,
    matchText: z.string().max(400),
  })
  .superRefine((p, ctx) => {
    if (p.dayTo < p.dayFrom) ctx.addIssue({ code: "custom", path: ["dayTo"], message: "On or after the first day" });
    if (p.amountMinFils != null && p.amountMinFils > p.amountFils)
      ctx.addIssue({ code: "custom", path: ["amountMinFils"], message: "At most the usual amount" });
    if (p.amountMaxFils != null && p.amountMaxFils < p.amountFils)
      ctx.addIssue({ code: "custom", path: ["amountMaxFils"], message: "At least the usual amount" });
  });

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  memberId: z.string().optional(),
  accountId: z.string().optional(),
  parts: z.array(partSchema).min(1).max(8),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const emptyPart: FormInput["parts"][number] = {
  label: "Salary",
  kind: "salary",
  amountFils: undefined as unknown as number,
  amountMinFils: null,
  amountMaxFils: null,
  dayFrom: 1,
  dayTo: 5,
  matchText: "salary",
};

/** Expected income: who, into which account, and when each part usually lands. */
export function IncomeStreamFormDialog({ stream, onClose }: { stream: IncomeStream | null; onClose: () => void }) {
  const me = useMe();
  const accounts = useAccounts();
  const createM = useCreateIncomeStream();
  const updateM = useUpdateIncomeStream();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: stream
      ? {
          name: stream.name,
          memberId: stream.memberId ?? "",
          accountId: stream.accountId ?? "",
          parts: stream.parts.map((p) => ({ ...p, matchText: p.matchText.join(", ") })),
        }
      : { name: "", memberId: "", accountId: "", parts: [emptyPart] },
  });
  const parts = useFieldArray({ control, name: "parts" });

  const onSubmit = handleSubmit(async (v) => {
    const body: IncomeStreamCreate = {
      name: v.name,
      memberId: v.memberId || null,
      accountId: v.accountId || null,
      parts: v.parts.map((p) => ({
        ...(p.id ? { id: p.id } : {}),
        label: p.label,
        kind: p.kind,
        amountFils: p.amountFils,
        amountMinFils: p.amountMinFils ?? null,
        amountMaxFils: p.amountMaxFils ?? null,
        dayFrom: p.dayFrom,
        dayTo: p.dayTo,
        matchText: p.matchText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 10),
      })),
    };
    try {
      if (stream) await updateM.mutateAsync({ id: stream.id, ...body });
      else await createM.mutateAsync(body);
      notify.success(stream ? "Expected income updated" : `${body.name} added`);
      onClose();
    } catch (err) {
      const msg = applyApiErrors(err, setError, ["name", "memberId", "accountId"]);
      if (msg) notify.error(err, "Couldn't save expected income");
    }
  });

  const memberOptions: DropdownOption[] = (me.data?.household.members ?? []).map((m) => ({ value: m.id, label: m.name }));
  const accountOptions: DropdownOption[] = (accounts.data ?? [])
    .filter((a) => !a.archived)
    .map((a) => ({ value: a.id, label: a.name, description: a.institution ?? undefined }));

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={stream ? `Edit ${stream.name}` : "Add expected income"}
      description="When money usually comes in. Split a salary into parts if it arrives in pieces, e.g. an advance and the rest."
      onSubmit={onSubmit}
      submitLabel={stream ? "Save changes" : "Add expected income"}
      submitting={createM.isPending || updateM.isPending}
      size="lg"
    >
      <FormGrid>
        <Field label="Name" htmlFor="inc-name" error={errors.name?.message} required className="md:col-span-2">
          <Input id="inc-name" autoComplete="off" placeholder="e.g. Clyde salary" invalid={!!errors.name} {...register("name")} />
        </Field>
        <Controller
          control={control}
          name="memberId"
          render={({ field }) => (
            <Dropdown label="Whose income" options={memberOptions} value={field.value} onChange={(v) => field.onChange(v ?? "")} clearLabel="Household" placeholder="Household" />
          )}
        />
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <Dropdown label="Paid into" options={accountOptions} value={field.value} onChange={(v) => field.onChange(v ?? "")} clearLabel="Any account" placeholder="Any account" />
          )}
        />
      </FormGrid>

      <div className="mt-5 flex flex-col gap-4">
        {parts.fields.map((f, i) => {
          const e = errors.parts?.[i];
          return (
            <fieldset key={f.id} className="rounded-container border border-line p-4">
              <legend className="px-1 text-meta font-semibold text-ink">Part {i + 1}</legend>
              <FormGrid>
                <Field label="Label" htmlFor={`p-${i}-label`} error={e?.label?.message} required>
                  <Input id={`p-${i}-label`} autoComplete="off" placeholder="e.g. Advance" invalid={!!e?.label} {...register(`parts.${i}.label`)} />
                </Field>
                <Controller
                  control={control}
                  name={`parts.${i}.kind`}
                  render={({ field }) => <Dropdown label="Arrives as" options={INCOME_KIND_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} />}
                />
                <Controller
                  control={control}
                  name={`parts.${i}.amountFils`}
                  render={({ field }) => (
                    <MoneyInput label="Usual amount" required value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={e?.amountFils?.message} />
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Controller
                    control={control}
                    name={`parts.${i}.amountMinFils`}
                    render={({ field }) => (
                      <MoneyInput label="Lowest" value={field.value ?? null} onChange={field.onChange} onBlur={field.onBlur} error={e?.amountMinFils?.message} />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`parts.${i}.amountMaxFils`}
                    render={({ field }) => (
                      <MoneyInput label="Highest" value={field.value ?? null} onChange={field.onChange} onBlur={field.onBlur} error={e?.amountMaxFils?.message} />
                    )}
                  />
                </div>
                <Field label="Usually from day" htmlFor={`p-${i}-from`} error={e?.dayFrom?.message} required>
                  <Input id={`p-${i}-from`} type="number" inputMode="numeric" min={1} max={31} className="tabular" invalid={!!e?.dayFrom} {...register(`parts.${i}.dayFrom`, { valueAsNumber: true })} />
                </Field>
                <Field label="To day" htmlFor={`p-${i}-to`} error={e?.dayTo?.message} required>
                  <Input id={`p-${i}-to`} type="number" inputMode="numeric" min={1} max={31} className="tabular" invalid={!!e?.dayTo} {...register(`parts.${i}.dayTo`, { valueAsNumber: true })} />
                </Field>
                <Field
                  label="Bank description contains"
                  htmlFor={`p-${i}-match`}
                  hint="Separate with commas, e.g. salary, salvone. Empty matches any income into the account."
                  className="md:col-span-2"
                >
                  <Input id={`p-${i}-match`} autoComplete="off" {...register(`parts.${i}.matchText`)} />
                </Field>
              </FormGrid>
              {parts.fields.length > 1 ? (
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => parts.remove(i)}>
                    <Trash2 aria-hidden /> Remove part {i + 1}
                  </Button>
                </div>
              ) : null}
            </fieldset>
          );
        })}
        {parts.fields.length < 8 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => parts.append({ ...emptyPart, label: "Remainder", kind: "cash_deposit", dayFrom: 20, dayTo: 28, matchText: "" })}
          >
            <Plus aria-hidden /> Add a part
          </Button>
        ) : null}
      </div>
    </FormDialog>
  );
}
