"use client";
import type { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useMemo } from "react";
import { Avatar, DataTable, Money } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import type { Transaction, TransactionSort } from "@/lib/types";
import { CategoryLabel } from "./CategoryDot";
import { accountName, txnCategory, txnCurrency, txnFlow, txnTitle, type TxnLookups } from "./format";

export const PAGE_SIZE_OPTIONS = [25, 50, 100];

function toSortModel(sort: TransactionSort): GridSortModel {
  const desc = sort.startsWith("-");
  return [{ field: desc ? sort.slice(1) : sort, sort: desc ? "desc" : "asc" }];
}

/** Desktop table: dense rows, server-side pagination and sorting (date, amount). */
export function TransactionsGrid({
  rows,
  total,
  loading,
  page,
  pageSize,
  sort,
  lookups,
  onPageChange,
  onSortChange,
  onOpen,
}: {
  rows: Transaction[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  sort: TransactionSort;
  lookups: TxnLookups;
  onPageChange: (page: number, pageSize: number) => void;
  onSortChange: (sort: TransactionSort) => void;
  onOpen: (t: Transaction) => void;
}) {
  const columns = useMemo<GridColDef<Transaction>[]>(
    () => [
      {
        field: "date",
        headerName: "Date",
        width: 116,
        renderCell: ({ row }) => <span className="tabular text-ink-2">{formatDate(row.date)}</span>,
      },
      {
        field: "merchant",
        headerName: "Merchant",
        flex: 1.6,
        minWidth: 180,
        sortable: false,
        renderCell: ({ row }) => (
          <div className="flex h-full min-w-0 items-center gap-2">
            <span className="truncate font-medium text-ink">{txnTitle(row, lookups)}</span>
            {row.note ? <span className="min-w-0 truncate text-meta text-ink-2">{row.note}</span> : null}
          </div>
        ),
      },
      {
        field: "categoryId",
        headerName: "Category",
        flex: 1,
        minWidth: 140,
        sortable: false,
        renderCell: ({ row }) => (
          <div className="flex h-full min-w-0 items-center text-ink">
            <CategoryLabel
              category={row.type === "transfer" || !row.categoryId ? null : lookups.categories.get(row.categoryId)}
              label={txnCategory(row, lookups)}
            />
          </div>
        ),
      },
      {
        field: "accountId",
        headerName: "Account",
        flex: 1,
        minWidth: 140,
        sortable: false,
        renderCell: ({ row }) => (
          <div className="flex h-full min-w-0 items-center text-ink-2">
            {row.type === "transfer" ? (
              <span className="truncate">
                {accountName(row.accountId, lookups)} <span className="text-ink-2">to</span> {accountName(row.toAccountId, lookups)}
              </span>
            ) : (
              <span className="truncate">{accountName(row.accountId, lookups)}</span>
            )}
          </div>
        ),
      },
      {
        field: "createdByName",
        headerName: "Added by",
        width: 92,
        sortable: false,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) =>
          row.createdByName ? (
            <div className="flex h-full items-center justify-center">
              <Avatar name={row.createdByName} size="sm" title={`Added by ${row.createdByName}`} />
            </div>
          ) : (
            <span className="text-ink-2">—</span>
          ),
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 150,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }) => (
          <Money
            fils={row.amountFils}
            currency={txnCurrency(row, lookups)}
            flow={txnFlow(row)}
            tone={row.type === "transfer" ? "muted" : undefined}
            className="font-medium"
          />
        ),
      },
    ],
    [lookups],
  );

  return (
    <DataTable<Transaction>
      aria-label="Transactions"
      rows={rows}
      columns={columns}
      getRowId={(r) => r.id}
      rowCount={total}
      loading={loading}
      autoHeight
      paginationMode="server"
      sortingMode="server"
      sortingOrder={["desc", "asc"]}
      paginationModel={{ page: page - 1, pageSize }}
      onPaginationModelChange={(m) => onPageChange(m.pageSize !== pageSize ? 1 : m.page + 1, m.pageSize)}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      sortModel={toSortModel(sort)}
      onSortModelChange={(m) => {
        const s = m[0];
        if (!s?.sort) return onSortChange(sort.startsWith("-") ? (sort.slice(1) as TransactionSort) : (`-${sort}` as TransactionSort));
        onSortChange((s.sort === "desc" ? `-${s.field}` : s.field) as TransactionSort);
      }}
      onRowClick={(p) => onOpen(p.row)}
      onCellKeyDown={(p, e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(p.row);
        }
      }}
      sx={{ border: 0, borderRadius: 0, "& .MuiDataGrid-row": { cursor: "pointer" } }}
    />
  );
}
