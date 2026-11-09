"use client";
import { DesktopOnly } from "@/components/ui/DesktopOnly";
import type { GridColDef } from "@mui/x-data-grid";
import { AlertTriangle, CreditCard } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  buttonClasses,
  DataTable,
  EmptyState,
  InlineError,
  Money,
  MoneyInput,
  notify,
  numericColumn,
  Panel,
  SegmentedControl,
  Skeleton,
} from "@/components/ui";
import { formatMonth } from "@/lib/dates";
import { applyApiErrors } from "@/lib/form-errors";
import { formatBps, formatFils } from "@/lib/money";
import { useCompare, useDebts, usePayoff, usePlan, usePutPlan } from "@/lib/queries";
import type { CompareResult, Debt, PayoffResult, Strategy } from "@/lib/types";
import { cn } from "@/lib/utils";
import { monthlyInterestFils, plural } from "./labels";
import { PayoffChart } from "./PayoffChart";

const STRATEGY_LABEL: Record<Strategy, string> = { avalanche: "Avalanche", snowball: "Snowball" };
const STRATEGY_HELP: Record<Strategy, string> = {
  avalanche: "Extra money goes to the highest interest rate first. Costs the least interest.",
  snowball: "Extra money goes to the smallest balance first. Clears individual debts sooner.",
};

