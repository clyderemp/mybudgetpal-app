"""Monthly income/expense summaries (spec §6 summary.py)."""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable

from ._common import EXPENSE, INCOME, amount, get, month_range, parse_month, spending_txns, txn_month, txn_type


def monthly_summary(txns: Iterable[Any], month: str) -> dict:
    """Totals for one month.

    ``savingsRate`` = net / income, clamped to [0, 1]; ``None`` when there is no income.
    ``byCategory`` lists expense categories sorted by spend desc (ties by categoryId),
    ``share`` is the category's fraction of total expense (rounded to 4 dp).
    """
    parse_month(month)
    income = 0
    expense = 0
    by_cat: dict[Any, int] = defaultdict(int)
    for t in spending_txns(txns):
        if txn_month(t) != month:
            continue
        a = amount(t)
        if txn_type(t) == INCOME:
            income += a
        elif txn_type(t) == EXPENSE:
            expense += a
            by_cat[get(t, "category_id")] += a

    net = income - expense
    savings_rate = None if income <= 0 else round(min(1.0, max(0.0, net / income)), 4)
    rows = sorted(by_cat.items(), key=lambda kv: (-kv[1], "" if kv[0] is None else str(kv[0])))
    return {
        "month": month,
        "incomeFils": income,
        "expenseFils": expense,
        "netFils": net,
        "savingsRate": savings_rate,
        "byCategory": [
            {
                "categoryId": cid,
                "expenseFils": fils,
                "share": round(fils / expense, 4) if expense else 0.0,
            }
            for cid, fils in rows
        ],
    }


def monthly_series(txns: Iterable[Any], end_month: str, months: int) -> list[dict]:
    """One zero-filled entry per month, oldest first, ending at ``end_month``."""
    if months < 1:
        return []
    keys = month_range(end_month, months)
    acc = {m: [0, 0] for m in keys}
    for t in spending_txns(txns):
        m = txn_month(t)
        if m in acc:
            acc[m][0 if txn_type(t) == INCOME else 1] += amount(t)
    return [
        {"month": m, "incomeFils": inc, "expenseFils": exp, "netFils": inc - exp}
        for m, (inc, exp) in acc.items()
    ]
