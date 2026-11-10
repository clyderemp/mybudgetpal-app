"""Insights explorer: pure periods/filters/forecast + the /insights/explore endpoint."""
from __future__ import annotations

import datetime as dt

import pytest

from app.analytics import explore as ex
from app.services.insights import get_today
from tests.conftest import first_category, make_account

TODAY = dt.date(2026, 11, 8)
D = dt.date


def _t(date, amount, type_="expense", cat="c1", acct="a1", who="u1", merchant=None):
    return {"id": f"{date}-{amount}", "date": date, "amount_fils": amount, "type": type_, "category_id": cat,
            "account_id": acct, "created_by": who, "merchant": merchant}


def test_periods_and_auto_granularity():
    assert ex.auto_granularity(D(2026, 11, 1), D(2026, 11, 30)) == "day"
    assert ex.auto_granularity(D(2026, 6, 1), D(2026, 11, 30)) == "week"
    assert ex.auto_granularity(D(2025, 12, 1), D(2026, 11, 30)) == "month"
    assert ex.period_start(D(2026, 11, 8), "week") == D(2026, 11, 2)  # Monday
    assert ex.periods_between(D(2026, 1, 31), D(2026, 3, 1), "month") == [D(2026, 1, 1), D(2026, 2, 1), D(2026, 3, 1)]
    assert ex.next_period(D(2026, 12, 1), "month") == D(2027, 1, 1)


def test_filters_drop_transfers_and_match_every_filter():
    txns = [
        _t(D(2026, 11, 1), 100, cat="c1", who="u1", merchant="Carrefour MOE"),
        _t(D(2026, 11, 1), 200, cat=None, who="u2"),
        _t(D(2026, 11, 1), 300, type_="transfer"),
    ]
    assert len(ex.apply_filters(txns)) == 2
    assert [t["amount_fils"] for t in ex.apply_filters(txns, category_ids={"none"})] == [200]
    assert [t["amount_fils"] for t in ex.apply_filters(txns, member_ids={"u1"}, merchant="carrefour")] == [100]
    assert ex.apply_filters(txns, account_ids={"zzz"}) == []


def test_project_needs_three_periods_and_brackets_the_point():
    assert ex.project([0, 0, 100, 100], 2) is None  # only two periods after recording began
    out = ex.project([100_000, 110_000, 120_000, 130_000], 3)
    assert out is not None and len(out) == 3
    assert all(p["lowFils"] <= p["fils"] <= p["highFils"] for p in out)
    assert out[0]["fils"] > 120_000  # rising trend carries forward
    assert out[2]["highFils"] - out[2]["lowFils"] > out[0]["highFils"] - out[0]["lowFils"]  # widens
    # recording stopped: trailing empty periods are a gap, not "spending fell to zero"
    falling = ex.project([90_000, 60_000, 30_000, 5_000], 3)
    assert falling is not None and all(p["fils"] > 0 for p in falling)  # never projects to nothing
    gap = ex.project([100_000, 100_000, 100_000, 100_000, 0, 0, 0], 1)
    assert gap is not None and gap[0]["fils"] == 100_000


def test_explore_flags_stale_history():
    txns = [_t(D(2026, m, 5), 10_000) for m in (3, 4, 5, 6, 7)]
    out = ex.explore([], [], D(2026, 11, 1), D(2026, 11, 8), TODAY, granularity="month", history=txns)
    fc = out["forecast"]
    assert fc["stale"] and fc["confidence"] == "low" and fc["lastDataPeriod"] == "2026-07"
    assert fc["points"][0]["expenseFils"] == 10_000