function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function PayoffTab({ onGoToDebts }: { onGoToDebts: () => void }) {
  const plan = usePlan();
  const debts = useDebts();
  const putM = usePutPlan();

  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [budget, setBudget] = useState<number | null>(null);
  const [budgetError, setBudgetError] = useState<string>();
  const [initFrom, setInitFrom] = useState<typeof plan.data>(undefined);
  // Derived-state sync: (re)initialise local controls whenever the saved plan changes.
  if (plan.data && plan.data !== initFrom) {
    setInitFrom(plan.data);
    setStrategy(plan.data.strategy);
    setBudget(plan.data.monthlyDebtBudgetFils);
  }

  const debounced = useDebounced(budget);
  // 0 / empty means "sum of minimum payments" (the backend applies the same rule).
  const queryBudget = debounced !== null && debounced > 0 ? debounced : 0;
  const payoff = usePayoff({ strategy, monthlyBudgetFils: queryBudget });
  const compare = useCompare({ monthlyBudgetFils: queryBudget });

  const activeDebts = useMemo(() => (debts.data ?? []).filter((d) => d.balanceFils > 0), [debts.data]);
  const minimums = activeDebts.reduce((s, d) => s + Math.min(d.minPaymentFils, d.balanceFils), 0);
  const effectiveBudget = queryBudget > 0 ? queryBudget : minimums;
  const dirty = Boolean(plan.data) && (strategy !== plan.data?.strategy || (budget ?? 0) !== plan.data?.monthlyDebtBudgetFils);

  if (plan.isPending || debts.isPending) return <PayoffSkeleton />;
  if (plan.isError) return <InlineError error={plan.error} onRetry={() => plan.refetch()} title="Couldn't load your plan" />;
  if (debts.isError) return <InlineError error={debts.error} onRetry={() => debts.refetch()} title="Couldn't load debts" />;

  if (activeDebts.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={CreditCard}
          title="No debts to plan"
          description="Add your credit cards and loans to see your debt-free date and the cheapest order to pay them."
          action={
            <Button size="sm" onClick={onGoToDebts}>
              Add debts
            </Button>
          }
        />
      </Panel>
    );
  }

  async function save() {
    if (!plan.data) return;
    if (budget !== null && budget > 0 && budget < minimums) {
      setBudgetError(`Enter at least ${formatFils(minimums)} to cover every minimum payment`);
      return;
    }
    setBudgetError(undefined);
    try {
      await putM.mutateAsync({ ...plan.data, strategy, monthlyDebtBudgetFils: budget ?? 0 });
      notify.success("Plan saved");
    } catch (err) {
      const fieldErr: { message?: string } = {};
      const msg = applyApiErrors<{ monthlyDebtBudgetFils: number }>(
        err,
        (_name, e) => {
          fieldErr.message = e.message;
        },
        ["monthlyDebtBudgetFils"],
      );
      if (fieldErr.message) setBudgetError(fieldErr.message);
      if (msg) notify.error(err, "Couldn't save plan");
    }
  }

  const result = payoff.data;
  const fetching = payoff.isFetching || budget !== debounced;

  return (
    <div className="flex flex-col gap-5">
      <div aria-live="polite" aria-busy={fetching} className={cn("transition-opacity", fetching && result && "opacity-70")}>
        {payoff.isError && !result ? (
          <InlineError error={payoff.error} onRetry={() => payoff.refetch()} title="Couldn't calculate your payoff" />
        ) : !result ? (
          <Skeleton className="h-[120px] w-full rounded-container" />
        ) : !result.feasible ? (
          <Infeasible result={result} debts={activeDebts} minimums={minimums} budget={effectiveBudget} onUseMinimums={() => setBudget(minimums)} />
        ) : (
          <Headline result={result} strategy={strategy} budget={effectiveBudget} />
        )}
      </div>

      <Panel bodyClassName="p-4 md:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="flex min-w-0 flex-col gap-1.5 lg:w-80">
            <span id="strategy-label" className="text-meta font-medium text-ink">
              Strategy
            </span>
            <SegmentedControl<Strategy>
              aria-label="Payoff strategy"
              fullWidth
              value={strategy}
              onChange={setStrategy}
              options={[
                { value: "avalanche", label: "Avalanche" },
                { value: "snowball", label: "Snowball" },
              ]}
            />
            <p className="text-xs text-ink-2">{STRATEGY_HELP[strategy]}</p>
          </div>
          <div className="min-w-0 lg:w-72">
            <MoneyInput
              label="Monthly debt budget"
              value={budget}
              onChange={(v) => {
                setBudget(v);
                setBudgetError(undefined);
              }}
              error={budgetError}
              hint={<span className="tabular">Minimum payments total {formatFils(minimums)}. Leave empty or 0 to pay just the minimums.</span>}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:mt-[22px] lg:ml-auto">
            {dirty ? <span className="text-xs text-ink-2">Showing unsaved changes</span> : null}
            <Button onClick={save} loading={putM.isPending} disabled={!dirty}>
              Save plan
            </Button>
          </div>
        </div>
      </Panel>

      {result?.feasible ? (
        <>
          <Panel title="Balance over time" description="Remaining balance per debt after each month's payments">
            <PayoffChart schedule={result.schedule ?? []} debts={activeDebts} order={result.order ?? []} />
          </Panel>
          <OrderTable result={result} debts={activeDebts} />
          {compare.data ? <ComparePanel data={compare.data} active={strategy} onPick={setStrategy} /> : null}
        </>
      ) : null}
    </div>
  );
}

/* ---------------- Headline ---------------- */

function Headline({ result, strategy, budget }: { result: PayoffResult; strategy: Strategy; budget: number }) {
  return (
    <section
      aria-label="Payoff summary"
      className="grid min-w-0 grid-cols-1 overflow-hidden rounded-container border border-line bg-surface sm:grid-cols-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]"
    >
      <div className="flex min-w-0 flex-col gap-1 border-line px-5 py-4 sm:col-span-3 sm:border-b lg:col-span-1 lg:border-b-0">
        <p className="text-meta font-medium text-ink-2">Debt-free by</p>
        <p className="tabular truncate text-[32px] leading-10 font-semibold text-ink">{formatMonth(result.debtFreeMonth, true)}</p>
        <p className="truncate text-xs text-ink-2">
          <span className="tabular">{STRATEGY_LABEL[strategy]}, {formatFils(budget, "AED", { noDecimals: true })} a month</span>
        </p>
      </div>
      <HeadlineCell first label="Months remaining" value={result.months !== undefined ? String(result.months) : "—"} hint={result.months ? plural(result.months, "payment") : undefined} />
      <HeadlineCell label="Total interest" value={formatFils(result.totalInterestFils, "AED", { noDecimals: true })} hint="Cost of borrowing until debt-free" />
      <HeadlineCell label="Total paid" value={formatFils(result.totalPaidFils, "AED", { noDecimals: true })} hint="Balances plus interest" />
    </section>
  );
}

