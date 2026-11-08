"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, MoreHorizontal, Pencil, Plus, Tags } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ActionMenu, Button, ConfirmDialog, Dropdown, EmptyState, Field, FormDialog, InlineError, Input, notify, Panel, SegmentedControl, SkeletonList } from "@/components/ui";
import { applyApiErrors } from "@/lib/form-errors";
import { useArchiveCategory, useCategories, useCreateCategory, useUpdateCategory } from "@/lib/queries";
import type { Category, CategoryGroup, CategoryKind } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

const GROUP_LABEL: Record<CategoryGroup, string> = {
  essentials: "Essentials",
  lifestyle: "Lifestyle",
  debt: "Debt",
  savings: "Savings",
  income: "Income",
  other: "Other",
};
const GROUPS_FOR: Record<CategoryKind, CategoryGroup[]> = {
  expense: ["essentials", "lifestyle", "debt", "savings", "other"],
  income: ["income", "other"],
};

export function CategoriesSection() {
  const categories = useCategories();
  const archiveM = useArchiveCategory();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [archiving, setArchiving] = useState<Category | null>(null);

  const list = (categories.data ?? []).filter((c) => !c.archived && c.kind === kind);
  const grouped = GROUPS_FOR[kind]
    .map((g) => ({ group: g, items: list.filter((c) => c.group === g).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((g) => g.items.length);
  // Categories whose group isn't expected for this kind still need to show.
  const known = new Set(GROUPS_FOR[kind]);
  const stray = list.filter((c) => !known.has(c.group));
  if (stray.length) grouped.push({ group: "other", items: stray });

  const addButton = (
    <Button size="sm" onClick={() => setEditing("new")}>
      <Plus aria-hidden /> Add category
    </Button>
  );

  return (
    <section>
      <SectionHeader title="Categories" description="Used to label transactions and set budgets. Archived categories keep their history." />
      <Panel flush>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5 md:px-5">
          <SegmentedControl<CategoryKind>
            aria-label="Category type"
            value={kind}
            onChange={setKind}
            options={[
              { value: "expense", label: "Expenses" },
              { value: "income", label: "Income" },
            ]}
          />
          {addButton}
        </div>
        {categories.isPending ? (
          <SkeletonList rows={6} className="px-4 md:px-5" />
        ) : categories.isError ? (
          <InlineError error={categories.error} onRetry={() => categories.refetch()} title="Couldn't load categories" className="rounded-none border-0" />
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={Tags}
            title={kind === "expense" ? "No expense categories" : "No income categories"}
            description="Add a category so transactions can be labelled and budgeted."
            action={addButton}
          />
        ) : (
          <div>
            {grouped.map((g, gi) => {
              const headingId = `cat-group-${g.group}-${gi}`;
              return (
                <section key={headingId} aria-labelledby={headingId}>
                  <h3 id={headingId} className="flex h-8 items-center justify-between border-b border-line bg-surface-2 px-4 text-meta font-medium text-ink-2 md:px-5">
                    {GROUP_LABEL[g.group]}
                    <span className="tabular font-normal">{g.items.length}</span>
                  </h3>
                  <ul>
                    {g.items.map((c) => (
                      <li key={c.id} className="flex h-10 items-center gap-3 border-b border-line pr-2 pl-4 md:pl-5">
                        <span aria-hidden className="size-2.5 shrink-0 rounded-chip" style={{ background: c.color || "var(--color-line-strong)" }} />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.name}</span>
                        <ActionMenu
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${c.name}`}>
                              <MoreHorizontal />
                            </Button>
                          }
                          items={[
                            { label: "Edit category", icon: <Pencil className="size-4" aria-hidden />, onSelect: () => setEditing(c) },
                            { separator: true },
                            { label: "Archive category", icon: <Archive className="size-4" aria-hidden />, danger: true, onSelect: () => setArchiving(c) },
                          ]}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Panel>

      {editing ? <CategoryFormDialog category={editing === "new" ? null : editing} defaultKind={kind} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Archive ${archiving?.name ?? "category"}?`}
        description="It won't be offered for new transactions or budgets. Existing transactions keep it."
        confirmLabel="Archive category"
        danger
        onConfirm={async () => {
          if (!archiving) return;
          await archiveM.mutateAsync(archiving.id);
          notify.success("Category archived");
        }}
      />
    </section>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(40, "Use 40 characters or fewer"),
  kind: z.enum(["expense", "income"]),
  group: z.enum(["essentials", "lifestyle", "debt", "savings", "income", "other"]),
});
type F = z.infer<typeof schema>;

function CategoryFormDialog({ category, defaultKind, onClose }: { category: Category | null; defaultKind: CategoryKind; onClose: () => void }) {
  const createM = useCreateCategory();
  const updateM = useUpdateCategory();
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: category
      ? { name: category.name, kind: category.kind, group: category.group }
      : { name: "", kind: defaultKind, group: defaultKind === "income" ? "income" : "essentials" },
  });
  const kind = useWatch({ control, name: "kind" });

  const onSubmit = handleSubmit(async (v) => {
    try {
      if (category) await updateM.mutateAsync({ id: category.id, name: v.name, group: v.group });
      else await createM.mutateAsync(v);
      notify.success(category ? "Category updated" : "Category added");
      onClose();
    } catch (err) {
      const msg = applyApiErrors(err, setError, ["name", "kind", "group"]);
      if (msg) notify.error(err, "Couldn't save category");
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={category ? "Edit category" : "Add category"}
      onSubmit={onSubmit}
      submitLabel={category ? "Save category" : "Add category"}
      submitting={createM.isPending || updateM.isPending}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <Field label="Name" htmlFor="cat-name" error={errors.name?.message} required>
          <Input id="cat-name" autoComplete="off" invalid={!!errors.name} {...register("name")} />
        </Field>
        {category ? null : (
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <div className="flex flex-col gap-1.5">
                <span className="text-meta font-medium text-ink">Type</span>
                <SegmentedControl<CategoryKind>
                  aria-label="Category type"
                  fullWidth
                  value={field.value}
                  onChange={(k) => {
                    field.onChange(k);
                    setValue("group", k === "income" ? "income" : "essentials");
                  }}
                  options={[
                    { value: "expense", label: "Expense" },
                    { value: "income", label: "Income" },
                  ]}
                />
              </div>
            )}
          />
        )}
        <Controller
          control={control}
          name="group"
          render={({ field }) => (
            <Dropdown
              label="Group"
              options={GROUPS_FOR[kind].map((g) => ({ value: g, label: GROUP_LABEL[g] }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.group?.message}
            />
          )}
        />
      </div>
    </FormDialog>
  );
}
