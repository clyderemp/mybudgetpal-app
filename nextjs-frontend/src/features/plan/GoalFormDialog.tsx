"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DateField } from "@/components/ui/DateField";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { FormDialog, FormGrid } from "@/components/ui/FormDialog";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { notify } from "@/components/ui/notify";
import { applyApiErrors } from "@/lib/form-errors";
import { useAccounts, useCreateGoal, useUpdateGoal } from "@/lib/queries";
import type { Goal, GoalCreate } from "@/lib/types";
import { PRIORITY_OPTIONS } from "./labels";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80, "Max 80 characters"),
  targetFils: z.number({ error: "Enter a target" }).int().positive("Target must be greater than 0"),
  savedFils: z.number().int().min(0, "Can't be negative").nullable(),
  targetDate: z.string().nullable(),
  priority: z.string(),
  accountId: z.string().optional(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function GoalFormDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const accounts = useAccounts();
  const createM = useCreateGoal();
  const updateM = useUpdateGoal();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: goal?.name ?? "",
      targetFils: goal?.targetFils ?? (undefined as unknown as number),
      savedFils: goal?.savedFils ?? null,
      targetDate: goal?.targetDate ?? null,
      priority: String(goal?.priority ?? 1),
      accountId: goal?.accountId ?? "",
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    const body: GoalCreate = {
      name: v.name,
      targetFils: v.targetFils,
      targetDate: v.targetDate || null,
      priority: Number(v.priority),
      accountId: v.accountId || null,
    };
    try {
      if (goal) await updateM.mutateAsync({ id: goal.id, ...body });
      else await createM.mutateAsync({ ...body, savedFils: v.savedFils ?? 0 });
      notify.success(goal ? "Goal updated" : "Goal added");
      onClose();
    } catch (err) {
      const msg = applyApiErrors(err, setError, ["name", "targetFils", "savedFils", "targetDate", "accountId"]);
      if (msg) notify.error(err, "Couldn't save goal");
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={goal ? "Edit goal" : "Add savings goal"}
      onSubmit={onSubmit}
      submitLabel={goal ? "Save goal" : "Add goal"}
      submitting={createM.isPending || updateM.isPending}
    >
      <FormGrid>
        <Field label="Name" htmlFor="goal-name" error={errors.name?.message} required className="md:col-span-2">
          <Input id="goal-name" autoComplete="off" placeholder="e.g. Emergency fund" invalid={!!errors.name} {...register("name")} />
        </Field>
        <Controller
          control={control}
          name="targetFils"
          render={({ field }) => (
            <MoneyInput label="Target amount" required value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors.targetFils?.message} />
          )}
        />
        {goal ? null : (
          <Controller
            control={control}
            name="savedFils"
            render={({ field }) => (
              <MoneyInput label="Already saved" hint="Optional" value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors.savedFils?.message} />
            )}
          />
        )}
        <Controller
          control={control}
          name="targetDate"
          render={({ field }) => <DateField label="Target date" hint="Optional" value={field.value} onChange={field.onChange} error={errors.targetDate?.message} />}
        />
        <Controller
          control={control}
          name="priority"
          render={({ field }) => <Dropdown label="Priority" options={PRIORITY_OPTIONS} value={field.value} onChange={field.onChange} />}
        />
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <Dropdown
              label="Saved in account"
              options={(accounts.data ?? []).map((a) => ({ value: a.id, label: a.name, description: a.institution ?? undefined }))}
              value={field.value}
              onChange={field.onChange}
              clearLabel="None"
              placeholder="None"
            />
          )}
        />
      </FormGrid>
    </FormDialog>
  );
}