function HeadlineCell({ label, value, hint, first }: { label: string; value: string; hint?: string; first?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col justify-center gap-1 border-t border-line px-5 py-4 sm:border-t-0 sm:border-l", first && "sm:border-l-0 lg:border-l")}>
      <p className="truncate text-meta font-medium text-ink-2">{label}</p>
      <p className="tabular truncate text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="truncate text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}

/* ---------------- Payoff order ---------------- */

interface OrderRow {
  id: string;
  order: number;
  name: string;
  aprBps: number;
  balanceFils: number;
  payoffMonth: string | null;
  interestFils: number;
}

const orderColumns: GridColDef<OrderRow>[] = [
  { field: "order", headerName: "Order", width: 72, sortable: false, ...numericColumn, align: "left", headerAlign: "left" },
  { field: "name", headerName: "Debt", flex: 1, minWidth: 180, sortable: false },
  { field: "aprBps", headerName: "APR", width: 100, sortable: false, ...numericColumn, renderCell: ({ row }) => <span className="tabular">{formatBps(row.aprBps)}</span> },
  {
    field: "balanceFils",
    headerName: "Balance",
    width: 150,
    sortable: false,
    ...numericColumn,
    renderCell: ({ row }) => <Money fils={row.balanceFils} />,
  },
  {
    field: "payoffMonth",
    headerName: "Paid off",
    width: 130,
    sortable: false,
    align: "right",
    headerAlign: "right",
    renderCell: ({ row }) => <span className="tabular">{formatMonth(row.payoffMonth)}</span>,
  },
  {
    field: "interestFils",
    headerName: "Interest",
    width: 140,
    sortable: false,
    ...numericColumn,
    renderCell: ({ row }) => <Money fils={row.interestFils} />,
  },
];

function OrderTable({ result, debts }: { result: PayoffResult; debts: Debt[] }) {
  const byId = new Map(debts.map((d) => [d.id, d]));
  const perDebt = new Map((result.perDebt ?? []).map((p) => [p.debtId, p]));
  const order = result.order?.length ? result.order : debts.map((d) => d.id);
  const rows: OrderRow[] = order.flatMap((id, i) => {
    const d = byId.get(id);
    if (!d) return [];
    const p = perDebt.get(id);
    return [{ id, order: i + 1, name: d.name, aprBps: d.aprBps, balanceFils: d.balanceFils, payoffMonth: p?.payoffMonth ?? null, interestFils: p?.interestFils ?? 0 }];
  });

  return (
    <Panel title="Payoff order" description="Extra money goes to each debt in this order once minimums are paid" flush>
      <DesktopOnly className="hidden md:block">
        <DataTable<OrderRow> rows={rows} columns={orderColumns} autoHeight hideFooter disableColumnSorting aria-label="Payoff order" />
      </DesktopOnly>
      <ol className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
            <span className="tabular w-5 shrink-0 text-meta font-semibold text-ink-2">{r.order}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{r.name}</p>
              <p className="flex flex-wrap gap-x-3 text-xs text-ink-2">
                <span className="tabular">{formatBps(r.aprBps)} APR</span>
                <span className="tabular">Paid off {formatMonth(r.payoffMonth)}</span>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <Money fils={r.balanceFils} noDecimals className="text-sm font-medium" />
              <p className="tabular text-xs text-ink-2">{formatFils(r.interestFils, "AED", { noDecimals: true })} interest</p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* ---------------- Comparison ---------------- */

function ComparePanel({ data, active, onPick }: { data: CompareResult; active: Strategy; onPick: (s: Strategy) => void }) {
  const av = data.avalanche;
  const sb = data.snowball;
  if (!av.feasible || !sb.feasible) return null;
  const interestSaved = data.interestSavedFils ?? (sb.totalInterestFils ?? 0) - (av.totalInterestFils ?? 0);
  const monthsSaved = data.monthsSaved ?? (sb.months ?? 0) - (av.months ?? 0);
  const summary =
    interestSaved > 0 || monthsSaved > 0
      ? `Avalanche saves ${formatFils(Math.max(0, interestSaved), "AED", { noDecimals: true })} in interest${monthsSaved > 0 ? ` and finishes ${plural(monthsSaved, "month")} sooner` : ""}.`
      : interestSaved < 0
        ? `Snowball costs ${formatFils(-interestSaved, "AED", { noDecimals: true })} less in interest with these debts.`
        : "Both strategies cost the same with these debts. Pick the order you'll stick to.";

  const rows: { label: string; render: (r: PayoffResult) => string; diff: string }[] = [
    { label: "Debt-free by", render: (r) => formatMonth(r.debtFreeMonth), diff: monthsSaved > 0 ? `${plural(monthsSaved, "month")} sooner` : monthsSaved < 0 ? `${plural(-monthsSaved, "month")} later` : "Same" },
    {
      label: "Total interest",
      render: (r) => formatFils(r.totalInterestFils, "AED", { noDecimals: true }),
      diff: formatFils(Math.abs(interestSaved), "AED", { noDecimals: true }),
    },
    { label: "Total paid", render: (r) => formatFils(r.totalPaidFils, "AED", { noDecimals: true }), diff: formatFils(Math.abs((sb.totalPaidFils ?? 0) - (av.totalPaidFils ?? 0)), "AED", { noDecimals: true }) },
  ];

  return (
    <Panel title="Avalanche compared with snowball" description="Same monthly budget, different order" flush>
      <p className="tabular border-b border-line px-4 py-3 text-sm text-ink md:px-5">{summary}</p>
      <div className="min-w-0">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Avalanche and snowball strategies compared</caption>
          <thead className="bg-surface-2">
            <tr className="h-9 border-b border-line text-meta text-ink-2">
              <th scope="col" className="w-[34%] px-4 text-left font-medium md:px-5">
                <span className="sr-only">Measure</span>
              </th>
              {(["avalanche", "snowball"] as const).map((s) => (
                <th key={s} scope="col" className="px-2 text-right font-medium md:px-4">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {STRATEGY_LABEL[s]}
                    {s === active ? (
                      <Badge tone="accent" className="hidden sm:inline-flex">
                        Selected
                      </Badge>
                    ) : null}
                  </span>
                </th>
              ))}
              <th scope="col" className="hidden px-4 text-right font-medium sm:table-cell md:px-5">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="h-10 border-b border-line last:border-0">
                <th scope="row" className="px-4 py-2 text-left leading-tight font-normal text-ink-2 md:px-5">
                  {row.label}
                </th>
                <td className={cn("tabular truncate px-2 text-right md:px-4", active === "avalanche" ? "font-semibold text-ink" : "text-ink")}>{row.render(av)}</td>
                <td className={cn("tabular truncate px-2 text-right md:px-4", active === "snowball" ? "font-semibold text-ink" : "text-ink")}>{row.render(sb)}</td>
                <td className="tabular hidden truncate px-4 text-right text-ink-2 sm:table-cell md:px-5">{row.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 md:px-5">
        <p className="text-xs text-ink-2">
          Using <span className="font-medium text-ink">{STRATEGY_LABEL[active]}</span>. Switching previews the change until you save.
        </p>
        <Button variant="secondary" size="sm" onClick={() => onPick(active === "avalanche" ? "snowball" : "avalanche")}>
          Preview {active === "avalanche" ? "snowball" : "avalanche"}
        </Button>
      </div>
    </Panel>
  );
}

/* ---------------- Infeasible ---------------- */

function Infeasible({
  result,
  debts,
  minimums,
  budget,
  onUseMinimums,
}: {
  result: PayoffResult;
  debts: Debt[];
  minimums: number;
  budget: number;
  onUseMinimums: () => void;
}) {
  const below = result.reason === "budget_below_minimums";
  const shortfall = result.shortfallFils ?? Math.max(0, minimums - budget);
  const growing = debts
    .map((d) => ({ d, interest: monthlyInterestFils(d.balanceFils, d.aprBps), payment: Math.min(d.minPaymentFils, d.balanceFils) }))
    .filter((x) => x.interest >= x.payment);

  return (
    <section aria-label="Plan can't be completed" className="min-w-0 rounded-container border border-line bg-surface">
      <div className="flex items-start gap-3 border-b border-line px-4 py-3 md:px-5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{below ? "This budget doesn't cover your minimum payments" : "This plan never clears your debt"}</h2>
          <p className="mt-0.5 text-meta text-ink-2">
            {below
              ? "Missing a minimum payment adds late fees and more interest. Raise the monthly debt budget to at least the total of all minimums."
              : "Interest on at least one debt is equal to or more than the money going to it each month, so its balance never falls. Raise the monthly debt budget, or check the APR and minimum payment of each debt."}
          </p>
        </div>
      </div>

      {below ? (
        <dl className="grid grid-cols-1 sm:grid-cols-3">
          <InfeasibleFigure label="Monthly debt budget" value={formatFils(budget)} />
          <InfeasibleFigure label="Minimum payments required" value={formatFils(minimums)} />
          <InfeasibleFigure label="Shortfall each month" value={formatFils(shortfall)} danger />
        </dl>
      ) : growing.length ? (
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Debts whose balance is growing</caption>
          <thead className="bg-surface-2">
            <tr className="h-9 border-b border-line text-meta text-ink-2">
              <th scope="col" className="px-4 text-left font-medium md:px-5">
                Debt
              </th>
              <th scope="col" className="px-2 text-right font-medium">
                Interest a month
              </th>
              <th scope="col" className="px-4 text-right font-medium md:px-5">
                Minimum payment
              </th>
            </tr>
          </thead>
          <tbody>
            {growing.map(({ d, interest, payment }) => (
              <tr key={d.id} className="h-10 border-b border-line last:border-0">
                <th scope="row" className="truncate px-4 text-left font-medium text-ink md:px-5">
                  {d.name}
                </th>
                <td className="tabular truncate px-2 text-right text-danger">{formatFils(interest)}</td>
                <td className="tabular truncate px-4 text-right text-ink md:px-5">{formatFils(payment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3 md:px-5">
        {below ? (
          <Button size="sm" onClick={onUseMinimums}>
            Set budget to {formatFils(minimums, "AED", { noDecimals: minimums % 100 === 0 })}
          </Button>
        ) : null}
        <Link href="/budget" className={buttonClasses("secondary", "sm")}>
          Review monthly budget
        </Link>
      </div>
    </section>
  );
}

function InfeasibleFigure({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-line px-4 py-3 not-first:border-t sm:not-first:border-t-0 sm:not-first:border-l md:px-5">
      <dt className="truncate text-meta text-ink-2">{label}</dt>
      <dd className={cn("tabular truncate text-base font-semibold", danger ? "text-danger" : "text-ink")}>{value}</dd>
    </div>
  );
}

function PayoffSkeleton() {
  return (
    <div role="status" aria-label="Loading payoff plan" className="flex flex-col gap-5">
      <Skeleton className="h-[120px] w-full rounded-container" />
      <Skeleton className="h-24 w-full rounded-container" />
      <Skeleton className="h-80 w-full rounded-container" />
    </div>
  );
}
