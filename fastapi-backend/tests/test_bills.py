"""Bills and expected income endpoints (synthetic data)."""

from __future__ import annotations

import datetime as dt

import pytest

from app.services.insights import get_today
from tests.conftest import first_category, make_account, register

TODAY = dt.date(2026, 11, 10)


async def _txn(c, acc, date, amount, type_, cat, merchant):
    r = await c.post(
        "/api/v1/transactions",
        json={"accountId": acc, "date": date, "amountFils": amount, "type": type_, "categoryId": cat, "merchant": merchant},
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
async def home(app, owner):
    app.dependency_overrides[get_today] = lambda: TODAY
    c = owner
    bank = (await make_account(c, "Mashreq NEO", 1_000_000))["id"]
    biz = (await make_account(c, "Sessions DXB", 5_000_000, purpose="business"))["id"]
    cats = {n: (await first_category(c, n))["id"] for n in ("Salary", "Subscriptions", "Utilities", "Groceries")}
    for m in ("06", "07", "08", "09", "10"):
        await _txn(c, bank, f"2026-{m}-03", 2_474, "expense", cats["Subscriptions"], "SPOTIFY P1A2B3")
    yield {"c": c, "bank": bank, "biz": biz, "cats": cats}
    app.dependency_overrides.pop(get_today, None)


def _spotify(h, **kw):
    return {"name": "Spotify", "kind": "subscription", "amountFils": 2_474, "dueDayFrom": 3, "accountId": h["bank"],
            "categoryId": h["cats"]["Subscriptions"], "matchText": ["spotify"], "startMonth": "2026-01", **kw}


async def test_bill_crud_and_validation(home):
    c = home["c"]
    r = await c.post("/api/v1/bills", json=_spotify(home))
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["dueDayTo"] == 3 and b["monthlyFils"] == 2_474 and b["completed"] is False and b["purpose"] == "household"

    r = await c.patch(f"/api/v1/bills/{b['id']}", json={"amountFils": 2_699, "dueDayTo": 5})
    assert r.status_code == 200 and r.json()["amountFils"] == 2_699 and r.json()["dueDayTo"] == 5
    # Cross-field rules are re-checked on patch.
    r = await c.patch(f"/api/v1/bills/{b['id']}", json={"dueDayFrom": 20})
    assert r.status_code == 422
    r = await c.patch(f"/api/v1/bills/{b['id']}", json={"active": False})
    assert r.json()["active"] is False

    bad = await c.post("/api/v1/bills", json=_spotify(home, dueDayFrom=10, dueDayTo=2))
    assert bad.status_code == 422
    bad = await c.post("/api/v1/bills", json=_spotify(home, accountId="0" * 24))
    assert bad.status_code == 422 and "accountId" in bad.json()["error"]["fields"]
    bad = await c.post("/api/v1/bills", json=_spotify(home, householdId="0" * 24))
    assert bad.status_code == 422  # unknown fields rejected

    car = await c.post("/api/v1/bills", json={
        "name": "Zero Max", "kind": "loan", "amountFils": 335_000, "dueDayFrom": 1, "dueDayTo": 5,
        "startMonth": "2026-11", "instalmentsTotal": 48, "instalmentsPaid": 20})
    assert car.json()["lastMonth"] == "2029-02" and car.json()["remainingFils"] == 28 * 335_000

    yearly = await c.post("/api/v1/bills", json={"name": "Insurance", "amountFils": 240_000, "cadence": "yearly",
                                                  "dueDayFrom": 20, "startMonth": "2026-03"})
    assert yearly.json()["monthlyFils"] == 20_000

    r = await c.post(f"/api/v1/bills/{b['id']}/archive")
    assert r.json()["archived"] is True
    names = [x["name"] for x in (await c.get("/api/v1/bills")).json()["items"]]
    assert names == ["Zero Max", "Insurance"]
    assert (await c.get("/api/v1/bills", params={"includeArchived": True})).json()["total"] == 3


async def test_month_report_links_and_skip(home):
    c, bank, cats = home["c"], home["bank"], home["cats"]
    spotify = (await c.post("/api/v1/bills", json=_spotify(home))).json()
    dewa = (await c.post("/api/v1/bills", json={
        "name": "DEWA", "amountFils": 60_000, "amountMode": "estimate", "dueDayFrom": 15, "dueDayTo": 20,
        "matchText": ["dewa"], "amountTolerancePct": 25, "startMonth": "2026-01"})).json()
    nov = await _txn(c, bank, "2026-11-03", 2_474, "expense", cats["Subscriptions"], "SPOTIFY P1A2B3")

    r = await c.get("/api/v1/bills/month/2026-11")
    assert r.status_code == 200, r.text
    rep = r.json()
    by = {i["name"]: i for i in rep["items"]}
    assert by["Spotify"]["status"] == "paid" and by["Spotify"]["matches"][0]["transactionId"] == nov["id"]
    assert by["DEWA"]["status"] == "upcoming"
    assert rep["today"] == "2026-11-10"

    # The confident match is now stored on the transaction.
    t = (await c.get(f"/api/v1/transactions/{nov['id']}")).json()
    assert t["billId"] == spotify["id"]

    # Unlink: cleared and never re-matched by rules.
    r = await c.delete(f"/api/v1/bills/{spotify['id']}/links/{nov['id']}")
    assert r.status_code == 204
    assert (await c.get(f"/api/v1/transactions/{nov['id']}")).json()["billId"] is None
    by = {i["name"]: i for i in (await c.get("/api/v1/bills/month/2026-11")).json()["items"]}
    assert by["Spotify"]["status"] == "overdue"

    # Link by hand (a DEWA bill paid with an odd description).
    odd = await _txn(c, bank, "2026-11-16", 71_000, "expense", cats["Utilities"], "Bill payment 123")
    r = await c.post(f"/api/v1/bills/{dewa['id']}/links", json={"transactionId": odd["id"]})
    assert r.status_code == 200 and r.json()["billId"] == dewa["id"]
    by = {i["name"]: i for i in (await c.get("/api/v1/bills/month/2026-11")).json()["items"]}
    assert by["DEWA"]["status"] == "paid" and by["DEWA"]["matches"][0]["confidence"] == "linked"

    # Skip this month, then undo.
    r = await c.post(f"/api/v1/bills/{spotify['id']}/skip", json={"month": "2026-11"})
    assert r.json()["skippedMonths"] == ["2026-11"]
    by = {i["name"]: i for i in (await c.get("/api/v1/bills/month/2026-11")).json()["items"]}
    assert by["Spotify"]["status"] == "skipped"
    r = await c.post(f"/api/v1/bills/{spotify['id']}/skip", json={"month": "2026-11", "skipped": False})
    assert r.json()["skippedMonths"] == []

    assert (await c.get("/api/v1/bills/month/2026-13")).status_code == 422
    bad = await c.post(f"/api/v1/bills/{dewa['id']}/links", json={"transactionId": "0" * 24})
    assert bad.status_code == 422


async def test_income_streams_and_overview(home):
    c, bank, cats = home["c"], home["bank"], home["cats"]
    me = (await c.get("/api/v1/auth/me")).json()["user"]
    r = await c.post("/api/v1/income-streams", json={
        "name": "Clyde salary", "memberId": me["id"], "accountId": bank,
        "parts": [{"label": "Salary", "kind": "salary", "amountFils": 1_750_000, "dayFrom": 4, "dayTo": 7,
                   "matchText": ["salary", "salvone"]}]})
    assert r.status_code == 201, r.text
    clyde = r.json()
    assert clyde["monthlyFils"] == 1_750_000 and len(clyde["parts"][0]["id"]) == 8
    r = await c.post("/api/v1/income-streams", json={
        "name": "Trish salary", "accountId": bank,
        "parts": [
            {"label": "Advance", "kind": "cash_deposit", "amountFils": 250_000, "amountMinFils": 200_000,
             "amountMaxFils": 300_000, "dayFrom": 5, "dayTo": 10, "matchText": ["cash deposit"]},
            {"label": "Remainder", "kind": "cash_deposit", "amountFils": 300_000, "dayFrom": 20, "dayTo": 28,
             "matchText": ["cash deposit"]},
        ]})
    assert r.status_code == 201, r.text
    bad = await c.post("/api/v1/income-streams", json={"name": "X", "parts": [
        {"label": "P", "amountFils": 100, "amountMinFils": 200, "dayFrom": 1}]})
    assert bad.status_code == 422

    await c.post("/api/v1/bills", json=_spotify(home))
    await c.post("/api/v1/bills", json={"name": "Studio rent", "amountFils": 900_000, "dueDayFrom": 12,
                                        "startMonth": "2026-01", "purpose": "business"})
    await c.post("/api/v1/bills", json={"name": "Zero Max", "kind": "loan", "amountFils": 335_000, "dueDayFrom": 1,
                                        "dueDayTo": 5, "startMonth": "2026-01", "matchText": ["zero max"]})
    await _txn(c, bank, "2026-11-05", 1_750_000, "income", cats["Salary"], "SALVONE SALARY")
    await _txn(c, bank, "2026-11-08", 220_000, "income", cats["Salary"], "CASH DEPOSIT")

    r = await c.get("/api/v1/bills/overview")
    assert r.status_code == 200, r.text
    ov = r.json()
    assert [(w["streamName"], w["label"]) for w in ov["waitingFor"]] == [("Trish salary", "Remainder")]
    safe = ov["safeToSpend"]
    # Cash: Mashreq only (business account excluded): 10,000 + 17,500 + 2,200 - 5 x 24.74 Spotify history.
    cash = 1_000_000 + 1_750_000 + 220_000 - 5 * 2_474
    assert safe["cashFils"] == cash and [a["name"] for a in safe["accounts"]] == ["Mashreq NEO"]
    assert safe["until"] == "2026-12-04"
    # Due before Dec 4: Spotify (Nov 3, unpaid -> overdue), Zero Max Nov (1-5, unpaid) and Dec 1, Spotify Dec 3.
    assert safe["billsDueFils"] == 2_474 * 2 + 335_000 * 2
    assert safe["incomeExpectedFils"] == 300_000
    assert safe["safeToSpendFils"] == cash - (2_474 * 2 + 335_000 * 2) + 300_000
    assert "Studio rent" not in {b["name"] for b in ov["upcomingBills"]}
    assert ov["hasBills"] and ov["hasIncome"]

    # Patch parts (ids kept when sent back), then archive.
    parts = clyde["parts"]
    parts[0]["amountFils"] = 1_800_000
    r = await c.patch(f"/api/v1/income-streams/{clyde['id']}", json={"parts": parts})
    assert r.status_code == 200 and r.json()["parts"][0]["id"] == clyde["parts"][0]["id"]
    assert r.json()["monthlyFils"] == 1_800_000
    r = await c.post(f"/api/v1/income-streams/{clyde['id']}/archive")
    assert r.json()["archived"] is True
    assert [s["name"] for s in (await c.get("/api/v1/income-streams")).json()["items"]] == ["Trish salary"]


async def test_budget_carries_zero_based_plan(home):
    c, cats = home["c"], home["cats"]
    await c.post("/api/v1/income-streams", json={"name": "Salary", "parts": [
        {"label": "Salary", "amountFils": 2_000_000, "dayFrom": 4, "dayTo": 7}]})
    await c.post("/api/v1/bills", json=_spotify(home))
    await c.post("/api/v1/bills", json={"name": "Insurance", "amountFils": 240_000, "cadence": "yearly",
                                        "dueDayFrom": 20, "startMonth": "2026-03"})
    await c.post("/api/v1/goals", json={"name": "Pay back savings", "targetFils": 1_000_000, "priority": 1})
    r = await c.put("/api/v1/budgets/2026-11", json={"lines": [
        {"categoryId": cats["Groceries"], "limitFils": 300_000}, {"categoryId": cats["Subscriptions"], "limitFils": 10_000}]})
    assert r.status_code == 200, r.text
    plan = r.json()["plan"]
    assert plan["expectedIncomeFils"] == 2_000_000
    assert plan["commitmentsFils"] == 2_474 and plan["sinkingFundsFils"] == 20_000
    assert plan["flexibleFils"] == 310_000
    assert plan["leftToAssignFils"] == 2_000_000 - 2_474 - 20_000 - 310_000
    assert plan["overlapCategoryIds"] == [cats["Subscriptions"]]
    assert plan["suggestedGoal"]["name"] == "Pay back savings"
    assert (await c.get("/api/v1/budgets/2026-11")).json()["plan"] == plan
    # The dashboard's budget stays as it was (no plan there).
    assert (await c.get("/api/v1/dashboard")).json()["budget"]["plan"] is None


async def test_suggestions(home):
    c = home["c"]
    r = await c.get("/api/v1/bills/suggestions")
    assert r.status_code == 200
    items = r.json()["items"]
    assert [(s["name"], s["kind"], s["amountFils"], s["accountId"]) for s in items] == [
        ("Spotify P1A2B3", "subscription", 2_474, home["bank"])]
    # Adding the bill removes the suggestion.
    await c.post("/api/v1/bills", json=_spotify(home))
    assert (await c.get("/api/v1/bills/suggestions")).json()["total"] == 0


@pytest.mark.parametrize("settings_overrides", [{"allow_registration": True}])
async def test_bills_isolation(new_client):
    async with new_client() as a, new_client() as b:
        await register(a, "a@example.com", "A home")
        await register(b, "b@example.com", "B home")
        acc = await make_account(a, "A bank")
        bill = (await a.post("/api/v1/bills", json={"name": "Rent", "amountFils": 100, "dueDayFrom": 1,
                                                    "startMonth": "2026-01", "accountId": acc["id"]})).json()
        stream = (await a.post("/api/v1/income-streams", json={"name": "S", "parts": [
            {"label": "P", "amountFils": 100, "dayFrom": 1}]})).json()
        assert (await b.get(f"/api/v1/bills/{bill['id']}")).status_code == 404
        assert (await b.patch(f"/api/v1/bills/{bill['id']}", json={"name": "x"})).status_code == 404
        assert (await b.post(f"/api/v1/bills/{bill['id']}/archive")).status_code == 404
        assert (await b.patch(f"/api/v1/income-streams/{stream['id']}", json={"name": "x"})).status_code == 404
        assert (await b.get("/api/v1/bills")).json()["total"] == 0
        assert (await b.get("/api/v1/bills/month/2026-11")).json()["items"] == []
        r = await b.post("/api/v1/bills", json={"name": "Rent", "amountFils": 100, "dueDayFrom": 1,
                                                "startMonth": "2026-01", "accountId": acc["id"]})
        assert r.status_code == 422
        b_bill = (await b.post("/api/v1/bills", json={"name": "Mine", "amountFils": 1, "dueDayFrom": 1,
                                                      "startMonth": "2026-01"})).json()
        txn = (await a.post("/api/v1/transactions", json={
            "accountId": acc["id"], "date": "2026-11-01", "amountFils": 100, "type": "expense",
            "categoryId": (await first_category(a, "Rent"))["id"]})).json()
        r = await b.post(f"/api/v1/bills/{b_bill['id']}/links", json={"transactionId": txn["id"]})
        assert r.status_code == 422