def test_explore_series_breakdown_previous_and_pace():
    txns = [
        _t(D(2026, 10, 3), 5_000, cat="c1"),
        _t(D(2026, 10, 9), 1_000, cat="c2", merchant="ENOC"),
        _t(D(2026, 10, 9), 20_000, type_="income", cat="sal"),
        _t(D(2026, 11, 2), 3_000, cat="c1", merchant="enoc"),
    ]
    prev = [_t(D(2026, 8, 20), 4_000)]
    out = ex.explore(
        txns, prev, D(2026, 10, 1), D(2026, 11, 30), TODAY,
        granularity="month", labels={"category": lambda k: {"c1": "Groceries", "c2": "Fuel"}.get(k, "?")},
    )
    assert [s["period"] for s in out["series"]] == ["2026-10", "2026-11"]
    assert [s["expenseFils"] for s in out["series"]] == [6_000, 3_000]
    assert out["series"][0]["prevExpenseFils"] == 4_000  # Aug aligns with Oct
    assert out["series"][1]["cumulativeNetFils"] == 20_000 - 9_000
    assert out["totals"]["expenseFils"] == 9_000 and out["previous"]["expenseFils"] == 4_000
    assert [(b["label"], b["fils"]) for b in out["breakdown"]] == [("Groceries", 8_000), ("Fuel", 1_000)]
    assert out["pace"]["spentFils"] == 3_000 and out["pace"]["totalDays"] == 30
    assert out["pace"]["projectedFils"] == round(3_000 * 30 / 8)

    by_merchant = ex.explore(txns, [], D(2026, 10, 1), D(2026, 11, 30), TODAY, group_by="merchant")
    rows = {b["key"]: (b["label"], b["fils"]) for b in by_merchant["breakdown"]}
    assert rows == {"enoc": ("ENOC", 4_000), "none": ("No merchant", 5_000)}  # case-insensitive merge
    assert by_merchant["topMerchants"][0]["count"] == 2


def test_explore_stacks_top_groups_and_other():
    txns = [_t(D(2026, 11, 1), 1000 * (i + 1), cat=f"c{i}") for i in range(9)]
    out = ex.explore(txns, [], D(2026, 11, 1), D(2026, 11, 7), TODAY)
    assert len(out["stackKeys"]) == ex.STACK_TOP + 1 and out["stackKeys"][-1]["key"] == "__other"
    first = out["stacked"][0]["values"]
    assert sum(first.values()) == sum(1000 * (i + 1) for i in range(9))


async def _txn(c, acc, date, amount, type_, cat, merchant=None):
    body = {"accountId": acc, "date": date, "amountFils": amount, "type": type_, "categoryId": cat}
    if merchant:
        body["merchant"] = merchant
    r = await c.post("/api/v1/transactions", json=body)
    assert r.status_code == 201, r.text


@pytest.fixture
async def seeded(app, owner):
    app.dependency_overrides[get_today] = lambda: TODAY
    acc = (await make_account(owner, "Mashreq", 0))["id"]
    card = (await make_account(owner, "Visa", 0))["id"]
    cat = {n: (await first_category(owner, n))["id"] for n in ("Salary", "Groceries", "Dining")}
    for i, m in enumerate(("2026-06", "2026-07", "2026-08", "2026-09", "2026-10")):
        await _txn(owner, acc, f"{m}-01", 2_000_000, "income", cat["Salary"])
        await _txn(owner, acc, f"{m}-10", 150_000 + i * 10_000, "expense", cat["Groceries"], "Carrefour")
        await _txn(owner, card, f"{m}-20", 20_000, "expense", cat["Dining"], "Zuma")
    await _txn(owner, acc, "2026-11-03", 100_000, "expense", cat["Groceries"], "Carrefour")
    yield {"acc": acc, "card": card, "cat": cat}
    app.dependency_overrides.pop(get_today, None)


async def test_explore_endpoint(seeded, owner):
    r = await owner.get("/api/v1/insights/explore", params={"from": "2026-06-01", "to": "2026-11-30", "granularity": "month"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["totals"]["incomeFils"] == 5 * 2_000_000
    assert body["breakdown"][0]["label"] == "Groceries"
    assert len(body["forecast"]["points"]) == 3 and body["forecast"]["points"][0]["period"] == "2026-11"
    assert body["pace"]["spentFils"] == 100_000

    only_card = (await owner.get("/api/v1/insights/explore", params={
        "from": "2026-06-01", "to": "2026-11-30", "accounts": seeded["card"], "groupBy": "account"})).json()
    assert only_card["totals"]["expenseFils"] == 5 * 20_000
    assert [b["label"] for b in only_card["breakdown"]] == ["Visa"]

    merch = (await owner.get("/api/v1/insights/explore", params={
        "from": "2026-06-01", "to": "2026-11-30", "merchant": "carre", "groupBy": "member"})).json()
    assert merch["totals"]["expenseCount"] == 6 and len(merch["breakdown"]) == 1


async def test_explore_validates(owner):
    bad = [
        {"from": "2026-11-10", "to": "2026-11-01"},
        {"groupBy": "planet"},
        {"granularity": "hour"},
        {"from": "2010-01-01", "to": "2026-01-01"},
        {"flow": "transfer"},
    ]
    for params in bad:
        assert (await owner.get("/api/v1/insights/explore", params=params)).status_code == 422, params
