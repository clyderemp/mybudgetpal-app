"""DB glue for bills and expected income: load documents as plain dicts for ``app.analytics.bills``,
persist confident matches, and compose the month report, overview and zero-based plan."""

from __future__ import annotations

import asyncio
import datetime as dt
from collections import defaultdict
from typing import Any

from beanie import PydanticObjectId

from app.analytics._common import add_months
from app.analytics.bills import (
    detect_recurring,
    expected_amounts,
    last_month,
    month_report,
    monthly_share,
    safe_to_spend,
    zero_based_plan,
)
from app.models import Account, Bill, Goal, IncomeStream, Transaction
from app.services.analytics_data import _as_date
from app.services.balances import apply_balances, transaction_deltas
from app.services.months import month_bounds

CASH_ACCOUNT_TYPES = ("bank", "cash")
UPCOMING_DAYS = 14


def _s(v: Any) -> str | None:
    return str(v) if v is not None else None


def bill_dict(b: Bill) -> dict[str, Any]:
    return {
        "id": str(b.id),
        "name": b.name,
        "kind": b.kind,
        "amount_fils": b.amount_fils,
        "amount_mode": b.amount_mode,
        "cadence": b.cadence,
        "due_day_from": b.due_day_from,
        "due_day_to": b.due_day_to,
        "account_id": _s(b.account_id),
        "category_id": _s(b.category_id),
        "match_text": list(b.match_text),
        "amount_tolerance_pct": b.amount_tolerance_pct,
        "ignored_transaction_ids": list(b.ignored_transaction_ids),
        "start_month": b.start_month,
        "end_month": b.end_month,
        "instalments_total": b.instalments_total,
        "instalments_paid": b.instalments_paid,
        "purpose": b.purpose,
        "active": b.active,
        "skipped_months": list(b.skipped_months),
    }


def stream_dict(s: IncomeStream) -> dict[str, Any]:
    return {
        "id": str(s.id),
        "name": s.name,
        "member_id": _s(s.member_id),
        "account_id": _s(s.account_id),
        "active": s.active,
        "parts": [p.model_dump() for p in s.parts],
    }


async def load_bills(household_id: PydanticObjectId) -> list[Bill]:
    return await Bill.find({"household_id": household_id, "archived": False}).sort("+due_day_from").to_list()


async def load_streams(household_id: PydanticObjectId) -> list[IncomeStream]:
    return await IncomeStream.find({"household_id": household_id, "archived": False}).sort("+created_at").to_list()


_PROJECTION = {
    "_id": 1, "date": 1, "amount_fils": 1, "type": 1, "account_id": 1, "to_account_id": 1,
    "category_id": 1, "merchant": 1, "note": 1, "bill_id": 1,
}


async def load_match_txns(household_id: PydanticObjectId, start: dt.date, end: dt.date) -> list[dict[str, Any]]:
    """Non-deleted transactions in [start, end] with the fields bill matching needs."""
    query = {
        "household_id": household_id,
        "deleted_at": None,
        "date": {"$gte": dt.datetime.combine(start, dt.time.min), "$lte": dt.datetime.combine(end, dt.time.min)},
    }
    cursor = Transaction.get_motor_collection().find(query, _PROJECTION, batch_size=10_000).sort("date", 1)
    return [
        {
            "id": str(t["_id"]),
            "date": _as_date(t["date"]),
            "amount_fils": t["amount_fils"],
            "type": t["type"],
            "account_id": str(t["account_id"]),
            "to_account_id": _s(t.get("to_account_id")),
            "category_id": _s(t.get("category_id")),
            "merchant": t.get("merchant"),
            "note": t.get("note"),
            "bill_id": _s(t.get("bill_id")),
        }
        for t in await cursor.to_list(None)
    ]


def report_range(first_month: str, last_month_: str) -> tuple[dt.date, dt.date]:
    """Transactions a report for [first, last] needs: 3 months of history (estimates) plus slack
    either side (early payments count for the next month; income may land a few days late)."""
    start, _ = month_bounds(add_months(first_month, -3))
    _, end = month_bounds(add_months(last_month_, 1))
    return start - dt.timedelta(days=15), end


async def persist_links(household_id: PydanticObjectId, links: list[tuple[str, str]], month: str, today: dt.date) -> int:
    """Set ``bill_id`` on transactions confidently matched to a bill (never overwrites an existing link).
    Skipped for future months so a guess about a month that hasn't happened is never stored."""
    if month > f"{today.year:04d}-{today.month:02d}" or not links:
        return 0
    by_bill: dict[str, list[PydanticObjectId]] = defaultdict(list)
    for tid, bid in links:
        by_bill[bid].append(PydanticObjectId(tid))
    coll = Transaction.get_motor_collection()
    n = 0
    for bid, tids in by_bill.items():
        res = await coll.update_many(
            {"household_id": household_id, "_id": {"$in": tids}, "bill_id": None},
            {"$set": {"bill_id": PydanticObjectId(bid)}},
        )
        n += res.modified_count
    return n


async def build_month(household_id: PydanticObjectId, month: str, today: dt.date) -> dict[str, Any]:
    start, end = report_range(month, month)
    bills, streams, txns = await asyncio.gather(
        load_bills(household_id), load_streams(household_id), load_match_txns(household_id, start, end)
    )
    report = month_report([bill_dict(b) for b in bills], [stream_dict(s) for s in streams], txns, month, today)
    await persist_links(household_id, report.pop("links"), month, today)
    return report


