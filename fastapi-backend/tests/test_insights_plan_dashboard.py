from __future__ import annotations

import datetime as dt

import pytest

from app.services.insights import get_today, next_due_date
from tests.conftest import first_category, make_account, register

TODAY = dt.date(2026, 11, 8)
PAST_MONTHS = ("2026-06", "2026-07", "2026-08", "2026-09", "2026-10")


async def _txn(c, acc, date, amount, type_, cat):
    r = await c.post(
        "/api/v1/transactions",
        json={"accountId": acc, "date": date, "amountFils": amount, "type": type_, "categoryId": cat},
    )
    assert r.status_code == 201, r.text


@pytest.fixture
async def seeded(app, owner):
    """Jun–Oct: salary 20,000 / rent 7,000 / groceries 1,500 / dining 200 per month.
    Nov (current, today = 2026-11-08): salary 20,000, groceries 1,000, dining 1,200 (spike).
    Debts: Visa 3,000 @ 29.99% min 150 due 15; Car 50,000 @ 5% min 2,000 due 5."""
    app.dependency_overrides[get_today] = lambda: TODAY
    c = owner
    acc = (await make_account(c, "Mashreq Neo", 1_000_000))["id"]
    cat = {n: (await first_category(c, n))["id"] for n in ("Salary", "Rent", "Groceries", "Dining")}
    for m in PAST_MONTHS:
        await _txn(c, acc, f"{m}-01", 2_000_000, "income", cat["Salary"])
        await _txn(c, acc, f"{m}-02", 700_000, "expense", cat["Rent"])
        await _txn(c, acc, f"{m}-10", 150_000, "expense", cat["Groceries"])
        await _txn(c, acc, f"{m}-20", 20_000, "expense", cat["Dining"])
    await _txn(c, acc, "2026-11-01", 2_000_000, "income", cat["Salary"])
    await _txn(c, acc, "2026-11-03", 100_000, "expense", cat["Groceries"])
    await _txn(c, acc, "2026-11-06", 120_000, "expense", cat["Dining"])
    visa = (await c.post("/api/v1/debts", json={
        "name": "Visa", "kind": "credit_card", "balanceFils": 300_000, "aprBps": 2999,
        "minPaymentFils": 15_000, "dueDay": 15})).json()
    car = (await c.post("/api/v1/debts", json={
        "name": "Car loan", "kind": "car_loan", "balanceFils": 5_000_000, "aprBps": 500,
        "minPaymentFils": 200_000, "dueDay": 5})).json()
    yield {"client": c, "account": acc, "cat": cat, "visa": visa, "car": car}
    app.dependency_overrides.pop(get_today, None)


def test_next_due_date():
    assert next_due_date(15, dt.date(2026, 11, 8)) == dt.date(2026, 11, 15)
    assert next_due_date(8, dt.date(2026, 11, 8)) == dt.date(2026, 11, 8)
    assert next_due_date(5, dt.date(2026, 11, 8)) == dt.date(2026, 12, 5)
    assert next_due_date(1, dt.date(2026, 12, 31)) == dt.date(2027, 1, 1)


async def test_insights_summary(seeded):
    c = seeded["client"]
    r = await c.get("/api/v1/insights/summary")
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["month"] == "2026-11"
    assert (s["incomeFils"], s["expenseFils"], s["netFils"]) == (2_000_000, 220_000, 1_780_000)
    assert s["byCategory"][0] == {"categoryId": seeded["cat"]["Dining"], "expenseFils": 120_000,
                                  "share": pytest.approx(120_000 / 220_000, abs=1e-4)}
    assert s["previous"]["month"] == "2026-10" and s["previous"]["expenseFils"] == 870_000
    assert s["deltas"]["expenseFils"] == 220_000 - 870_000
    assert s["deltas"]["netFils"] == 1_780_000 - 1_130_000

    r = await c.get("/api/v1/insights/summary", params={"month": "2026-06"})
    assert r.json()["expenseFils"] == 870_000 and r.json()["previous"]["incomeFils"] == 0
    assert (await c.get("/api/v1/insights/summary", params={"month": "2026-13"})).status_code == 422


async def test_insights_trends(seeded):
    c = seeded["client"]
    body = (await c.get("/api/v1/insights/trends", params={"months": 6})).json()
    assert body["total"] == 6
    assert [x["month"] for x in body["items"]] == [*PAST_MONTHS, "2026-11"]
    assert body["items"][0] == {"month": "2026-06", "incomeFils": 2_000_000, "expenseFils": 870_000, "netFils": 1_130_000}
    default = (await c.get("/api/v1/insights/trends")).json()
    assert default["total"] == 12 and default["items"][0]["month"] == "2025-12"
    assert default["items"][0]["incomeFils"] == 0
    assert (await c.get("/api/v1/insights/trends", params={"months": 0})).status_code == 422


