"use client";
import dayjs from "dayjs";
import { ArrowLeftRight, Plus, SearchX } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PeriodSelector } from "@/components/shell/PeriodSelector";
import { useTransactionDialog } from "@/components/transactions/TransactionDialogProvider";
import { QuietMonthNotice } from "@/features/common/QuietMonthNotice";
import { ImportStatementLink } from "@/features/import/ImportStatementLink";
import { Button, EmptyState, InlineError, Money, PageHeader, Panel, Skeleton, SkeletonList } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import { usePeriod } from "@/lib/period";
import { useReviewCount, useTransactions } from "@/lib/queries";
import type { Transaction, TransactionQuery, TransactionSort, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { txnTotals } from "./format";
import { Pager, TransactionCardList } from "./TransactionCardList";
import { TransactionDetailDrawer } from "./TransactionDetailDrawer";
import { CLEAR_ALL, rangeLabel, TransactionFilters, type RangeMode, type TxnFilterPatch, type TxnFilterValues } from "./TransactionFilters";
import { PAGE_SIZE_OPTIONS, TransactionsGrid } from "./TransactionsGrid";
import { useIsDesktop } from "./useMediaQuery";
import { useTxnLookups } from "./useTxnLookups";
import { useUrlState } from "./useUrlState";

const SORTS: TransactionSort[] = ["date", "-date", "amount", "-amount"];
const TYPES: TransactionType[] = ["income", "expense", "transfer"];
const RANGES: RangeMode[] = ["90d", "year", "all", "custom"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Backend max page size; totals are computed over at most this many rows. */
const TOTALS_LIMIT = 500;

export function TransactionsView() {
  const { params, set } = useUrlState();
  const period = usePeriod();
  const isDesktop = useIsDesktop();
  const { openCreate } = useTransactionDialog();
  const { lookups, accountsQ, categoriesQ } = useTxnLookups();
  const [selected, setSelected] = useState<Transaction | null>(null);

  // Parse + sanitise URL state. No range param = the global month; bare from/to (old links) = custom.
  const filters: TxnFilterValues = useMemo(() => {
    const from = params.get("from");
    const to = params.get("to");
    const rawRange = params.get("range") as RangeMode | null;
    const type = params.get("type") as TransactionType | null;
    const validFrom = from && DATE_RE.test(from) ? from : undefined;
    const validTo = to && DATE_RE.test(to) ? to : undefined;
    const range: RangeMode = rawRange && RANGES.includes(rawRange) ? rawRange : validFrom || validTo ? "custom" : "month";
    return {
      range,
      from: range === "custom" ? validFrom : undefined,
      to: range === "custom" ? validTo : undefined,
      accountId: params.get("accountId") || undefined,
      categoryId: params.get("categoryId") || undefined,
      type: type && TYPES.includes(type) ? type : undefined,
      q: params.get("q") || undefined,
      review: params.get("review") === "1" || undefined,
    };
  }, [params]);
  const reviewCountQ = useReviewCount();

  // Picking a month in the period selector means "show that month".
  const lastMonth = useRef(period.month);
  useEffect(() => {
    if (lastMonth.current === period.month) return;
    lastMonth.current = period.month;
    if (filters.range !== "month") set({ range: null, from: null, to: null, page: null });
  }, [period.month, filters.range, set]);

  const [from, to] = useMemo<[string | undefined, string | undefined]>(() => {
    const today = todayISO();
    switch (filters.range) {
      case "month":
        return period.range;
      case "90d":
        return [dayjs(today).subtract(89, "day").format("YYYY-MM-DD"), today];
      case "year":
        return [`${today.slice(0, 4)}-01-01`, today];
      case "all":
        return [undefined, undefined];
      case "custom":
        return [filters.from, filters.to];
    }
  }, [filters, period.range]);

  const rawSort = params.get("sort") as TransactionSort | null;
  const sort: TransactionSort = rawSort && SORTS.includes(rawSort) ? rawSort : "-date";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const rawSize = Number.parseInt(params.get("pageSize") ?? "50", 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawSize) ? rawSize : 50;

  const baseQuery = useMemo<TransactionQuery>(() => {
    const q: TransactionQuery = {};
    if (from) q.from = from;
    if (to) q.to = to;
    if (filters.accountId) q.accountId = filters.accountId;
    if (filters.categoryId) q.categoryId = filters.categoryId;
    if (filters.type) q.type = filters.type;
    if (filters.q) q.q = filters.q;
    if (filters.review) q.needsReview = true;
    return q;
  }, [from, to, filters]);

  const txQ = useTransactions({ ...baseQuery, page, pageSize, sort });
  const rows = useMemo(() => txQ.data?.items ?? [], [txQ.data]);
  const total = txQ.data?.total ?? 0;

  // Totals for the whole filtered range: reuse the page when it holds every row, else fetch up to 500.
  const needTotalsQuery = Boolean(txQ.data) && total > rows.length;
  // Household money unless the account filter is a business account (then: that account as recorded).
  const filterIsBusiness = filters.accountId ? lookups.accounts.get(filters.accountId)?.purpose === "business" : false;
  const totalsOpts = useMemo(() => ({ household: !filterIsBusiness }), [filterIsBusiness]);
  const householdOnly = !filterIsBusiness && [...lookups.accounts.values()].some((a) => a.purpose === "business");
  const totalsQ = useTransactions({ ...baseQuery, page: 1, pageSize: TOTALS_LIMIT, sort: "-date" }, { enabled: needTotalsQuery });
  const totals = useMemo(() => {
    if (!txQ.data) return null;
    if (!needTotalsQuery) return { ...txnTotals(rows, lookups, totalsOpts), partial: false };
    if (!totalsQ.data) return null;
    return { ...txnTotals(totalsQ.data.items, lookups, totalsOpts), partial: totalsQ.data.total > totalsQ.data.items.length };
  }, [txQ.data, needTotalsQuery, rows, totalsQ.data, lookups, totalsOpts]);

  const hasFilters =
    filters.range !== "month" || Boolean(filters.accountId || filters.categoryId || filters.type || filters.q || filters.review);

  // Keep the drawer showing fresh data after an edit elsewhere.
  const selectedFresh = selected ? (rows.find((r) => r.id === selected.id) ?? selected) : null;

  // Review flow: the next flagged row on this page after the open one (wrapping to the start).
  const nextFlagged = useMemo(() => {
    if (!selected) return null;
    const flagged = rows.filter((r) => r.needsReview && r.id !== selected.id);
    const idx = rows.findIndex((r) => r.id === selected.id);
    return flagged.find((r) => rows.indexOf(r) > idx) ?? flagged[0] ?? null;
  }, [rows, selected]);

  const changeFilters = (patch: TxnFilterPatch) => set({ ...patch, page: null });

  const addButton = (variant: "primary" | "secondary" = "primary") => (
    <Button variant={variant} onClick={() => openCreate(filters.accountId ? { accountId: filters.accountId } : undefined)}>
      <Plus /> Add transaction
    </Button>
  );

  const label = rangeLabel(filters, period.label);

  let body: ReactNode;
  if (txQ.isPending) {
    body = (
      <Panel flush>
        <div className="flex h-9 items-center gap-4 border-b border-line bg-surface-2 px-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
        <SkeletonList rows={10} className="px-4" />
      </Panel>
    );
  } else if (txQ.isError && !txQ.data) {
    body = <InlineError error={txQ.error} onRetry={() => void txQ.refetch()} retrying={txQ.isFetching} title="Couldn't load transactions" />;
  } else if (total === 0) {
    body = (
      <Panel>
        {hasFilters ? (
          <EmptyState
            icon={SearchX}
            title="No transactions match these filters"
            description="Widen the date range or remove a filter to see more."
            action={
              <Button variant="secondary" onClick={() => changeFilters(CLEAR_ALL)}>
                Clear all filters
              </Button>
            }
          />
        ) : (
          <>
          <QuietMonthNotice empty className="mb-2 border-0 bg-surface-2" />
          <EmptyState
            icon={ArrowLeftRight}
            title={`No transactions in ${period.label}`}
            description="Record an expense or income, or pick another month in the period selector."
            action={addButton()}
          />
          </>
        )}
      </Panel>
    );
  } else if (isDesktop) {
    body = (
      <Panel flush>
        <TransactionsGrid
          rows={rows}
          total={total}
          loading={txQ.isFetching}
          page={page}
          pageSize={pageSize}
          sort={sort}
          lookups={lookups}
          onPageChange={(p, size) => set({ page: p > 1 ? p : null, pageSize: size !== 50 ? size : null })}
          onSortChange={(s) => set({ sort: s !== "-date" ? s : null, page: null })}
          onOpen={setSelected}
        />
        <TotalsBar totals={totals} count={total} householdOnly={householdOnly} className="border-t border-line" />
      </Panel>
    );
  } else {
    body = (
      <>
        <Panel flush className="mb-3">
          <TotalsBar totals={totals} count={total} householdOnly={householdOnly} />
        </Panel>
        <TransactionCardList rows={rows} lookups={lookups} onOpen={setSelected} />
        {total > pageSize ? <Pager page={page} pageSize={pageSize} total={total} onPage={(p) => set({ page: p > 1 ? p : null })} /> : null}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description={label}
        actions={
          <>
            {filters.range === "month" ? <PeriodSelector className="md:hidden" /> : null}
            <ImportStatementLink />
            <div className="hidden md:block">{addButton()}</div>
          </>
        }
      />
      <TransactionFilters
        values={filters}
        accounts={accountsQ.data ?? []}
        categories={categoriesQ.data ?? []}
        monthLabel={period.label}
        resultCount={txQ.data ? total : null}
        reviewCount={reviewCountQ.data}
        onChange={changeFilters}
      />
      {txQ.isError && txQ.data ? (
        <InlineError className="mb-4" error={txQ.error} onRetry={() => void txQ.refetch()} title="Couldn't refresh transactions" />
      ) : null}
      {body}
      <TransactionDetailDrawer
        transaction={selectedFresh}
        lookups={lookups}
        onClose={() => setSelected(null)}
        onNext={nextFlagged ? () => setSelected(nextFlagged) : undefined}
        onReviewed={() => {
          // The empty "Needs review" list then says the rest; no second toast.
          setSelected(nextFlagged ?? null);
        }}
      />
    </>
  );
}

type Totals = ReturnType<typeof txnTotals> & { partial: boolean };

/** In / out / net for the filtered range (AED; transfers excluded). */
function TotalsBar({
  totals,
  count,
  householdOnly,
  className,
}: {
  totals: Totals | null;
  count: number;
  householdOnly?: boolean;
  className?: string;
}) {
  const cells: { label: string; node: ReactNode }[] = totals
    ? [
        { label: "Money in", node: <Money fils={totals.inFils} flow="in" /> },
        { label: "Money out", node: <Money fils={totals.outFils} flow="out" /> },
        {
          label: "Net",
          node: <Money fils={totals.netFils} flow={totals.netFils > 0 ? "in" : totals.netFils < 0 ? "out" : "neutral"} className="font-semibold" />,
        },
      ]
    : [];
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2 bg-surface-2 px-4 py-2.5 md:flex-row md:items-center md:justify-between md:gap-6", className)}
      aria-label="Totals for the filtered range"
      role="group"
    >
      <p className="text-meta text-ink-2">
        Totals for <span className="tabular">{count.toLocaleString("en-US")}</span> {count === 1 ? "transaction" : "transactions"}
        {totals?.partial ? <span>, first {TOTALS_LIMIT} only</span> : null}
        {totals && totals.foreign > 0 ? <span>, excluding non-AED accounts</span> : null}
        {householdOnly ? <span>, household money only</span> : null}
      </p>
      <dl className="flex min-w-0 flex-col gap-1 md:flex-row md:gap-8">
        {totals
          ? cells.map((c) => (
              <div key={c.label} className="flex min-w-0 items-baseline justify-between gap-3 md:block md:text-right">
                <dt className="text-xs text-ink-2">{c.label}</dt>
                <dd className="truncate text-sm font-medium">{c.node}</dd>
              </div>
            ))
          : Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex min-w-0 justify-between gap-3 md:block">
                <Skeleton className="mb-1 h-3 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
      </dl>
    </div>
  );
}

