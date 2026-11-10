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
import { useElementWidth } from "@/features/common/useElementWidth";
import { formatDate, todayISO } from "@/lib/dates";
import { formatBps } from "@/lib/money";
import { useAccounts, useArchiveDebt, useDebts } from "@/lib/queries";
import type { Account, AccountType, Debt } from "@/lib/types";
import { DebtFormDialog, type DebtPrefill } from "./DebtFormDialog";
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

/** Credit card and loan accounts: payments on debts linked to them are transfers, not expenses. */
function isDebtAccount(type?: AccountType) {
  return type === "credit_card" || type === "loan";
}

function linkedBalanceLabel(type?: AccountType) {
  return type === "credit_card" ? "Card balance" : type === "loan" ? "Loan account balance" : "Linked account balance";
}

/** Card and loan accounts that owe money but have no debt linked, so the payoff plan misses them. */
function UntrackedAccountsPanel({ accounts, onAdd }: { accounts: Account[]; onAdd: (a: Account) => void }) {
  if (!accounts.length) return null;
  const owed = accounts.reduce((s, a) => s - a.balanceFils, 0);
  return (
    <Panel
      title="Cards and loans not in your plan"
      description={
        <>
          These accounts owe <Money fils={owed} noDecimals className="font-medium text-ink" /> in total. Add each as a debt with its
          interest rate and minimum payment to include it in the payoff plan.
        </>
      }
      flush
    >
      <ul className="divide-y divide-line">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{a.name}</span>
              <span className="block truncate text-meta text-ink-2">
                {a.type === "loan" ? "Loan" : "Credit card"}
                {a.institution ? `, ${a.institution}` : ""}
              </span>
              <Money fils={a.balanceFils} className="mt-0.5 block text-sm font-medium sm:hidden" tone="danger" />
            </span>
            <Money fils={a.balanceFils} className="hidden text-sm font-medium sm:inline" tone="danger" />
            <Button variant="secondary" size="sm" onClick={() => onAdd(a)} aria-label={`Add ${a.name} as a debt`}>
              <Plus aria-hidden /> Add as debt
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function DebtsTab() {
  const debts = useDebts();
  const accounts = useAccounts();
  const archiveM = useArchiveDebt();
  const [editing, setEditing] = useState<Debt | "new" | null>(null);
  const [prefill, setPrefill] = useState<DebtPrefill | undefined>(undefined);
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
  const viewingLinked = viewing?.accountId ? (accounts.data ?? []).find((a) => a.id === viewing.accountId) : undefined;
  const total = rows.reduce((s, d) => s + d.balanceFils, 0);
  const mins = rows.reduce((s, d) => s + Math.min(d.minPaymentFils, d.balanceFils), 0);
  const weightedApr = total > 0 ? Math.round(rows.reduce((s, d) => s + d.aprBps * d.balanceFils, 0) / total) : 0;
  const linkedIds = new Set((debts.data ?? []).map((d) => d.accountId).filter(Boolean));
  const untracked = debts.data
    ? (accounts.data ?? []).filter((a) => isDebtAccount(a.type) && !a.archived && a.balanceFils < 0 && !linkedIds.has(a.id))
    : [];
  const addFromAccount = (a: Account) => {
    setPrefill({ name: a.name, kind: a.type === "loan" ? "personal_loan" : "credit_card", balanceFils: -a.balanceFils, accountId: a.id });
    setEditing("new");
  };
  const accountName = (id?: string | null) => (id ? (accounts.data ?? []).find((a) => a.id === id)?.name : undefined);

  const rowMenu = (d: Debt) => (
    <ActionMenu
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${d.name}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      }
      items={[
        {
          label: "Record payment",
          icon: <HandCoins className="size-4" aria-hidden />,
          disabled: d.balanceFils <= 0,
          onSelect: () => setPaying(d),
        },
        {
          label: "Edit debt",
          icon: <Pencil className="size-4" aria-hidden />,
          onSelect: () => setEditing(d),
        },
        { separator: true },
        {
          label: "Archive debt",
          icon: <Archive className="size-4" aria-hidden />,
          danger: true,
          onSelect: () => setArchiving(d),
        },
      ]}
    />
  );

  // Fit the panel: drop the least useful columns as the table narrows (Due day repeats Next due).
  const [tableRef, tableWidth] = useElementWidth();
  const fits = (min: number) => tableWidth === 0 || tableWidth >= min;
  const columns: GridColDef<DebtRow>[] = [
    {
      field: "name",
      headerName: "Name",
      flex: 1.4,
      minWidth: 120,
      renderCell: ({ row }) => (
        <span className="block truncate font-medium text-ink" title={row.name}>
          {row.name}
        </span>
      ),
    },
    ...(fits(972)
      ? [
          {
            field: "kind",
            headerName: "Type",
            flex: 1,
            minWidth: 110,
            valueGetter: (_v: unknown, row: DebtRow) => DEBT_KIND_LABEL[row.kind],
          } satisfies GridColDef<DebtRow>,
        ]
      : []),
    ...(fits(862)
      ? [
          {
            field: "accountId",
            headerName: "Linked account",
            flex: 1,
            minWidth: 120,
            sortable: false,
            renderCell: ({ row }: { row: DebtRow }) => {
              const name = accountName(row.accountId);
              return name ? (
                <span className="block truncate text-ink-2" title={name}>
                  {name}
                </span>
              ) : (
                <span className="text-ink-2">—</span>
              );
            },
          } satisfies GridColDef<DebtRow>,
        ]
      : []),
    {
      field: "balanceFils",
      headerName: "Balance",
      width: 136,
      ...numericColumn,
      renderCell: ({ row }) => <Money fils={row.balanceFils} tone={row.balanceFils > 0 ? "danger" : undefined} />,
    },
    {
      field: "aprBps",
      headerName: "APR",
      width: 88,
      ...numericColumn,
      renderCell: ({ row }) => <span className="tabular">{formatBps(row.aprBps)}</span>,
    },
    {
      field: "minPaymentFils",
      headerName: "Min payment",
      width: 124,
      ...numericColumn,
      renderCell: ({ row }) => <Money fils={row.minPaymentFils} />,
    },
    ...(fits(1052)
      ? [
          {
            field: "dueDay",
            headerName: "Due day",
            width: 80,
            ...numericColumn,
            renderCell: ({ row }: { row: DebtRow }) => <span className="tabular">{ordinal(row.dueDay)}</span>,
          } satisfies GridColDef<DebtRow>,
        ]
      : []),
    {
      field: "nextDue",
      headerName: "Next due",
      width: 208,
      display: "flex",
      renderCell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="tabular">{formatDate(row.nextDue)}</span>
          <DueBadge days={row.daysToDue} settled={row.balanceFils <= 0} />
        </span>
      ),
    },
    {
      field: "actions",
      headerName: "",
      width: 56,
      sortable: false,
      align: "right",
      display: "flex",
      renderCell: ({ row }) => rowMenu(row),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <UntrackedAccountsPanel accounts={untracked} onAdd={addFromAccount} />
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
              {
                label: "Total debt",
                value: <Money fils={total} noDecimals tone="danger" />,
              },
              {
                label: "Monthly minimums",
                value: <Money fils={mins} noDecimals />,
              },
              {
                label: "Average APR",
                value: formatBps(weightedApr),
                hint: "Weighted by balance",
              },
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
              <div ref={tableRef} className="min-w-0">
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
              </div>
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
          <>
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
              <DetailRow label="Linked account">{viewing.accountId ? (accountName(viewing.accountId) ?? "Archived account") : "None"}</DetailRow>
              {viewing.accountId && viewing.linkedAccountBalanceFils != null ? (
                <DetailRow label={linkedBalanceLabel(viewingLinked?.type)}>
                  <Money
                    fils={viewing.linkedAccountBalanceFils}
                    tone={isDebtAccount(viewingLinked?.type) && viewing.linkedAccountBalanceFils < 0 ? "danger" : undefined}
                  />
                </DetailRow>
              ) : null}
            </dl>
            {viewingLinked && isDebtAccount(viewingLinked.type) ? (
              <p className="pt-3 text-meta text-ink-2">
                Payments move money from the paying account to {viewingLinked.name}.
                {viewingLinked.type === "credit_card" ? " Card purchases already count as spending." : ""}
              </p>
            ) : null}
          </>
        ) : null}
      </DetailDrawer>

      {editing ? <DebtFormDialog
          debt={editing === "new" ? null : editing}
          prefill={editing === "new" ? prefill : undefined}
          onClose={() => {
            setEditing(null);
            setPrefill(undefined);
          }}
        /> : null}
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
