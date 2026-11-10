"use client";
import { MemberAvatar } from "@/components/members/MemberAvatar";
import { DesktopOnly } from "@/components/ui/DesktopOnly";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { useMemo } from "react";
import type { GridColDef } from "@mui/x-data-grid";
import { Button, DataTable, EmptyState, InlineError, Money, Panel, SkeletonList, buttonClasses, numericColumn } from "@/components/ui";
import { useTransactionDialog } from "@/components/transactions/TransactionDialogProvider";
import { useElementWidth } from "@/features/common/useElementWidth";
import { formatDate, formatDayLabel, todayISO } from "@/lib/dates";
import { formatFils } from "@/lib/money";
import type { Account, Category, Transaction } from "@/lib/types";
import { ItemsHint, ReviewBadge } from "@/features/transactions/review";
import { businessFlow, txnCategory, txnTitle } from "@/features/transactions/format";

interface Row {
  id: string;
  date: string;
  title: string;
  category: string;
  account: string;
  addedBy: string;
  addedById: string;
  amount: number;
  type: Transaction["type"];
  currency: string;
  txn: Transaction;
}

function toRows(items: Transaction[], categories: Category[], accounts: Account[]): Row[] {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const acct = new Map(accounts.map((a) => [a.id, a]));
  const lookups = { accounts: acct, categories: new Map(categories.map((c) => [c.id, c])) };
  return items.map((t) => {
    const account = acct.get(t.accountId);
    // Transfers to/from a business account read "From/To <account>" (household income/spending).
    const biz = businessFlow(t, lookups);
    const category = biz
      ? txnCategory(t, lookups)
      : t.type === "transfer"
        ? "Transfer"
        : (t.categoryId && catName.get(t.categoryId)) || "Uncategorised";
    const title =
      t.merchant ||
      (biz
        ? txnTitle(t, lookups)
        : t.type === "transfer"
          ? `Transfer to ${acct.get(t.toAccountId ?? "")?.name ?? "account"}`
          : t.type === "income"
            ? "Income"
            : category);
    return {
      id: t.id,
      date: t.date,
      title,
      category,
      account: account?.name ?? "—",
      addedBy: t.createdByName ?? "",
      addedById: t.createdBy,
      amount: t.amountFils,
      type: t.type,
      currency: account?.currency ?? "AED",
      txn: t,
    };
  });
}

function TruncCell({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`block truncate ${className ?? ""}`} title={text}>
      {text}
    </span>
  );
}

function Amount({ row }: { row: Row }) {
  return (
    <Money
      fils={row.amount}
      currency={row.currency}
      flow={row.type === "income" ? "in" : row.type === "expense" ? "out" : "neutral"}
      tone={row.type === "transfer" ? "muted" : undefined}
      className="font-medium"
    />
  );
}

/** Dense recent-transactions table (desktop) / list rows (phone). Rows open the edit dialog. */
export function RecentTransactionsPanel({
  items,
  categories,
  accounts,
  loading,
  error,
  onRetry,
  title,
  viewAllHref,
  className,
}: {
  items: Transaction[];
  categories: Category[];
  accounts: Account[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  title: string;
  viewAllHref: string;
  className?: string;
}) {
  const { openEdit, openCreate } = useTransactionDialog();
  const rows = useMemo(() => toRows(items, categories, accounts), [items, categories, accounts]);
  const today = todayISO();

  // Fit the table to its panel (2/3 of the row at ≥1280px): fixed date/avatar/amount widths,
  // text columns flex and ellipsize, and Account drops out when the panel is narrow.
  const [tableRef, tableWidth] = useElementWidth();
  const showAccount = tableWidth === 0 || tableWidth >= 640;
  const columns = useMemo<GridColDef<Row>[]>(
    () => [
      {
        field: "date",
        headerName: "Date",
        width: 100, // fits "27 Dec 2025": short dates keep the year outside the current year
        sortable: false,
        valueFormatter: (v: string) => formatDate(v, true),
        cellClassName: "tabular text-ink-2",
      },
      {
        field: "title",
        headerName: "Merchant",
        flex: 1.4,
        minWidth: 110,
        sortable: false,
        renderCell: ({ row }) => (
          <span className="flex h-full min-w-0 items-center gap-1.5">
            <TruncCell text={row.title} className="min-w-0 font-medium text-ink" />
            <ReviewBadge t={row.txn} compact />
          </span>
        ),
      },
      {
        field: "category",
        headerName: "Category",
        flex: 1,
        minWidth: 90,
        sortable: false,
        renderCell: ({ row }) => <TruncCell text={row.category} className="text-ink-2" />,
      },
      ...(showAccount
        ? [
            {
              field: "account",
              headerName: "Account",
              flex: 1,
              minWidth: 100,
              sortable: false,
              renderCell: ({ row }: { row: Row }) => <TruncCell text={row.account} className="text-ink-2" />,
            } satisfies GridColDef<Row>,
          ]
        : []),
      {
        field: "addedBy",
        headerName: "Added by",
        width: 80,
        sortable: false,
        renderCell: ({ row }) =>
          row.addedBy ? (
            <span className="flex h-full items-center">
              <MemberAvatar userId={row.addedById} name={row.addedBy} size="sm" title={`Added by ${row.addedBy}`} />
            </span>
          ) : (
            <span className="text-ink-2">—</span>
          ),
      },
      {
        field: "amount",
        headerName: "Amount",
        ...numericColumn,
        width: 132,
        minWidth: 132,
        sortable: false,
        renderCell: ({ row }) => <Amount row={row} />,
      },
    ],
    [showAccount],
  );

  return (
    <Panel
      className={className}
      title={title}
      actions={
        <Link href={viewAllHref} className={buttonClasses("ghost", "sm")}>
          View all
        </Link>
      }
      flush
    >
      {loading ? (
        <SkeletonList rows={8} className="px-4 md:px-5" />
      ) : error ? (
        <InlineError className="m-4 border-0 p-0" error={error} onRetry={onRetry} title="Couldn't load transactions" />
      ) : rows.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={Receipt}
          title="No transactions in this period"
          description="Record your first expense or income and it will show here."
          action={
            <Button variant="secondary" size="sm" onClick={() => openCreate()}>
              <Plus aria-hidden /> Add transaction
            </Button>
          }
        />
      ) : (
        <>
          <DesktopOnly className="hidden md:block">
            <div ref={tableRef} className="min-w-0">
              <DataTable<Row>
                rows={rows}
                columns={columns}
                autoHeight
                hideFooter
                disableColumnResize
                onRowClick={({ row }) => openEdit(row.txn)}
                onCellKeyDown={({ row }, e) => {
                  if (e.key === "Enter") openEdit(row.txn);
                }}
                getRowClassName={() => "cursor-pointer"}
                aria-label={title}
                sx={{ border: 0, borderRadius: 0 }}
              />
            </div>
          </DesktopOnly>
          <ul className="divide-y divide-line md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => openEdit(r.txn)}
                  className="flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-2 text-left hover:bg-surface-2"
                  aria-label={`Edit ${r.title}, ${formatFils(r.amount, r.currency)}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink">{r.title}</span>
                      <ReviewBadge t={r.txn} compact />
                    </span>
                    <span className="flex min-w-0 gap-2 text-xs text-ink-2">
                      <span className="shrink-0">{formatDayLabel(r.date, today)}</span>
                      <span className="min-w-0 truncate">{r.category}</span>
                      <ItemsHint t={r.txn} />
                    </span>
                  </span>
                  <Amount row={r} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
