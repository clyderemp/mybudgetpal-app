"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Dropdown, Field, FormDialog, Input, notify } from "@/components/ui";
import { applyApiErrors } from "@/lib/form-errors";
import { useCreateMerchantRule } from "@/lib/queries";
import type { Category, ImportRow } from "@/lib/types";

const schema = z.object({
  pattern: z.string().trim().min(2, "At least 2 characters").max(100, "Max 100 characters"),
  categoryId: z.string().min(1, "Choose a category"),
  merchant: z.string().trim().max(200, "Max 200 characters").optional(),
});

type FormValues = z.infer<typeof schema>;

/** "Always categorise X as Y": creates a merchant rule, then the caller re-runs matching. */
export function MerchantRuleDialog({
  row,
  categories,
  onOpenChange,
  onSaved,
}: {
  /** Open while set. */
  row: ImportRow | null;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  return row ? <Form key={row.id} row={row} categories={categories} onOpenChange={onOpenChange} onSaved={onSaved} /> : null;
}

function Form({
  row,
  categories,
  onOpenChange,
  onSaved,
}: {
  row: ImportRow;
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const createM = useCreateMerchantRule();
  const options = useMemo(
    () =>
      categories
        .filter((c) => !c.archived && (row.type === "transfer" || c.kind === row.type))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, row.type],
  );
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { pattern: row.merchant ?? "", categoryId: row.categoryId ?? "", merchant: row.merchant ?? "" },
  });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await createM.mutateAsync({ pattern: v.pattern, categoryId: v.categoryId, merchant: v.merchant || null });
    } catch (err) {
      const msg = applyApiErrors(err, setError, ["pattern", "categoryId", "merchant"]);
      if (msg) notify.error(err, "Couldn't save the rule");
      return;
    }
    try {
      await onSaved();
      notify.success("Rule saved", "Matching rows in this statement were updated.");
    } catch (err) {
      notify.error(err, "Rule saved, but the statement couldn't be re-matched");
    }
    onOpenChange(false);
  });

  return (
    <FormDialog
      open
      size="sm"
      onOpenChange={onOpenChange}
      title="Always categorise like this"
      description="Bank rows whose text contains the pattern get this category, now and in future imports."
      onSubmit={onSubmit}
      submitLabel="Save rule"
      submitting={isSubmitting}
    >
      <div className="flex flex-col gap-4">
        <Field label="When the bank text contains" htmlFor="rule-pattern" error={errors.pattern?.message} required hint={`Row text: ${row.description}`}>
          <Input id="rule-pattern" autoComplete="off" invalid={Boolean(errors.pattern)} {...register("pattern")} />
        </Field>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Dropdown label="Categorise as" options={options} value={field.value} onChange={field.onChange} error={errors.categoryId?.message} />
          )}
        />
        <Field label="Merchant name" htmlFor="rule-merchant" error={errors.merchant?.message} hint="Optional. Shown instead of the bank text.">
          <Input id="rule-merchant" autoComplete="off" invalid={Boolean(errors.merchant)} {...register("merchant")} />
        </Field>
      </div>
    </FormDialog>
  );
}
