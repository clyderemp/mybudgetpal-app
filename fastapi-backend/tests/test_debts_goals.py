from __future__ import annotations

import pytest

from tests.conftest import make_account, register


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


async def test_linked_debt_payment_is_transfer(owner):
    c = owner
    bank = await make_account(c, "ENBD", 500_000)
    card = await make_account(c, "Visa card", -300_000, type="credit_card")
    groceries = (await c.get("/api/v1/categories")).json()["items"]
    groceries = next(x for x in groceries if x["name"] == "Groceries")
    # card purchase is already an expense on the card account
    r = await c.post("/api/v1/transactions", json={
        "accountId": card["id"], "date": "2026-11-02", "amountFils": 50_000, "type": "expense",
        "categoryId": groceries["id"]})
    assert r.status_code == 201, r.text
    r = await c.post("/api/v1/debts", json={
        "name": "Visa", "kind": "credit_card", "balanceFils": 350_000, "aprBps": 2999,
        "minPaymentFils": 15_000, "dueDay": 15, "accountId": card["id"]})
    assert r.status_code == 201, r.text
    debt = r.json()
    assert debt["linkedAccountBalanceFils"] == -350_000

    r = await c.post(f"/api/v1/debts/{debt['id']}/payments",
                     json={"amountFils": 100_000, "date": "2026-11-05", "accountId": bank["id"]})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["debt"]["balanceFils"] == 250_000
    assert body["debt"]["linkedAccountBalanceFils"] == -250_000
    txn = body["transaction"]
    assert txn["type"] == "transfer" and txn["categoryId"] is None
    assert txn["accountId"] == bank["id"] and txn["toAccountId"] == card["id"] and txn["amountFils"] == 100_000
    assert (await c.get(f"/api/v1/accounts/{bank['id']}")).json()["balanceFils"] == 400_000
    assert (await c.get(f"/api/v1/accounts/{card['id']}")).json()["balanceFils"] == -250_000
    # spending not double-counted: the month's expenses are only the card purchase
    s = (await c.get("/api/v1/insights/summary", params={"month": "2026-11"})).json()
    assert s["expenseFils"] == 50_000

    listed = (await c.get("/api/v1/debts")).json()["items"]
    assert listed[0]["linkedAccountBalanceFils"] == -250_000
    assert (await c.get(f"/api/v1/debts/{debt['id']}")).json()["linkedAccountBalanceFils"] == -250_000

    # paying from the linked account itself is rejected; nothing changes
    r = await c.post(f"/api/v1/debts/{debt['id']}/payments",
                     json={"amountFils": 1_000, "date": "2026-11-06", "accountId": card["id"]})
    assert r.status_code == 422
    assert "accountId" in r.json()["error"]["fields"]
    assert (await c.get(f"/api/v1/debts/{debt['id']}")).json()["balanceFils"] == 250_000
    assert (await c.get("/api/v1/transactions")).json()["total"] == 2


async def test_debt_linked_to_bank_account_pays_as_expense(owner):
    # Linking a loan to the bank account it is paid from must not turn payments into transfers.
    c = owner
    bank = await make_account(c, "ENBD", 500_000)
    r = await c.post("/api/v1/debts", json={
        "name": "Car", "kind": "car_loan", "balanceFils": 1_000_000, "aprBps": 449,
        "minPaymentFils": 185_000, "dueDay": 5, "accountId": bank["id"]})
    assert r.status_code == 201, r.text
    debt = r.json()
    r = await c.post(f"/api/v1/debts/{debt['id']}/payments",
                     json={"amountFils": 185_000, "date": "2026-11-05", "accountId": bank["id"]})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["transaction"]["type"] == "expense" and body["transaction"]["categoryId"]
    assert body["debt"]["balanceFils"] == 815_000
    assert (await c.get(f"/api/v1/accounts/{bank['id']}")).json()["balanceFils"] == 315_000


async def test_unlinked_debt_has_null_linked_balance(owner):
    c = owner
    r = await c.post("/api/v1/debts", json={
        "name": "Car", "kind": "car_loan", "balanceFils": 1_000_000, "aprBps": 500,
        "minPaymentFils": 20_000, "dueDay": 5})
    assert r.json()["linkedAccountBalanceFils"] is None
    assert (await c.get("/api/v1/debts")).json()["items"][0]["linkedAccountBalanceFils"] is None


@pytest.mark.parametrize("settings_overrides", [{"allow_registration": True}])
async def test_debt_payment_account_isolation(new_client):
    async with new_client() as a, new_client() as b:
        await register(a, "a@example.com", "A home")
        await register(b, "b@example.com", "B home")
        a_bank = await make_account(a, "A bank", 100_000)
        b_bank = await make_account(b, "B bank", 100_000)
        b_card = await make_account(b, "B card", 0, type="credit_card")
        linked = (await b.post("/api/v1/debts", json={
            "name": "Card", "kind": "credit_card", "balanceFils": 50_000, "aprBps": 0,
            "minPaymentFils": 1_000, "dueDay": 1, "accountId": b_card["id"]})).json()
        loan = (await b.post("/api/v1/debts", json={
            "name": "Loan", "kind": "personal_loan", "balanceFils": 50_000, "aprBps": 0,
            "minPaymentFils": 1_000, "dueDay": 1})).json()
        for debt in (linked, loan):
            r = await b.post(f"/api/v1/debts/{debt['id']}/payments",
                             json={"amountFils": 5_000, "date": "2026-11-05", "accountId": a_bank["id"]})
            assert r.status_code == 422, r.text
            assert "accountId" in r.json()["error"]["fields"]
            assert (await b.get(f"/api/v1/debts/{debt['id']}")).json()["balanceFils"] == 50_000
        # A cannot pay B's debt at all
        r = await a.post(f"/api/v1/debts/{linked['id']}/payments",
                         json={"amountFils": 5_000, "date": "2026-11-05", "accountId": a_bank["id"]})
        assert r.status_code == 404
        # A cannot link its debt to B's account
        r = await a.post("/api/v1/debts", json={
            "name": "X", "kind": "credit_card", "balanceFils": 1, "aprBps": 0,
            "minPaymentFils": 0, "dueDay": 1, "accountId": b_card["id"]})
        assert r.status_code == 422
        assert (await a.get(f"/api/v1/accounts/{a_bank['id']}")).json()["balanceFils"] == 100_000
        assert (await b.get(f"/api/v1/accounts/{b_bank['id']}")).json()["balanceFils"] == 100_000
        assert (await b.get("/api/v1/transactions")).json()["total"] == 0
