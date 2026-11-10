"use client";
import { Archive, MoreHorizontal, Pencil, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { MemberAvatar } from "@/components/members/MemberAvatar";
import { ActionMenu, Badge, Button, ConfirmDialog, EmptyState, InlineError, Money, Panel, SkeletonList, notify } from "@/components/ui";
import { formatFils } from "@/lib/money";
import { useAccounts, useArchiveIncomeStream, useIncomeStreams, useMe } from "@/lib/queries";
import type { IncomeStream } from "@/lib/types";
import { IncomeStreamFormDialog } from "./IncomeStreamFormDialog";
import { INCOME_KIND_LABEL, dayRange } from "./labels";

/** Expected income: each stream (a salary) with the parts it arrives in and when. */
export function IncomeTab() {
  const streams = useIncomeStreams();
  const accounts = useAccounts();
  const me = useMe();
  const archiveM = useArchiveIncomeStream();
  const [editing, setEditing] = useState<IncomeStream | "new" | null>(null);
  const [archiving, setArchiving] = useState<IncomeStream | null>(null);
  const accountName = (id?: string | null) => (id ? (accounts.data ?? []).find((a) => a.id === id)?.name : undefined);
  const memberName = (id?: string | null) => (id ? me.data?.household.members.find((m) => m.id === id)?.name : undefined);

  let body;
  if (streams.isPending) {
    body = (
      <Panel flush>
        <SkeletonList rows={3} className="px-4" />
      </Panel>
    );
  } else if (streams.isError) {
    body = <InlineError error={streams.error} onRetry={() => streams.refetch()} title="Couldn't load expected income" />;
  } else if (streams.data.length === 0) {
    body = (
      <Panel>
        <EmptyState
          icon={Wallet}
          title="No expected income yet"
          description="Add each salary with its usual amount and the days it arrives. Split it into parts if it comes in pieces."
          action={
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus aria-hidden /> Add expected income
            </Button>
          }
        />
      </Panel>
    );
  } else {
    const total = streams.data.filter((s) => s.active).reduce((s, x) => s + x.monthlyFils, 0);
    body = (
      <Panel
        title="Expected income"
        description={<span className="tabular">{formatFils(total, "AED", { noDecimals: true })} a month in total</span>}
        actions={
          <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
            <Plus aria-hidden /> Add income
          </Button>
        }
        flush
      >
        <ul className="divide-y divide-line">
          {streams.data.map((s) => (
            <li key={s.id} className="px-4 py-3 md:px-5">
              <div className="flex items-center gap-3">
                <MemberAvatar userId={s.memberId ?? undefined} name={memberName(s.memberId) ?? s.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{s.name}</span>
                    {!s.active ? <Badge tone="outline">Paused</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-ink-2">{accountName(s.accountId) ? `Into ${accountName(s.accountId)}` : "Into any account"}</p>
                </div>
                <Money fils={s.monthlyFils} className="text-sm font-semibold" />
                <ActionMenu
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${s.name}`}>
                      <MoreHorizontal />
                    </Button>
                  }
                  items={[
                    { label: "Edit", icon: <Pencil className="size-4" aria-hidden />, onSelect: () => setEditing(s) },
                    { separator: true },
                    { label: "Delete", icon: <Archive className="size-4" aria-hidden />, danger: true, onSelect: () => setArchiving(s) },
                  ]}
                />
              </div>
              <ul className="mt-2 flex flex-col gap-1.5 pl-11">
                {s.parts.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-meta">
                    <span className="min-w-0 text-ink">
                      {p.label}
                      <span className="text-ink-2">
                        , {INCOME_KIND_LABEL[p.kind].toLowerCase()}, usually the {dayRange(p.dayFrom, p.dayTo)}
                      </span>
                    </span>
                    <span className="tabular text-ink-2">
                      {p.amountMinFils != null || p.amountMaxFils != null
                        ? `${formatFils(p.amountMinFils ?? p.amountFils, "AED", { noDecimals: true })} to ${formatFils(p.amountMaxFils ?? p.amountFils, "AED", { noDecimals: true })}`
                        : formatFils(p.amountFils, "AED", { noDecimals: true })}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {body}
      {editing ? <IncomeStreamFormDialog stream={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Delete ${archiving?.name ?? "expected income"}?`}
        description="It leaves the plan, safe to spend and the waiting list. Received money stays in your transactions."
        confirmLabel="Delete expected income"
        danger
        onConfirm={async () => {
          if (!archiving) return;
          await archiveM.mutateAsync(archiving.id);
          notify.success(`${archiving.name} deleted`);
        }}
      />
    </div>
  );
}
