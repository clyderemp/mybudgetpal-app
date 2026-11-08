from __future__ import annotations

from tests.conftest import first_category, make_account


async def test_budget_spent_maths(owner):
    c = owner
    bank = await make_account(c)
    salary = await first_category(c, "Salary")
    groceries = await first_category(c, "Groceries")
    dining = await first_category(c, "Dining")
    fuel = await first_category(c, "Fuel")

    async def txn(date, amount, cat, type_="expense"):
        r = await c.post("/api/v1/transactions", json={
            "accountId": bank["id"], "date": date, "amountFils": amount, "type": type_, "categoryId": cat["id"]})
        assert r.status_code == 201, r.text
        return r.json()

    await txn("2026-11-01", 2_000_000, salary, "income")
    await txn("2026-11-02", 30_000, groceries)
    await txn("2026-11-30", 20_000, groceries)
    await txn("2026-11-15", 90_000, dining)
    await txn("2026-11-20", 7_500, fuel)          # unbudgeted
    await txn("2026-10-31", 99_999, groceries)    # previous month
    await txn("2026-12-01", 99_999, groceries)    # next month
    deleted = await txn("2026-11-10", 5_000, groceries)
    await c.delete(f"/api/v1/transactions/{deleted['id']}")

    empty = (await c.get("/api/v1/budgets/2026-11")).json()
    assert empty["lines"] == [] and empty["totalLimitFils"] == 0
    assert empty["totalSpentFils"] == 147_500 and empty["unbudgetedSpentFils"] == 147_500

    r = await c.put("/api/v1/budgets/2026-11", json={"lines": [
        {"categoryId": groceries["id"], "limitFils": 100_000},
        {"categoryId": dining["id"], "limitFils": 50_000},
    ], "note": "Nov"})
    assert r.status_code == 200, r.text
    b = r.json()
    lines = {ln["categoryName"]: ln for ln in b["lines"]}
    assert lines["Groceries"] == {"categoryId": groceries["id"], "categoryName": "Groceries", "group": "essentials",
                                  "limitFils": 100_000, "spentFils": 50_000, "remainingFils": 50_000}
    assert lines["Dining"]["spentFils"] == 90_000 and lines["Dining"]["remainingFils"] == -40_000
    assert b["totalLimitFils"] == 150_000
    assert b["totalSpentFils"] == 147_500
    assert b["unbudgetedSpentFils"] == 7_500
    assert b["incomeFils"] == 2_000_000
    assert b["note"] == "Nov"
    assert (await c.get("/api/v1/budgets/2026-11")).json() == b

    # validation
    assert (await c.get("/api/v1/budgets/2026-13")).status_code == 422
    r = await c.put("/api/v1/budgets/2026-11", json={"lines": [{"categoryId": salary["id"], "limitFils": 1}]})
    assert r.status_code == 422
    r = await c.put("/api/v1/budgets/2026-11", json={"lines": [{"categoryId": dining["id"], "limitFils": -1}]})
    assert r.status_code == 422

    # copy-from
    r = await c.post("/api/v1/budgets/2026-12/copy-from/2026-11")
    assert r.status_code == 200
    dec = r.json()
    assert dec["month"] == "2026-12" and dec["totalLimitFils"] == 150_000
    assert {ln["categoryName"]: ln["spentFils"] for ln in dec["lines"]} == {"Groceries": 99_999, "Dining": 0}
    assert (await c.post("/api/v1/budgets/2027-01/copy-from/2025-01")).status_code == 404
