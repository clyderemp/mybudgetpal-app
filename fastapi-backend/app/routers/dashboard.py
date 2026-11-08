from __future__ import annotations

import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends

from app.models import Transaction
from app.routers.budgets import build_budget_out
from app.security.deps import CurrentUser, get_current_user
from app.services.insights import (
    active_accounts,
    active_debts,
    get_today,
    health_for,
    load_months,
    month_str,
    shift_month,
    summary_with_previous,
    upcoming_debt_payments,
)
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
    txns = await load_months(hid, shift_month(month, -1), month)
    accounts, balances = await active_accounts(hid)
    recent = (
        await Transaction.find({"household_id": hid, "deleted_at": None})
        .sort([("date", -1), ("created_at", -1)])
        .limit(RECENT_TRANSACTIONS)
        .to_list()
    )
    names = await member_names(hid)
    return {
        "summary": summary_with_previous(txns, month),
        "health": await health_for(hid, today),
        "budget": _dump(await build_budget_out(hid, month)),
        "upcomingDebtPayments": upcoming_debt_payments(await active_debts(hid), today),
        "recentTransactions": [_dump(transaction_out(t, names)) for t in recent],
        "accounts": [_dump(account_out(a, balances[str(a.id)])) for a in accounts],
    }
