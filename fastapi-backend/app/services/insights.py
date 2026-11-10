"""DB-facing glue for insights / plan / dashboard routers (spec §4.2, §6).

"Today" is computed only in the router layer via the ``get_today`` dependency (Asia/Dubai)
and passed down; analytics functions stay pure.
"""

from __future__ import annotations

import asyncio
import calendar
import datetime as dt
from typing import Any

from beanie import PydanticObjectId

from app.analytics import financial_health, monthly_series, monthly_summary
from app.analytics._common import round_half_up
from app.models import Account, Debt, Plan
from app.services.analytics_data import business_accounts, load_analytics_txns
from app.services.balances import apply_balances, transaction_deltas
from app.services.months import month_bounds

try:
    from zoneinfo import ZoneInfo

    DUBAI: dt.tzinfo = ZoneInfo("Asia/Dubai")
except Exception:  # pragma: no cover - no tz database available
    DUBAI = dt.timezone(dt.timedelta(hours=4), "Asia/Dubai")  # Dubai has no DST

LIQUID_ACCOUNT_TYPES = ("bank", "savings", "cash")
HEALTH_HISTORY_MONTHS = 6


def get_today() -> dt.date:
    """FastAPI dependency: today's calendar date in Asia/Dubai (overridable in tests)."""
    return dt.datetime.now(DUBAI).date()


def month_str(d: dt.date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def shift_month(month: str, n: int) -> str:
    y, m = int(month[:4]), int(month[5:7])
    idx = y * 12 + (m - 1) + n
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}"


async def load_months(
    household_id: PydanticObjectId, first_month: str, last_month: str, *, include_business: bool = False
) -> list[dict[str, Any]]:
    start, _ = month_bounds(first_month)
    _, end = month_bounds(last_month)
    return await load_analytics_txns(household_id, start, end, include_business=include_business)


def _delta(cur: Any, prev: Any) -> Any:
    if cur is None or prev is None:
        return None
    if isinstance(cur, float) or isinstance(prev, float):
        return round(cur - prev, 4)
    return cur - prev


def summary_with_previous(txns: list[dict[str, Any]], month: str) -> dict[str, Any]:
    """monthly_summary(month) + previous month summary + deltas (current - previous)."""
    cur = monthly_summary(txns, month)
    prev = monthly_summary(txns, shift_month(month, -1))
    deltas = {k: _delta(cur.get(k), prev.get(k)) for k in ("incomeFils", "expenseFils", "netFils", "savingsRate")}
    return {**cur, "previous": prev, "deltas": deltas}


async def active_debts(household_id: PydanticObjectId, *, include_business: bool = False) -> list[Debt]:
    """Non-archived debts. Debts linked to a business account are the business's, not the
    household's: left out unless ``include_business``."""
    query = Debt.find({"household_id": household_id, "archived": False}).sort("+created_at").to_list()
    if include_business:
        return await query
    debts, business = await asyncio.gather(query, business_accounts(household_id))
    return household_debts(debts, business)


def household_debts(debts: list[Debt], business: dict[str, str]) -> list[Debt]:
    """Drop debts linked to a business account (``business``: id -> name)."""
    return [d for d in debts if d.account_id is None or str(d.account_id) not in business]


def debts_for_analytics(debts: list[Debt]) -> list[dict[str, Any]]:
    return [
        {
            "id": str(d.id),
            "name": d.name,
            "balance_fils": d.balance_fils,
            "apr_bps": d.apr_bps,
            "min_payment_fils": d.min_payment_fils,
        }
        for d in debts
    ]


def sum_minimums(debts: list[Debt]) -> int:
    return sum(min(d.min_payment_fils, d.balance_fils) for d in debts if d.balance_fils > 0)


async def get_plan(household_id: PydanticObjectId) -> Plan | None:
    return await Plan.find_one({"household_id": household_id})


