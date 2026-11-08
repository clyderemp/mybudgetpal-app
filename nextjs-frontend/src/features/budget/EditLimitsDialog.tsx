"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button, Field, FormDialog, Money, MoneyInput, Textarea, notify } from "@/components/ui";
import { formatMonth } from "@/lib/dates";
import { usePutBudget } from "@/lib/queries";
import type { Budget, Category, CategoryGroup } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryLabel } from "@/features/transactions/CategoryDot";
import { GROUP_LABEL, groupBy } from "./groups";

const schema = z.object({
  limits: z.record(
    z.string(),
    z.number().int("Use whole fils only").nonnegative("Enter 0 or more").max(100_000_000_00, "Enter a smaller amount").nullable().optional(),
  ),
  note: z.string().trim().max(500, "Keep the note under 500 characters").optional(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Row {
  id: string;
  name: string;
  group: CategoryGroup;
  color?: string | null;
}

export function EditLimitsDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  month: string;
  budget: Budget | undefined;
  /** Previous month's budget, for reference columns and "Fill with last month". */
  previous?: Budget;
  categories: Category[];
}) {
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setSession((s) => s + 1);
  }
  return <EditLimitsForm key={session} {...props} />;
}

const gridCols = "grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] md:grid-cols-[minmax(0,1fr)_8rem_10rem] items-center gap-x-3";

function EditLimitsForm({
  open,
  onOpenChange,
  month,
  budget,
  previous,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  month: string;
  budget: Budget | undefined;
  previous?: Budget;
  categories: Category[];
}) {
  const putM = usePutBudget(month);

  // Active expense categories plus any category already budgeted (even if archived since).
  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const c of categories) if (!c.archived && c.kind === "expense") map.set(c.id, { id: c.id, name: c.name, group: c.group, color: c.color });
    for (const l of budget?.lines ?? []) if (!map.has(l.categoryId)) map.set(l.categoryId, { id: l.categoryId, name: l.categoryName, group: l.group });
    return [...map.values()];
  }, [categories, budget]);

  const prevLimit = useMemo(() => new Map((previous?.lines ?? []).map((l) => [l.categoryId, l])), [previous]);

  const defaults = useMemo<FormInput>(() => {
    const limits: Record<string, number | null> = {};
    for (const l of budget?.lines ?? []) limits[l.categoryId] = l.limitFils;
    return { limits, note: budget?.note ?? "" };
  }, [budget]);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: defaults });

  const limits = useWatch({ control, name: "limits" });
  const total = Object.values(limits ?? {}).reduce<number>((s, v) => s + (v ?? 0), 0);
  const income = budget?.incomeFils ?? 0;
  const unassigned = income - total;
  const prevHasLines = (previous?.lines.length ?? 0) > 0;

  const onSubmit = handleSubmit(async (v) => {
    const lines = Object.entries(v.limits)
      .filter(([, f]) => typeof f === "number" && f > 0)
      .map(([categoryId, f]) => ({ categoryId, limitFils: f as number }));
    try {
      await putM.mutateAsync({ lines, note: v.note ? v.note : null });
      notify.success(`Budget for ${formatMonth(month)} saved`);
      onOpenChange(false);
    } catch (err) {
      notify.error(err, "Couldn't save budget");
    }
  });

  const fillFromPrevious = () => {
    for (const r of rows) {
      const p = prevLimit.get(r.id);
      setValue(`limits.${r.id}`, p ? p.limitFils : null, { shouldDirty: true });
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Edit budget for ${formatMonth(month, true)}`}
      description="Set a monthly amount per category. Leave a field empty for no budget."
      onSubmit={onSubmit}
      submitLabel="Save budget"
      submitting={putM.isPending}
      footerStart={
        <span className="hidden text-meta text-ink-2 sm:inline">
          Total <Money fils={total} className="font-semibold" />
        </span>
      }
    >
      <dl className="mb-4 grid grid-cols-3 overflow-hidden rounded-container border border-line [&>div+div]:border-l [&>div]:border-line">
        <div className="min-w-0 px-3 py-2">
          <dt className="truncate text-xs text-ink-2">Income</dt>
          <dd className="truncate text-sm font-semibold">
            <Money fils={income} noDecimals />
          </dd>
        </div>
        <div className="min-w-0 px-3 py-2">
          <dt className="truncate text-xs text-ink-2">Budgeted</dt>
          <dd className="truncate text-sm font-semibold">
            <Money fils={total} noDecimals />
          </dd>
        </div>
        <div className="min-w-0 px-3 py-2">
          <dt className="truncate text-xs text-ink-2">{unassigned < 0 ? "Over income" : "Unassigned"}</dt>
          <dd className="truncate text-sm font-semibold">
            <Money fils={Math.abs(unassigned)} noDecimals tone={unassigned < 0 && income > 0 ? "danger" : undefined} />
          </dd>
        </div>
      </dl>

      {rows.length === 0 ? (
        <p className="text-meta text-ink-2">You have no expense categories yet. Add them in Settings, then come back to set a budget.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {prevHasLines ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-meta text-ink-2">Start from {formatMonth(previous!.month)} and adjust what changed.</p>
              <Button type="button" variant="secondary" size="sm" onClick={fillFromPrevious}>
                Fill with {formatMonth(previous!.month)} budget
              </Button>
            </div>
          ) : null}

          <div className="min-w-0 overflow-hidden rounded-container border border-line">
            <div className={cn(gridCols, "h-9 border-b border-line bg-surface-2 px-3 text-meta font-medium text-ink-2")} aria-hidden>
              <span>Category</span>
              <span className="hidden text-right md:block">Last month</span>
              <span className="text-right">Budget</span>
            </div>
            {groupBy(rows).map(([g, items]) => (
              <fieldset key={g} className="min-w-0 border-b border-line last:border-b-0">
                <legend className="sr-only">{GROUP_LABEL[g]}</legend>
                <div aria-hidden className="flex h-8 items-center border-b border-line px-3 text-meta font-semibold text-ink">
                  {GROUP_LABEL[g]}
                </div>
                {items.map((r) => {
                  const prev = prevLimit.get(r.id);
                  return (
                    <Controller
                      key={r.id}
                      control={control}
                      name={`limits.${r.id}`}
                      render={({ field }) => (
                        <div className={cn(gridCols, "min-h-12 border-b border-line px-3 py-1.5 last:border-b-0")}>
                          <label htmlFor={`limit-${r.id}`} className="min-w-0 text-sm text-ink">
                            <CategoryLabel category={{ id: r.id, color: r.color }} label={r.name} />
                            <span className="mt-0.5 block truncate pl-4 text-xs text-ink-2 md:hidden">
                              Last month <Money fils={prev?.limitFils ?? null} noDecimals tone="muted" />
                            </span>
                          </label>
                          <span className="hidden text-right text-meta md:block">
                            <Money fils={prev?.limitFils ?? null} tone="muted" noDecimals />
                          </span>
                          <MoneyInput
                            id={`limit-${r.id}`}
                            value={field.value ?? null}
                            onChange={(f) => field.onChange(f)}
                            onBlur={field.onBlur}
                            placeholder="No budget"
                            error={errors.limits?.[r.id]?.message}
                          />
                        </div>
                      )}
                    />
                  );
                })}
              </fieldset>
            ))}
          </div>

          <Field label="Note" htmlFor="budget-note" error={errors.note?.message} hint="Optional. Visible to both of you.">
            <Textarea id="budget-note" rows={2} invalid={Boolean(errors.note)} {...register("note")} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}
