from __future__ import annotations

import datetime as dt
from collections import defaultdict

import pytest
from beanie import PydanticObjectId

from app.models import Account, Debt, Household, Transaction, User
from app.services.balances import account_balances
from scripts.seed_demo import CARD_START_BALANCE, DEMO_EMAIL, seed

TODAY = dt.date(2026, 11, 8)


async def test_seed_card_consistency(app):
    result = await seed(TODAY, "pw-demo-123456")
    hid = PydanticObjectId(result["household_id"])
    card = await Account.get(PydanticObjectId(result["card_account_id"]))
    assert card is not None and card.type == "credit_card"
    assert card.opening_balance_fils == -CARD_START_BALANCE * 100

    debts = {d.name: d for d in await Debt.find({"household_id": hid}).to_list()}
    card_debt = debts["Mashreq Credit Card"]
    assert card_debt.account_id == card.id
    assert debts["ENBD Auto Loan"].account_id is None

    balance = (await account_balances(hid, [card]))[str(card.id)]
    assert balance == result["card_balance_fils"]
    assert card_debt.balance_fils == -balance
    # Stays near the starting balance: only the current (unpaid) month's spend accumulates.
    assert -balance - CARD_START_BALANCE * 100 < 500_000

    txns = await Transaction.find({"household_id": hid}).to_list()
    spend: dict[str, int] = defaultdict(int)
    paid: dict[str, int] = defaultdict(int)
    for t in txns:
        m = t.date.strftime("%Y-%m")
        if t.account_id == card.id:
            assert t.type == "expense"
            spend[m] += t.amount_fils
        if t.to_account_id == card.id:
            assert t.type == "transfer" and t.category_id is None
            paid[m] += t.amount_fils
    full_months = [m for m in spend if m < "2026-11"]
    assert len(full_months) == 6
    for m in full_months:
        assert abs(paid[m] - spend[m]) <= 500, m  # within AED 5 (rounded to AED 10)
    assert "2026-11" not in paid  # payment on the 28th is still in the future


async def test_seed_refuses_when_users_exist_and_force_is_scoped(app, owner):
    other = await User.find_one({"email": "clyde@example.com"})
    assert other is not None
    with pytest.raises(SystemExit):
        await seed(TODAY, "pw-demo-123456")
    assert await User.find_one({"email": DEMO_EMAIL}) is None

    first = await seed(TODAY, "pw-demo-123456", force=True)
    second = await seed(TODAY, "pw-demo-123456", force=True)  # recreates only the demo household
    assert first["household_id"] != second["household_id"]
    assert await User.find({"email": DEMO_EMAIL}).count() == 1
    assert await Household.get(PydanticObjectId(first["household_id"])) is None
    assert await Account.find({"household_id": PydanticObjectId(first["household_id"])}).count() == 0
    # the pre-existing user's household is untouched
    assert await User.find_one({"email": "clyde@example.com"}) is not None
    assert await Household.get(other.household_id) is not None
    assert (await owner.get("/api/v1/auth/me")).status_code == 200


async def test_seeded_api_views_agree(app, client):
    from app.services.insights import get_today

    app.dependency_overrides[get_today] = lambda: TODAY
    try:
        await seed(TODAY, "pw-demo-123456")
        r = await client.post("/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": "pw-demo-123456"})
        assert r.status_code == 200, r.text
        accounts = {a["name"]: a for a in (await client.get("/api/v1/accounts")).json()["items"]}
        debts = {d["name"]: d for d in (await client.get("/api/v1/debts")).json()["items"]}
        card = debts["Mashreq Credit Card"]
        assert card["linkedAccountBalanceFils"] == accounts["Mashreq Credit Card"]["balanceFils"] == -card["balanceFils"]
        assert debts["ENBD Auto Loan"]["linkedAccountBalanceFils"] is None

        # Every forecast trend agrees with forecast vs last full month (Oct), +/-5% band.
        oct_ = (await client.get("/api/v1/insights/summary", params={"month": "2026-10"})).json()
        last = {c["categoryId"]: c["expenseFils"] for c in oct_["byCategory"]}
        for row in (await client.get("/api/v1/insights/forecast")).json()["byCategory"]:
            prev, fc = last.get(row["categoryId"], 0), row["forecastFils"]
            if prev and abs(fc - prev) < 0.05 * prev or (not prev and fc == 0):
                assert row["trend"] == "flat", row
            else:
                assert row["trend"] == ("up" if fc > prev else "down"), row
    finally:
        app.dependency_overrides.pop(get_today, None)
