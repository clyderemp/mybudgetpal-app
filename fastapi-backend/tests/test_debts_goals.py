from __future__ import annotations

from tests.conftest import make_account


async def test_debt_payment(owner):
    c = owner
    bank = await make_account(c, "ENBD", 500_000)
    r = await c.post("/api/v1/debts", json={
        "name": "Visa", "kind": "credit_card", "balanceFils": 300_000, "aprBps": 2999,
        "minPaymentFils": 15_000, "dueDay": 15})
    assert r.status_code == 201, r.text
    debt = r.json()
    assert (await c.post("/api/v1/debts", json={**{k: debt[k] for k in ("name", "kind", "balanceFils", "aprBps", "minPaymentFils")}, "dueDay": 30})).status_code == 422

    r = await c.post(f"/api/v1/debts/{debt['id']}/payments",
                     json={"amountFils": 100_000, "date": "2026-11-05", "accountId": bank["id"]})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["debt"]["balanceFils"] == 200_000
    txn = body["transaction"]
    assert txn["type"] == "expense" and txn["amountFils"] == 100_000 and txn["accountId"] == bank["id"]
    cats = {x["id"]: x["name"] for x in (await c.get("/api/v1/categories")).json()["items"]}
    assert cats[txn["categoryId"]] == "Debt payment"
    assert (await c.get(f"/api/v1/accounts/{bank['id']}")).json()["balanceFils"] == 400_000
    assert (await c.get("/api/v1/transactions")).json()["total"] == 1

    # overpay floors at zero
    r = await c.post(f"/api/v1/debts/{debt['id']}/payments",
                     json={"amountFils": 999_999, "date": "2026-11-06", "accountId": bank["id"]})
    assert r.json()["debt"]["balanceFils"] == 0
    # bad account
    r = await c.post(f"/api/v1/debts/{debt['id']}/payments",
                     json={"amountFils": 1, "date": "2026-11-06", "accountId": "0" * 24})
    assert r.status_code == 422

    r = await c.patch(f"/api/v1/debts/{debt['id']}", json={"aprBps": 1999})
    assert r.json()["aprBps"] == 1999
    assert (await c.post(f"/api/v1/debts/{debt['id']}/archive")).json()["archived"] is True
    assert (await c.get("/api/v1/debts")).json()["total"] == 0
    assert (await c.get("/api/v1/debts", params={"includeArchived": "true"})).json()["total"] == 1


async def test_goals(owner):
    c = owner
    r = await c.post("/api/v1/goals", json={"name": "Emergency fund", "targetFils": 3_000_000, "priority": 1})
    assert r.status_code == 201, r.text
    g = r.json()
    assert g["savedFils"] == 0
    r = await c.post(f"/api/v1/goals/{g['id']}/contributions", json={"amountFils": 250_000})
    assert r.json()["savedFils"] == 250_000
    r = await c.post(f"/api/v1/goals/{g['id']}/contributions", json={"amountFils": -300_000})
    assert r.json()["savedFils"] == 0
    assert (await c.post(f"/api/v1/goals/{g['id']}/contributions", json={"amountFils": 0})).status_code == 422
    r = await c.patch(f"/api/v1/goals/{g['id']}", json={"targetDate": "2027-06-30"})
    assert r.json()["targetDate"] == "2027-06-30"
    assert (await c.post(f"/api/v1/goals/{g['id']}/archive")).json()["archived"] is True
    assert (await c.get("/api/v1/goals")).json()["total"] == 0


async def test_accounts_and_categories_crud(owner):
    c = owner
    acc = await make_account(c, "Neo", 1000, institution="Mashreq Neo", last4="1234")
    assert acc["balanceFils"] == 1000 and acc["currency"] == "AED"
    r = await c.patch(f"/api/v1/accounts/{acc['id']}", json={"name": "Neo Main", "openingBalanceFils": 2000})
    assert r.json()["name"] == "Neo Main" and r.json()["balanceFils"] == 2000
    assert (await c.post("/api/v1/accounts", json={"name": "X", "type": "bank", "last4": "12"})).status_code == 422
    assert (await c.post(f"/api/v1/accounts/{acc['id']}/archive")).json()["archived"] is True
    assert (await c.get("/api/v1/accounts")).json()["total"] == 0

    r = await c.post("/api/v1/categories", json={"name": "Pets", "kind": "expense", "group": "lifestyle", "icon": "dog"})
    assert r.status_code == 201
    cat = r.json()
    assert (await c.patch(f"/api/v1/categories/{cat['id']}", json={"name": "Pet care"})).json()["name"] == "Pet care"
    assert (await c.post(f"/api/v1/categories/{cat['id']}/archive")).json()["archived"] is True
    names = {x["name"] for x in (await c.get("/api/v1/categories")).json()["items"]}
    assert "Pet care" not in names


async def test_household_patch(owner):
    r = await owner.patch("/api/v1/household", json={"name": "Remp Family"})
    assert r.status_code == 200 and r.json()["name"] == "Remp Family"