async def active_accounts(household_id: PydanticObjectId) -> tuple[list[Account], dict[str, int]]:
    # Household-wide deltas don't depend on the account list: one concurrent round trip.
    accounts, deltas = await asyncio.gather(
        Account.find({"household_id": household_id, "archived": False}).sort("+created_at").to_list(),
        transaction_deltas(household_id),
    )
    return accounts, apply_balances(accounts, deltas)


def health_range(today: dt.date) -> tuple[str, str]:
    """(first, last) month of transactions health needs: the last 6 full months + current."""
    cur = month_str(today)
    return shift_month(cur, -HEALTH_HISTORY_MONTHS), cur


def project_partial_month(month: dict[str, Any], today: dt.date) -> dict[str, Any]:
    """Turn the current, partial month into a full-month estimate for health scoring.

    Expenses accrue roughly daily, so they are projected by elapsed days (day 9 of 30 ->
    x 30/9); otherwise 9 days of spending would read as a month's and inflate the emergency
    fund ~3x. Income is lumpy (a salary lands once) and is NOT projected: it stays at what has
    actually arrived. Both choices err on the cautious side (lower savings rate, higher DTI).
    """
    days = calendar.monthrange(today.year, today.month)[1]
    expense = round_half_up(month["expenseFils"] * days / today.day)
    return {**month, "expenseFils": expense, "netFils": month["incomeFils"] - expense}


def compute_health(
    txns: list[dict[str, Any]],
    accounts: list[Account],
    balances: dict[str, int],
    debts: list[Debt],
    today: dt.date,
    *,
    include_business: bool = False,
) -> dict[str, Any]:
    """Pure part of health_for. ``txns`` must cover at least ``health_range(today)``.
    Business accounts' balances are not household cash unless ``include_business``."""
    cur = month_str(today)
    last_full = shift_month(cur, -1)
    monthly = monthly_series(txns, last_full, HEALTH_HISTORY_MONTHS)
    if not any(m["incomeFils"] or m["expenseFils"] for m in monthly):
        monthly = [project_partial_month(m, today) for m in monthly_series(txns, cur, 1)]
    liquid = sum(
        balances[str(a.id)]
        for a in accounts
        if a.type in LIQUID_ACCOUNT_TYPES
        and a.currency == "AED"
        and (include_business or getattr(a, "purpose", "household") != "business")
    )
    total_debt = sum(max(0, d.balance_fils) for d in debts)
    return financial_health(monthly, liquid, total_debt, sum_minimums(debts))


async def health_for(
    household_id: PydanticObjectId, today: dt.date, *, include_business: bool = False
) -> dict[str, Any]:
    """financial_health over the last 6 full months (falls back to the current month when
    there is no history). Liquid = AED household bank/savings/cash accounts; debt = non-archived
    debts not linked to a business account."""
    first, last = health_range(today)
    txns, (accounts, balances), debts = await asyncio.gather(
        load_months(household_id, first, last, include_business=include_business),
        active_accounts(household_id),
        active_debts(household_id, include_business=include_business),
    )
    return compute_health(txns, accounts, balances, debts, today, include_business=include_business)


def next_due_date(due_day: int, today: dt.date) -> dt.date:
    """Next occurrence of ``due_day`` (1–28) on or after ``today``."""
    if today.day <= due_day:
        return today.replace(day=due_day)
    y, m = (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)
    return dt.date(y, m, due_day)


def upcoming_debt_payments(debts: list[Debt], today: dt.date) -> list[dict[str, Any]]:
    """Next due date per non-archived debt with an outstanding balance, soonest first."""
    items = [
        {
            "debtId": str(d.id),
            "name": d.name,
            "dueDate": next_due_date(d.due_day, today).isoformat(),
            "minPaymentFils": min(d.min_payment_fils, d.balance_fils),
        }
        for d in debts
        if d.balance_fils > 0
    ]
    items.sort(key=lambda x: (x["dueDate"], x["name"]))
    return items
