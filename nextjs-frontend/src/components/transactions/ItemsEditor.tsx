"use client";
import { AlertTriangle, CheckCircle2, Plus, X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatFils } from "@/lib/money";
import type { TxnItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One editable line: name, optional line total (fils) and optional quantity (text while typing). */
export interface ItemDraft {
  key: string;
  name: string;
  amountFils: number | null;
  qty: string;
}

let seq = 0;
const newKey = () => `item-${Date.now().toString(36)}-${(seq += 1)}`;

export function toDrafts(items: TxnItem[] | null | undefined): ItemDraft[] {
  return (items ?? []).map((i) => ({
    key: newKey(),
    name: i.name,
    amountFils: i.amountFils ?? null,
    qty: i.quantity != null ? String(i.quantity) : "",
  }));
}

export const emptyDraft = (): ItemDraft => ({ key: newKey(), name: "", amountFils: null, qty: "" });

const MAX_NAME = 200;

/** Drafts → API items. Blank rows are dropped; a priced row without a name is an error. */
export function fromDrafts(drafts: ItemDraft[]): { items: TxnItem[]; error: string | null } {
  const items: TxnItem[] = [];
  for (const d of drafts) {
    const name = d.name.trim();
    const qty = Number.parseFloat(d.qty.replace(",", "."));
    if (!name && d.amountFils == null && !d.qty.trim()) continue;
    if (!name) return { items, error: "Give every item a name, or remove the empty row." };
    if (name.length > MAX_NAME) return { items, error: `Item names can be at most ${MAX_NAME} characters.` };
    if (d.qty.trim() && !(qty > 0)) return { items, error: `Quantity for "${name}" must be a number above 0.` };
    items.push({
      name,
      amountFils: d.amountFils != null && d.amountFils > 0 ? d.amountFils : null,
      quantity: d.qty.trim() ? qty : null,
    });
  }
  return { items, error: null };
}

export function itemsSum(items: { amountFils?: number | null }[]): number {
  return items.reduce((s, i) => s + (i.amountFils ?? 0), 0);
}

/** "Items AED 40.00 of AED 52.50 · AED 12.50 not itemised", or a warning when items exceed the total. */
export function ItemsTotalLine({
  sumFils,
  totalFils,
  currency = "AED",
  className,
}: {
  sumFils: number;
  totalFils: number | null | undefined;
  currency?: string;
  className?: string;
}) {
  if (!sumFils) return null;
  const total = totalFils ?? 0;
  const diff = total - sumFils;
  const over = total > 0 && diff < 0;
  return (
    <p
      className={cn("flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs", over ? "text-warn" : "text-ink-2", className)}
      role={over ? "alert" : undefined}
    >
      {over ? <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> : diff === 0 ? <CheckCircle2 className="size-3.5 shrink-0 text-accent" aria-hidden /> : null}
      <span className="tabular">
        Items {formatFils(sumFils, currency)}
        {total > 0 ? ` of ${formatFils(total, currency)}` : ""}
        {total > 0
          ? over
            ? `, ${formatFils(-diff, currency)} more than the total`
            : diff === 0
              ? ", matches the total"
              : `, ${formatFils(diff, currency)} not itemised`
          : ""}
      </span>
    </p>
  );
}

/** Add/remove rows of line items (name, optional amount, optional qty) with a running sum vs the total. */
export function ItemsEditor({
  value,
  onChange,
  totalFils,
  currency = "AED",
  error,
  className,
}: {
  value: ItemDraft[];
  onChange: (next: ItemDraft[]) => void;
  totalFils: number | null | undefined;
  currency?: string;
  error?: string | null;
  className?: string;
}) {
  const baseId = useId();
  const update = (key: string, patch: Partial<ItemDraft>) => onChange(value.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const sum = itemsSum(value);

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {value.length > 0 ? (
        <ul className="flex min-w-0 flex-col gap-2" aria-label="Items">
          {value.map((d, i) => (
            <li
              key={d.key}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_4rem_2.25rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_4rem_2.25rem]"
            >
              <Input
                id={`${baseId}-name-${i}`}
                aria-label={`Item ${i + 1} name`}
                placeholder="Item name"
                autoComplete="off"
                maxLength={MAX_NAME}
                value={d.name}
                onChange={(e) => update(d.key, { name: e.target.value })}
                className="col-span-3 sm:col-span-1"
              />
              <MoneyInput
                aria-label={`Item ${i + 1} amount`}
                currency={currency}
                placeholder="Amount"
                value={d.amountFils}
                onChange={(f) => update(d.key, { amountFils: f })}
                className="col-span-1"
              />
              <Input
                aria-label={`Item ${i + 1} quantity`}
                placeholder="Qty"
                inputMode="decimal"
                autoComplete="off"
                value={d.qty}
                onChange={(e) => /^[\d.,]*$/.test(e.target.value) && update(d.key, { qty: e.target.value })}
                className="tabular text-right"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove item ${d.name || i + 1}`}
                onClick={() => onChange(value.filter((x) => x.key !== d.key))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <ItemsTotalLine sumFils={sum} totalFils={totalFils} currency={currency} />
      <div>
        <Button variant="secondary" size="sm" onClick={() => onChange([...value, emptyDraft()])}>
          <Plus /> {value.length ? "Add another item" : "Add items"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Read-only list of items with the sum vs the transaction amount. */
export function ItemsList({ items, totalFils, currency = "AED" }: { items: TxnItem[]; totalFils: number; currency?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ul className="divide-y divide-line rounded-container border border-line">
        {items.map((it, i) => (
          <li key={`${it.name}-${i}`} className="flex min-h-10 min-w-0 items-center gap-3 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 break-words text-ink">{it.name}</span>
            {it.quantity != null ? <span className="tabular shrink-0 text-xs text-ink-2">× {it.quantity}</span> : null}
            <span className="tabular shrink-0 font-medium text-ink">{it.amountFils != null ? formatFils(it.amountFils, currency) : "—"}</span>
          </li>
        ))}
      </ul>
      <ItemsTotalLine sumFils={itemsSum(items)} totalFils={totalFils} currency={currency} />
    </div>
  );
}
