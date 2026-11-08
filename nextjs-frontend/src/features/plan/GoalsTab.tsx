"use client";
import { DesktopOnly } from "@/components/ui/DesktopOnly";
import type { GridColDef } from "@mui/x-data-grid";
import { Archive, MoreHorizontal, Pencil, PiggyBank, Plus } from "lucide-react";
import { useState } from "react";
import {
  ActionMenu,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  InlineError,
  Money,
  notify,
  numericColumn,
  Panel,
  ProgressBar,
  SkeletonList,
} from "@/components/ui";
import { formatDate, todayISO } from "@/lib/dates";
import { formatPercent } from "@/lib/money";
import { useArchiveGoal, useGoals } from "@/lib/queries";
import type { Goal } from "@/lib/types";
import { GoalContributeDialog } from "./GoalContributeDialog";
import { GoalFormDialog } from "./GoalFormDialog";
import { SummaryStrip } from "./SummaryStrip";

type GoalStatus = { kind: "done" } | { kind: "monthly"; fils: number; months: number } | { kind: "overdue"; remaining: number } | { kind: "open"; remaining: number };

interface GoalRow extends Goal {
  ratio: number;
  remaining: number;
  status: GoalStatus;
}

/** Months left to save, counting the target month itself (a date later this month = 1). */
function monthsToSave(targetDate: string, today: string) {
  const [ty, tm] = targetDate.split("-").map(Number);
  const [y, m] = today.split("-").map(Number);
  return ty * 12 + tm - (y * 12 + m) + 1;
}

function goalStatus(g: Goal, today: string): GoalStatus {
  const remaining = Math.max(0, g.targetFils - g.savedFils);
  if (remaining === 0) return { kind: "done" };
  if (!g.targetDate) return { kind: "open", remaining };
  if (g.targetDate < today) return { kind: "overdue", remaining };
  const months = Math.max(1, monthsToSave(g.targetDate, today));
  return { kind: "monthly", fils: Math.ceil(remaining / months), months };
}

function MonthlyNeeded({ status }: { status: GoalStatus }) {
  if (status.kind === "done") return <Badge tone="accent">Reached</Badge>;
  if (status.kind === "monthly") return <Money fils={status.fils} noDecimals />;
  if (status.kind === "overdue") return <Badge tone="warn">Target date passed</Badge>;
  return <span className="text-ink-2">No target date</span>;
}

