"use client";
import { DesktopOnly } from "@/components/ui/DesktopOnly";
import type { GridColDef } from "@mui/x-data-grid";
import { Archive, CreditCard, HandCoins, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import {
  ActionMenu,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  DetailDrawer,
  DetailRow,
  EmptyState,
  InlineError,
  Money,
  notify,
  numericColumn,
  Panel,
  SkeletonList,
} from "@/components/ui";
import { formatDate, todayISO } from "@/lib/dates";
import { formatBps } from "@/lib/money";
import { useAccounts, useArchiveDebt, useDebts } from "@/lib/queries";
import type { Debt } from "@/lib/types";
import { DebtFormDialog } from "./DebtFormDialog";
import { DebtPaymentDialog } from "./DebtPaymentDialog";
import { SummaryStrip } from "./SummaryStrip";
import { daysBetween, DEBT_KIND_LABEL, monthlyInterestFils, nextDueDate, ordinal } from "./labels";

interface DebtRow extends Debt {
  nextDue: string;
  daysToDue: number;
}

function DueBadge({ days, settled }: { days: number; settled: boolean }) {
  if (settled || days > 7) return null;
  return <Badge tone="warn">{days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`}</Badge>;
}

export function DebtsTab() {
  const debts = useDebts();
  const accounts = useAccounts();
  const archiveM = useArchiveDebt();
  const [editing, setEditing] = useState<Debt | "new" | null>(null);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [archiving, setArchiving] = useState<Debt | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const today = todayISO();
  const rows: DebtRow[] = [...(debts.data ?? [])]
    .sort((a, b) => b.aprBps - a.aprBps || b.balanceFils - a.balanceFils)
    .map((d) => {
      const nextDue = nextDueDate(d.dueDay, today);
      return { ...d, nextDue, daysToDue: daysBetween(today, nextDue) };
    });
  const viewing = rows.find((r) => r.id === viewingId) ?? null;
  const total = rows.reduce((s, d) => s + d.balanceFils, 0);
  const mins = rows.reduce((s, d) => s + Math.min(d.minPaymentFils, d.balanceFils), 0);
  const weightedApr = total > 0 ? Math.round(rows.reduce((s, d) => s + d.aprBps * d.balanceFils, 0) / total) : 0;
  const accountName = (id?: string | null) => (id ? (accounts.data ?? []).find((a) => a.id === id)?.name : undefined);

  const rowMenu = (d: Debt) => (
    <ActionMenu
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${d.name}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      }
      items={[
        { label: "Record payment", icon: <HandCoins className="size-4" aria-hidden />, disabled: d.balanceFils <= 0, onSelect: () => setPaying(d) },
        { label: "Edit debt", icon: <Pencil className="size-4" aria-hidden />, onSelect: () => setEditing(d) },
        { separator: true },
        { label: "Archive debt", icon: <Archive className="size-4" aria-hidden />, danger: true, onSelect: () => setArchiving(d) },
      ]}
    />
  );

  const columns: GridColDef<DebtRow>[] = [
    {
      field: "name",
      headerName: "Name",
      flex: 1.4,
      minWidth: 180,
      renderCell: ({ row }) => <span className="truncate font-medium text-ink">{row.name}</span>,
    },
    { field: "kind", headerName: "Type", flex: 1, minWidth: 130, valueGetter: (_v, row) => DEBT_KIND_LABEL[row.kind] },
    {
      field: "balanceFils",
      headerName: "Balance",
      width: 150,
      ...numericColumn,
      renderCell: ({ row }) => <Money fils={row.balanceFils} tone={row.balanceFils > 0 ? "danger" : undefined} />,
    },
    { field: "aprBps", headerName: "APR", width: 96, ...numericColumn, renderCell: ({ row }) => <span className="tabular">{formatBps(row.aprBps)}</span> },
    { field: "minPaymentFils", headerName: "Min payment", width: 140, ...numericColumn, renderCell: ({ row }) => <Money fils={row.minPaymentFils} /> },
    { field: "dueDay", headerName: "Due day", width: 90, ...numericColumn, renderCell: ({ row }) => <span className="tabular">{ordinal(row.dueDay)}</span> },
    {
      field: "nextDue",
      headerName: "Next due",
      width: 220,
      display: "flex",
      renderCell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="tabular">{formatDate(row.nextDue)}</span>
          <DueBadge days={row.daysToDue} settled={row.balanceFils <= 0} />
        </span>
      ),
    },
    { field: "actions", headerName: "", width: 56, sortable: false, align: "right", display: "flex", renderCell: ({ row }) => rowMenu(row) },
  ];

  return (
    <div className="flex flex-col gap-5">
      {debts.isPending ? (
        <Panel flush>
          <SkeletonList rows={4} className="px-4" />
        </Panel>
      ) : debts.isError ? (
        <InlineError error={debts.error} onRetry={() => debts.refetch()} title="Couldn't load debts" />
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={CreditCard}
            title="No debts tracked yet"
            description="Add each credit card and loan with its balance, APR and minimum payment to get a payoff plan."
            action={
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus aria-hidden /> Add debt
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          <SummaryStrip
            label="Debt summary"
            items={[
              { label: "Total debt", value: <Money fils={total} noDecimals tone="danger" /> },
              { label: "Monthly minimums", value: <Money fils={mins} noDecimals /> },
              { label: "Average APR", value: formatBps(weightedApr), hint: "Weighted by balance" },
            ]}
          />
          <Panel
            title="Debts"
            description="Highest interest rate first. Select a row for details."
            actions={
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus aria-hidden /> Add debt
              </Button>
            }
            flush
          >
            <DesktopOnly className="hidden md:block">
              <DataTable<DebtRow>
                rows={rows}
                columns={columns}
                autoHeight
                hideFooter
                aria-label="Debts"
                onRowClick={({ row }) => setViewingId(row.id)}
                onCellKeyDown={(params, e) => {
                  if (e.key === "Enter" && params.field !== "actions") setViewingId(params.row.id);
                }}
                sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
              />
            </DesktopOnly>
            <ul className="divide-y divide-line md:hidden">
              {rows.map((d) => (
                <li key={d.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setViewingId(d.id)}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pr-2 pl-4 text-left hover:bg-surface-2 focus-visible:-outline-offset-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{d.name}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
                        <span className="tabular">{formatBps(d.aprBps)} APR</span>
                        <span className="tabular">Due {formatDate(d.nextDue, true)}</span>
                        <DueBadge days={d.daysToDue} settled={d.balanceFils <= 0} />
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Money fils={d.balanceFils} noDecimals tone={d.balanceFils > 0 ? "danger" : undefined} className="text-sm font-medium" />
                      <p className="text-xs text-ink-2">{DEBT_KIND_LABEL[d.kind]}</p>
                    </div>
                  </button>
                  <div className="pr-2">{rowMenu(d)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}

      <DetailDrawer
        open={viewing !== null}
        onOpenChange={(o) => !o && setViewingId(null)}
        title={viewing?.name ?? "Debt"}
        description={viewing ? DEBT_KIND_LABEL[viewing.kind] : undefined}
        actions={
          viewing ? (
            <>
              <Button
                variant="ghost"
                className="mr-auto text-danger hover:text-danger"
                onClick={() => {
                  setArchiving(viewing);
                }}
              >
                <Archive aria-hidden /> Archive
              </Button>
              <Button variant="secondary" onClick={() => setEditing(viewing)}>
                <Pencil aria-hidden /> Edit
              </Button>
              <Button onClick={() => setPaying(viewing)} disabled={viewing.balanceFils <= 0}>
                Record payment
              </Button>
            </>
          ) : null
        }
      >
        {viewing ? (
          <dl>
            <DetailRow label="Balance">
              <Money fils={viewing.balanceFils} tone={viewing.balanceFils > 0 ? "danger" : undefined} />
            </DetailRow>
            <DetailRow label="Interest rate (APR)">
              <span className="tabular">{formatBps(viewing.aprBps)}</span>
            </DetailRow>
            <DetailRow label="Interest this month (estimate)">
              <Money fils={monthlyInterestFils(viewing.balanceFils, viewing.aprBps)} />
            </DetailRow>
            <DetailRow label="Minimum payment">
              <Money fils={viewing.minPaymentFils} />
            </DetailRow>
            <DetailRow label="Due day">{ordinal(viewing.dueDay)} of each month</DetailRow>
            <DetailRow label="Next due">
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                <span className="tabular">{formatDate(viewing.nextDue)}</span>
                <DueBadge days={viewing.daysToDue} settled={viewing.balanceFils <= 0} />
              </span>
            </DetailRow>
            <DetailRow label="Linked account">{accountName(viewing.accountId) ?? "None"}</DetailRow>
          </dl>
        ) : null}
      </DetailDrawer>

      {editing ? <DebtFormDialog debt={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {paying ? <DebtPaymentDialog debt={paying} onClose={() => setPaying(null)} /> : null}
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Archive ${archiving?.name ?? "debt"}?`}
        description="It will be hidden from lists and left out of the payoff plan. Its payment history stays."
        confirmLabel="Archive debt"
        danger
        onConfirm={async () => {
          if (!archiving) return;
          await archiveM.mutateAsync(archiving.id);
          if (viewingId === archiving.id) setViewingId(null);
          notify.success("Debt archived");
        }}
      />
    </div>
  );
}
