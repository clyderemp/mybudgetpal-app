from __future__ import annotations

import asyncio
import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends

from app.models import Budget, Category, Transaction
from app.routers.budgets import compose_budget_out
from app.security.deps import CurrentUser, get_current_user
from app.services.analytics_data import filter_txns
from app.services.insights import (
    active_accounts,
    active_debts,
    compute_health,
    get_today,
    health_range,
    load_months,
    month_str,
    shift_month,
    summary_with_previous,
    upcoming_debt_payments,
)
from app.services.months import month_bounds
from app.services.serializers import account_out, member_names, transaction_out

router = APIRouter(tags=["dashboard"])

RECENT_TRANSACTIONS = 10


def _dump(model: Any) -> Any:
    return model.model_dump(by_alias=True, mode="json")


@router.get("/dashboard")
async def dashboard(
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    hid = current.household_id
    month = month_str(today)
    # Every query is independent: run them all in one concurrent round trip. Transactions are
    # loaded once for the widest range (health: last 6 months + current) and narrowed in
    # memory for the summary (previous + current month) and the budget (current month).
    first, last = health_range(today)
    txns, (accounts, balances), debts, recent, names, budget, cats = await asyncio.gather(
        load_months(hid, first, last),
        active_accounts(hid),
        active_debts(hid),
        Transaction.find({"household_id": hid, "deleted_at": None})
        .sort([("date", -1), ("created_at", -1)])
        .limit(RECENT_TRANSACTIONS)
        .to_list(),
        member_names(hid),
        Budget.find_one({"household_id": hid, "month": month}),
        Category.find({"household_id": hid}).to_list(),
    )
    summary_start, _ = month_bounds(shift_month(month, -1))
    month_start, month_end = month_bounds(month)
    return {
        "summary": summary_with_previous(filter_txns(txns, summary_start, month_end), month),
        "health": compute_health(txns, accounts, balances, debts, today),
        "budget": _dump(
            compose_budget_out(
                month, budget, filter_txns(txns, month_start, month_end), {str(c.id): c for c in cats}
            )
        ),
        "upcomingDebtPayments": upcoming_debt_payments(debts, today),
        "recentTransactions": [_dump(transaction_out(t, names)) for t in recent],
        "accounts": [_dump(account_out(a, balances[str(a.id)])) for a in accounts],
    }