export function GoalsTab() {
  const goals = useGoals();
  const archiveM = useArchiveGoal();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [archiving, setArchiving] = useState<Goal | null>(null);

  const today = todayISO();
  const rows: GoalRow[] = [...(goals.data ?? [])]
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .map((g) => ({
      ...g,
      ratio: g.targetFils > 0 ? g.savedFils / g.targetFils : 0,
      remaining: Math.max(0, g.targetFils - g.savedFils),
      status: goalStatus(g, today),
    }));
  const saved = rows.reduce((s, g) => s + g.savedFils, 0);
  const target = rows.reduce((s, g) => s + g.targetFils, 0);
  const monthlyTotal = rows.reduce((s, g) => s + (g.status.kind === "monthly" ? g.status.fils : 0), 0);

  const rowMenu = (g: Goal) => (
    <ActionMenu
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${g.name}`}>
          <MoreHorizontal />
        </Button>
      }
      items={[
        { label: "Edit goal", icon: <Pencil className="size-4" aria-hidden />, onSelect: () => setEditing(g) },
        { separator: true },
        { label: "Archive goal", icon: <Archive className="size-4" aria-hidden />, danger: true, onSelect: () => setArchiving(g) },
      ]}
    />
  );

  const columns: GridColDef<GoalRow>[] = [
    {
      field: "name",
      headerName: "Goal",
      flex: 1.3,
      minWidth: 170,
      renderCell: ({ row }) => <span className="truncate font-medium text-ink">{row.name}</span>,
    },
    { field: "priority", headerName: "Priority", width: 84, ...numericColumn },
    {
      field: "ratio",
      headerName: "Progress",
      flex: 1,
      minWidth: 160,
      renderCell: ({ row }) => (
        <span className="flex h-full w-full items-center gap-2.5">
          <ProgressBar value={row.savedFils} max={row.targetFils} invertColors label={`${row.name} progress`} className="flex-1" />
          <span className="tabular w-10 shrink-0 text-right text-meta text-ink-2">{formatPercent(Math.min(row.ratio, 9.99))}</span>
        </span>
      ),
    },
    { field: "savedFils", headerName: "Saved", width: 130, ...numericColumn, renderCell: ({ row }) => <Money fils={row.savedFils} noDecimals /> },
    { field: "targetFils", headerName: "Target", width: 130, ...numericColumn, renderCell: ({ row }) => <Money fils={row.targetFils} noDecimals /> },
    {
      field: "targetDate",
      headerName: "Target date",
      width: 120,
      align: "right",
      headerAlign: "right",
      renderCell: ({ row }) => <span className="tabular">{row.targetDate ? formatDate(row.targetDate) : "—"}</span>,
    },
    {
      field: "monthly",
      headerName: "Needed a month",
      width: 150,
      align: "right",
      headerAlign: "right",
      valueGetter: (_v, row) => (row.status.kind === "monthly" ? row.status.fils : null),
      renderCell: ({ row }) => <MonthlyNeeded status={row.status} />,
    },
    {
      field: "actions",
      headerName: "",
      width: 140,
      sortable: false,
      align: "right",
      display: "flex",
      renderCell: ({ row }) => (
        <span className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => setContributing(row)}>
            Contribute
          </Button>
          {rowMenu(row)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {goals.isPending ? (
        <Panel flush>
          <SkeletonList rows={4} className="px-4" />
        </Panel>
      ) : goals.isError ? (
        <InlineError error={goals.error} onRetry={() => goals.refetch()} title="Couldn't load savings goals" />
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={PiggyBank}
            title="No savings goals yet"
            description="Start with an emergency fund of 3 to 6 months of expenses, then add goals such as travel or a car."
            action={
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus aria-hidden /> Add goal
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          <SummaryStrip
            label="Savings summary"
            items={[
              { label: "Saved so far", value: <Money fils={saved} noDecimals />, hint: target ? `${formatPercent(saved / target)} of all targets` : undefined },
              { label: "Total of targets", value: <Money fils={target} noDecimals /> },
              { label: "Needed a month", value: <Money fils={monthlyTotal} noDecimals />, hint: "To hit every dated goal on time" },
            ]}
          />
          <Panel
            title="Savings goals"
            description="Ordered by priority"
            actions={
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus aria-hidden /> Add goal
              </Button>
            }
            flush
          >
            <DesktopOnly className="hidden md:block">
              <DataTable<GoalRow> rows={rows} columns={columns} autoHeight hideFooter aria-label="Savings goals" />
            </DesktopOnly>
            <ul className="divide-y divide-line md:hidden">
              {rows.map((g) => (
                <li key={g.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{g.name}</p>
                      <p className="flex flex-wrap gap-x-3 text-xs text-ink-2">
                        <span>Priority {g.priority}</span>
                        {g.targetDate ? <span className="tabular">By {formatDate(g.targetDate)}</span> : null}
                      </p>
                    </div>
                    <div className="-mt-1 -mr-2 shrink-0">{rowMenu(g)}</div>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <Money fils={g.savedFils} noDecimals className="font-medium" />
                    <span className="text-xs text-ink-2">
                      of <Money fils={g.targetFils} noDecimals className="text-ink-2" />
                    </span>
                  </div>
                  <ProgressBar value={g.savedFils} max={g.targetFils} invertColors label={`${g.name} progress`} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-2">
                      {g.status.kind === "monthly" ? <span>A month:</span> : null}
                      <MonthlyNeeded status={g.status} />
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => setContributing(g)}>
                      Contribute
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}

      {editing ? <GoalFormDialog goal={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {contributing ? <GoalContributeDialog goal={contributing} onClose={() => setContributing(null)} /> : null}
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Archive ${archiving?.name ?? "goal"}?`}
        description="The goal is hidden from your plan. The amount saved is not moved or deleted."
        confirmLabel="Archive goal"
        danger
        onConfirm={async () => {
          if (!archiving) return;
          await archiveM.mutateAsync(archiving.id);
          notify.success("Goal archived");
        }}
      />
    </div>
  );
}