async def test_insights_forecast(seeded):
    f = (await seeded["client"].get("/api/v1/insights/forecast")).json()
    assert f["month"] == "2026-12"
    assert f["confidence"] == "medium"  # 5 data months (Jun–Oct)
    by = {x["categoryId"]: x for x in f["byCategory"]}
    assert by[seeded["cat"]["Rent"]]["forecastFils"] == 700_000
    assert by[seeded["cat"]["Rent"]]["trend"] == "flat"
    assert f["totalExpenseFils"] == 870_000
    assert f["totalIncomeFils"] == 2_000_000


async def test_insights_anomalies(seeded):
    c = seeded["client"]
    body = (await c.get("/api/v1/insights/anomalies")).json()
    spikes = [a for a in body["items"] if a["kind"] == "category_spike"]
    assert len(spikes) == 1
    assert spikes[0]["categoryId"] == seeded["cat"]["Dining"]
    assert spikes[0]["amountFils"] == 120_000 and spikes[0]["baselineFils"] == 20_000
    assert (await c.get("/api/v1/insights/anomalies", params={"month": "2026-10"})).json()["total"] == 0


async def test_insights_health(seeded):
    h = (await seeded["client"].get("/api/v1/insights/health")).json()
    # Jun–Oct: income 10,000,000, expense 4,350,000; liquid 8,430,000; minimums 215,000
    assert h["savingsRate"] == pytest.approx(0.565)
    assert h["emergencyFundMonths"] == pytest.approx(9.69)
    assert h["debtToIncome"] == pytest.approx(0.1075)
    assert h["score"] == 99  # 35 + 35 + 29.44
    assert isinstance(h["tips"], list)


async def test_plan_settings_and_payoff(seeded):
    c, visa, car = seeded["client"], seeded["visa"], seeded["car"]
    p = (await c.get("/api/v1/plan")).json()
    assert p == {"strategy": "avalanche", "monthlyDebtBudgetFils": 215_000,
                 "monthlySavingsFils": 0, "emergencyFundMonths": 3}

    bad = {"strategy": "snowball", "monthlyDebtBudgetFils": 100_000, "monthlySavingsFils": 0, "emergencyFundMonths": 3}
    r = await c.put("/api/v1/plan", json=bad)
    assert r.status_code == 422 and "monthlyDebtBudgetFils" in r.json()["error"]["fields"]
    assert (await c.put("/api/v1/plan", json={**bad, "monthlyDebtBudgetFils": 500_000, "x": 1})).status_code == 422

    good = {**bad, "monthlyDebtBudgetFils": 500_000, "monthlySavingsFils": 300_000}
    r = await c.put("/api/v1/plan", json=good)
    assert r.status_code == 200 and r.json() == good
    assert (await c.get("/api/v1/plan")).json() == good
    good2 = {**good, "strategy": "avalanche"}
    assert (await c.put("/api/v1/plan", json=good2)).json()["strategy"] == "avalanche"

    r = await c.get("/api/v1/plan/payoff")
    po = r.json()
    assert r.status_code == 200 and po["feasible"] is True
    assert po["strategy"] == "avalanche" and po["order"] == [visa["id"], car["id"]]
    assert po["schedule"][0]["month"] == "2026-11"
    # first month: Visa interest 300,000 * 2999 / 120,000 = 7,497.5 -> 7,498
    first_visa = next(x for x in po["schedule"][0]["payments"] if x["debtId"] == visa["id"])
    assert first_visa["interestFils"] == 7_498

    infeasible = (await c.get("/api/v1/plan/payoff", params={"monthlyBudgetFils": 100_000})).json()
    assert infeasible == {**infeasible, "feasible": False, "reason": "budget_below_minimums", "shortfallFils": 115_000}
    sb = (await c.get("/api/v1/plan/payoff", params={"strategy": "snowball"})).json()
    assert sb["strategy"] == "snowball"
    assert (await c.get("/api/v1/plan/payoff", params={"strategy": "nope"})).status_code == 422

    cmp = (await c.get("/api/v1/plan/compare", params={"monthlyBudgetFils": 400_000})).json()
    assert cmp["avalanche"]["strategy"] == "avalanche" and cmp["snowball"]["strategy"] == "snowball"
    assert cmp["interestSavedFils"] == cmp["snowball"]["totalInterestFils"] - cmp["avalanche"]["totalInterestFils"]

    # archived debts are excluded
    await c.post(f"/api/v1/debts/{car['id']}/archive")
    assert (await c.get("/api/v1/plan/payoff")).json()["order"] == [visa["id"]]