async def household_cash(household_id: PydanticObjectId) -> tuple[int, list[dict[str, Any]]]:
    """Balance of household (non-business) AED bank and cash accounts."""
    accounts, deltas = await asyncio.gather(
        Account.find({"household_id": household_id, "archived": False}).to_list(),
        transaction_deltas(household_id),
    )
    balances = apply_balances(accounts, deltas)
    picked = [
        a for a in accounts
        if a.type in CASH_ACCOUNT_TYPES and a.currency == "AED" and getattr(a, "purpose", "household") != "business"
    ]
    rows = [{"accountId": str(a.id), "name": a.name, "balanceFils": balances[str(a.id)]} for a in picked]
    return sum(r["balanceFils"] for r in rows), rows


async def build_overview(household_id: PydanticObjectId, today: dt.date) -> dict[str, Any]:
    """Dashboard: safe to spend, income still expected this month, bills due in the next 14 days."""
    month = f"{today.year:04d}-{today.month:02d}"
    nxt = add_months(month, 1)
    start, end = report_range(month, nxt)
    bills, streams, txns, (cash, cash_accounts) = await asyncio.gather(
        load_bills(household_id), load_streams(household_id), load_match_txns(household_id, start, end),
        household_cash(household_id),
    )
    b, s = [bill_dict(x) for x in bills], [stream_dict(x) for x in streams]
    cur = month_report(b, s, txns, month, today)
    later = month_report(b, s, txns, nxt, today)
    await persist_links(household_id, cur.pop("links"), month, today)
    later.pop("links")
    safe = safe_to_spend(cash, cur["items"] + later["items"], cur["income"] + later["income"], today)
    safe["accounts"] = cash_accounts
    horizon = today + dt.timedelta(days=UPCOMING_DAYS)
    upcoming = [
        i for i in cur["items"] + later["items"]
        if i["status"] in ("overdue", "due_soon", "upcoming") and i["purpose"] == "household"
        and dt.date.fromisoformat(i["dueFrom"]) <= horizon
    ]
    waiting = [i for i in cur["income"] if i["status"] != "received"]
    return {
        "month": month,
        "today": today.isoformat(),
        "safeToSpend": safe,
        "waitingFor": waiting,
        "upcomingBills": upcoming,
        "totals": cur["totals"],
        "hasBills": bool(bills),
        "hasIncome": bool(streams),
    }


PlanInputs = tuple[list[Bill], list[IncomeStream], list[dict[str, Any]], list[Goal]]


async def load_plan_inputs(household_id: PydanticObjectId, month: str) -> PlanInputs:
    """Everything the zero-based plan needs, in one concurrent round trip."""
    start, end = report_range(month, month)
    bills, streams, txns, goals = await asyncio.gather(
        load_bills(household_id), load_streams(household_id), load_match_txns(household_id, start, end),
        Goal.find({"household_id": household_id, "archived": False}).sort("+priority").to_list(),
    )
    return bills, streams, txns, goals


def compose_plan(inputs: PlanInputs, month: str, flexible_fils: int, budget_category_ids: list[str]) -> dict[str, Any]:
    """Zero-based plan for the budget page (see ``zero_based_plan``) plus the goal to send leftovers to."""
    bills, streams, txns, goals = inputs
    b, s = [bill_dict(x) for x in bills], [stream_dict(x) for x in streams]
    expected, _ = expected_amounts(b, s, txns, month)
    plan = zero_based_plan(b, s, month, flexible_fils, expected, budget_category_ids)
    goal = next((g for g in goals if g.saved_fils < g.target_fils), None)
    plan["suggestedGoal"] = {"id": str(goal.id), "name": goal.name} if goal else None
    plan["hasBills"] = bool(bills)
    plan["hasIncome"] = bool(streams)
    return plan


async def build_suggestions(household_id: PydanticObjectId, today: dt.date) -> list[dict[str, Any]]:
    month = f"{today.year:04d}-{today.month:02d}"
    start, _ = month_bounds(add_months(month, -6))
    bills, txns = await asyncio.gather(load_bills(household_id), load_match_txns(household_id, start, today))
    return detect_recurring(txns, [bill_dict(x) for x in bills], today)


def bill_derived(b: Bill, today: dt.date) -> dict[str, Any]:
    d = bill_dict(b)
    month = f"{today.year:04d}-{today.month:02d}"
    last = last_month(d)
    remaining = None
    if b.instalments_total:
        remaining = max(0, b.instalments_total - b.instalments_paid)
        # Instalments whose month has passed (before this month) count as paid.
        elapsed = 0
        if month > b.start_month:
            y1, m1 = int(b.start_month[:4]), int(b.start_month[5:])
            y2, m2 = today.year, today.month
            step = {"monthly": 1, "quarterly": 3, "yearly": 12}[b.cadence]
            elapsed = ((y2 - y1) * 12 + (m2 - m1) + step - 1) // step
        remaining = max(0, remaining - elapsed)
    return {
        "monthly_fils": monthly_share(d),
        "last_month": last,
        "instalments_remaining": remaining,
        "remaining_fils": remaining * b.amount_fils if remaining is not None else None,
        "completed": last is not None and last < month,
    }
