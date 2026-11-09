from __future__ import annotations

import datetime as dt

from app.models import User
from app.services import load_analytics_txns
from tests.conftest import first_category, make_account


async def test_load_analytics_txns(owner):
    c = owner
    bank = await make_account(c)
    cash = await make_account(c, "Cash")
    groceries = await first_category(c, "Groceries")
    for d in ("2026-10-31", "2026-11-01", "2026-11-30", "2026-12-01"):
        await c.post("/api/v1/transactions", json={"accountId": bank["id"], "date": d, "amountFils": 100,
                                                   "type": "expense", "categoryId": groceries["id"]})
    await c.post("/api/v1/transactions", json={"accountId": bank["id"], "toAccountId": cash["id"],
                                               "date": "2026-11-15", "amountFils": 7, "type": "transfer"})
    hid = (await User.find_one({})).household_id
    rows = await load_analytics_txns(hid, dt.date(2026, 11, 1), dt.date(2026, 11, 30))
    assert [r["date"] for r in rows] == [dt.date(2026, 11, 1), dt.date(2026, 11, 15), dt.date(2026, 11, 30)]
    r0 = rows[0]
    assert set(r0) >= {"id", "date", "amount_fils", "type", "category_id", "account_id"}
    assert r0["category_id"] == groceries["id"] and r0["account_id"] == bank["id"]
    assert isinstance(r0["date"], dt.date) and not isinstance(r0["date"], dt.datetime)
    assert rows[1]["type"] == "transfer" and rows[1]["category_id"] is None
    assert len(await load_analytics_txns(str(hid), None, None)) == 5


def test_health_projects_partial_current_month_expenses_only():
    from types import SimpleNamespace

    from app.services.insights import compute_health

    today = dt.date(2026, 11, 10)  # day 10 of 30 -> expenses x3
    txns = [
        {"date": dt.date(2026, 11, 1), "amount_fils": 1_000_000, "type": "income", "category_id": None, "account_id": "a"},
        {"date": dt.date(2026, 11, 5), "amount_fils": 100_000, "type": "expense", "category_id": "c", "account_id": "a"},
    ]
    bank = SimpleNamespace(id="a", type="bank", currency="AED")
    h = compute_health(txns, [bank], {"a": 900_000}, [], today)
    # projected expense 300_000 (not 100_000): emergency fund = 900_000 / 300_000 = 3 months, not 9
    assert h["emergencyFundMonths"] == 3.0
    # income is not projected: (1_000_000 - 300_000) / 1_000_000
    assert h["savingsRate"] == 0.7