async def test_dashboard(seeded):
    c = seeded["client"]
    r = await c.get("/api/v1/dashboard")
    assert r.status_code == 200, r.text
    d = r.json()
    assert set(d) == {"summary", "health", "budget", "upcomingDebtPayments", "recentTransactions", "accounts"}
    assert d["summary"]["month"] == "2026-11" and d["summary"]["expenseFils"] == 220_000
    assert d["health"]["score"] == 99
    assert d["budget"]["month"] == "2026-11" and d["budget"]["totalSpentFils"] == 220_000
    assert d["budget"]["incomeFils"] == 2_000_000
    assert d["upcomingDebtPayments"] == [
        {"debtId": seeded["visa"]["id"], "name": "Visa", "dueDate": "2026-11-15", "minPaymentFils": 15_000},
        {"debtId": seeded["car"]["id"], "name": "Car loan", "dueDate": "2026-12-05", "minPaymentFils": 200_000},
    ]
    recent = d["recentTransactions"]
    assert len(recent) == 10
    assert [t["date"] for t in recent[:3]] == ["2026-11-06", "2026-11-03", "2026-11-01"]
    assert recent[0]["createdByName"] == "Clyde" and "amountFils" in recent[0]
    assert len(d["accounts"]) == 1 and d["accounts"][0]["balanceFils"] == 8_430_000


async def test_dashboard_empty_household(app, owner):
    app.dependency_overrides[get_today] = lambda: TODAY
    try:
        d = (await owner.get("/api/v1/dashboard")).json()
        assert d["upcomingDebtPayments"] == [] and d["recentTransactions"] == [] and d["accounts"] == []
        assert d["summary"]["incomeFils"] == 0 and d["summary"]["savingsRate"] is None
        assert 0 <= d["health"]["score"] <= 100
        assert (await owner.get("/api/v1/plan/payoff")).json()["feasible"] is True
        assert (await owner.get("/api/v1/insights/forecast")).json()["confidence"] == "low"
    finally:
        app.dependency_overrides.pop(get_today, None)


async def test_requires_auth(client):
    for path in ("/api/v1/dashboard", "/api/v1/insights/summary", "/api/v1/insights/health",
                 "/api/v1/plan", "/api/v1/plan/payoff", "/api/v1/plan/compare"):
        assert (await client.get(path)).status_code == 401, path


@pytest.mark.parametrize("settings_overrides", [{"allow_registration": True}])
async def test_insights_isolation(new_client):
    async with new_client() as a, new_client() as b:
        await register(a, "a@example.com", "A home")
        await register(b, "b@example.com", "B home")
        acc = await make_account(a, "A bank", 1000)
        groceries = await first_category(a, "Groceries")
        await _txn(a, acc["id"], dt.date.today().isoformat(), 5_000, "expense", groceries["id"])
        await a.post("/api/v1/debts", json={"name": "Visa", "kind": "credit_card", "balanceFils": 1000,
                                            "aprBps": 0, "minPaymentFils": 100, "dueDay": 1})
        assert (await a.get("/api/v1/insights/trends", params={"months": 2})).json()["items"][-1]["expenseFils"] in (0, 5_000)
        d = (await b.get("/api/v1/dashboard")).json()
        assert d["recentTransactions"] == [] and d["accounts"] == [] and d["upcomingDebtPayments"] == []
        assert d["summary"]["expenseFils"] == 0
        assert (await b.get("/api/v1/plan/payoff")).json()["order"] == []


async def test_seed_demo_script(app, client):
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "scripts" / "seed_demo.py"
    spec = importlib.util.spec_from_file_location("seed_demo", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    app.dependency_overrides[get_today] = lambda: TODAY
    try:
        result = await mod.seed(TODAY, "demo-password-123")
        assert result["transactions"] > 150
        r = await client.post("/api/v1/auth/login", json={"email": mod.DEMO_EMAIL, "password": "demo-password-123"})
        assert r.status_code == 200, r.text
        d = (await client.get("/api/v1/dashboard")).json()
        assert {a["name"] for a in d["accounts"]} == {"Mashreq Neo", "Emirates NBD", "Cash", "Mashreq Credit Card"}
        assert len(d["upcomingDebtPayments"]) == 2 and len(d["recentTransactions"]) == 10
        assert d["budget"]["lines"] and d["summary"]["incomeFils"] == 3_850_000
        assert (await client.get("/api/v1/goals")).json()["total"] == 1
        assert (await client.get("/api/v1/plan/payoff")).json()["feasible"] is True
        assert (await client.get("/api/v1/insights/forecast")).json()["confidence"] == "high"
        with pytest.raises(SystemExit):
            await mod.seed(TODAY, "x" * 12)
        assert (await mod.seed(TODAY, "demo-password-456", reset=True))["transactions"] == result["transactions"]
    finally:
        app.dependency_overrides.pop(get_today, None)
