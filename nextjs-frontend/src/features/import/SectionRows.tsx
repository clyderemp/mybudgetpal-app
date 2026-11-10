"use client";
import { formatDate } from "@/lib/dates";
import type { ImportRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AmountCell,
  CategoryPicker,
  CounterAccountPicker,
  DescriptionText,
  IncludeToggle,
  MerchantField,
  ReasonText,
  RowMenu,
  StatusChip,
} from "./RowControls";

/** Desktop table (≥1024px) for one statement section. */
export function RowsTable({ rows, caption }: { rows: ImportRow[]; caption: string }) {
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">{caption}</caption>
      <colgroup>
        <col className="w-11" />
        <col className="w-24" />
        <col />
        <col className="w-[30%]" />
        <col className="w-36" />
        <col className="w-11" />
      </colgroup>
      <thead>
        <tr className="h-9 border-b border-line bg-surface-2 text-left text-meta text-ink-2">
          <th scope="col" className="px-1.5 font-medium">
            <span className="sr-only">Include</span>
          </th>
          <th scope="col" className="px-2 font-medium">
            Date
          </th>
          <th scope="col" className="px-2 font-medium">
            Merchant and description
          </th>
          <th scope="col" className="px-2 font-medium">
            Category or account
          </th>
          <th scope="col" className="px-3 text-right font-medium">
            Amount
          </th>
          <th scope="col" className="px-1">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={cn("border-b border-line align-top last:border-b-0", r.action === "skip" && "bg-surface-2/50")}>
            <td className="px-1.5 py-2">
              <IncludeToggle row={r} />
            </td>
            <td className="tabular px-2 py-2 pt-3.5 whitespace-nowrap text-ink-2">{formatDate(r.date, true)}</td>
            <td className="min-w-0 px-2 py-2">
              <MerchantField row={r} />
              <DescriptionText row={r} className="mt-1" />
              <ReasonText row={r} />
            </td>
            <td className="min-w-0 px-2 py-2">
              <CategoryPicker row={r} />
              <CounterAccountPicker row={r} />
            </td>
            <td className="px-3 py-2 pt-3 text-right">
              <AmountCell row={r} className="block text-sm font-semibold" />
              <span className="mt-1 flex justify-end">
                <StatusChip row={r} />
              </span>
            </td>
            <td className="px-1 py-2">
              <RowMenu row={r} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Phone / tablet card list for one statement section. */
export function RowsCards({ rows }: { rows: ImportRow[] }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className={cn("flex min-w-0 gap-1 py-3 pr-2 pl-1.5", r.action === "skip" && "bg-surface-2/50")}>
          <IncludeToggle row={r} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <MerchantField row={r} />
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="tabular text-meta text-ink-2">{formatDate(r.date, true)}</span>
                <StatusChip row={r} />
              </span>
              <AmountCell row={r} className="text-sm font-semibold" />
            </div>
            <div className="min-w-0">
              <DescriptionText row={r} />
              <ReasonText row={r} />
            </div>
            <CategoryPicker row={r} />
            <CounterAccountPicker row={r} />
          </div>
          <RowMenu row={r} />
        </li>
      ))}
    </ul>
  );
}
