from __future__ import annotations

from tests.conftest import first_category, make_account


async def _txn(c, **kw):
    r = await c.post("/api/v1/transactions", json=kw)
    assert r.status_code == 201, r.text
    return r.json()


async def test_crud_balances_and_filters(owner):
    c = owner
    bank = await make_account(c, "Mashreq Neo", 100_000, institution="Mashreq Neo")
    cash = await make_account(c, "Cash", 0)
    salary = await first_category(c, "Salary")
    groceries = await first_category(c, "Groceries")
    dining = await first_category(c, "Dining")

    t1 = await _txn(c, accountId=bank["id"], date="2026-10-01", amountFils=1_000_000, type="income",
                    categoryId=salary["id"], merchant="Employer")
    t2 = await _txn(c, accountId=bank["id"], date="2026-10-05", amountFils=25_050, type="expense",
                    categoryId=groceries["id"], merchant="Carrefour", note="weekly shop")
    t3 = await _txn(c, accountId=bank["id"], date="2026-11-02", amountFils=12_000, type="expense",
                    categoryId=dining["id"], merchant="Shake Shack")
    t4 = await _txn(c, accountId=bank["id"], toAccountId=cash["id"], date="2026-11-03",
                    amountFils=50_000, type="transfer", categoryId=groceries["id"])
    assert t4["categoryId"] is None
    assert t1["createdByName"] == "Clyde" and t1["source"] == "manual"

    accounts = {a["name"]: a for a in (await c.get("/api/v1/accounts")).json()["items"]}
    assert accounts["Mashreq Neo"]["balanceFils"] == 100_000 + 1_000_000 - 25_050 - 12_000 - 50_000
    assert accounts["Cash"]["balanceFils"] == 50_000

    lst = (await c.get("/api/v1/transactions")).json()
    assert lst["total"] == 4
    assert [t["id"] for t in lst["items"]] == [t4["id"], t3["id"], t2["id"], t1["id"]]
    assert all(t["createdByName"] == "Clyde" for t in lst["items"])

    def ids(params):
        return c.get("/api/v1/transactions", params=params)

    r = (await ids({"from": "2026-11-01", "to": "2026-11-30"})).json()
    assert {t["id"] for t in r["items"]} == {t3["id"], t4["id"]}
    r = (await ids({"type": "expense", "sort": "amount"})).json()
    assert [t["id"] for t in r["items"]] == [t3["id"], t2["id"]]
    r = (await ids({"categoryId": groceries["id"]})).json()
    assert [t["id"] for t in r["items"]] == [t2["id"]]
    r = (await ids({"accountId": cash["id"]})).json()
    assert [t["id"] for t in r["items"]] == [t4["id"]]
    r = (await ids({"q": "carre"})).json()
    assert [t["id"] for t in r["items"]] == [t2["id"]]
    r = (await ids({"q": "WEEKLY"})).json()
    assert r["total"] == 1
    r = (await ids({"q": ".*"})).json()
    assert r["total"] == 0  # regex is escaped
    r = (await ids({"page": 2, "pageSize": 3, "sort": "-amount"})).json()
    assert r["total"] == 4 and [t["id"] for t in r["items"]] == [t3["id"]]
    assert (await ids({"sort": "bogus"})).status_code == 422
    assert (await ids({"accountId": "zzz"})).status_code == 422

    # patch
    r = await c.patch(f"/api/v1/transactions/{t2['id']}", json={"amountFils": 30_000, "note": None})
    assert r.status_code == 200 and r.json()["amountFils"] == 30_000 and r.json()["note"] is None
    r = await c.patch(f"/api/v1/transactions/{t2['id']}", json={"amountFils": 0})
    assert r.status_code == 422
    r = await c.patch(f"/api/v1/transactions/{t2['id']}", json={"categoryId": salary["id"]})
    assert r.status_code == 422 and "categoryId" in r.json()["error"]["fields"]
    r = await c.patch(f"/api/v1/transactions/{t2['id']}", json={"type": "transfer"})
    assert r.status_code == 422  # transfer needs toAccountId
    r = await c.patch(f"/api/v1/transactions/{t2['id']}", json={"bogus": 1})
    assert r.status_code == 422

    # soft delete
    assert (await c.delete(f"/api/v1/transactions/{t3['id']}")).status_code == 204
    assert (await c.delete(f"/api/v1/transactions/{t3['id']}")).status_code == 404
    assert (await c.get(f"/api/v1/transactions/{t3['id']}")).status_code == 404
    assert (await c.get("/api/v1/transactions")).json()["total"] == 3
    bank_now = (await c.get(f"/api/v1/accounts/{bank['id']}")).json()
    assert bank_now["balanceFils"] == 100_000 + 1_000_000 - 30_000 - 50_000


async def test_create_validation(owner):
    c = owner
    bank = await make_account(c)
    groceries = await first_category(c, "Groceries")
    base = {"accountId": bank["id"], "date": "2026-11-01", "type": "expense", "categoryId": groceries["id"]}
    for bad in (
        {**base, "amountFils": 0},
        {**base, "amountFils": -5},
        {**base, "amountFils": 10.5},
        {**base, "amountFils": 10, "categoryId": None},
        {**base, "amountFils": 10, "type": "transfer"},
        {**base, "amountFils": 10, "type": "transfer", "toAccountId": bank["id"]},
        {**base, "amountFils": 10, "extra": True},
        {**base, "amountFils": 10, "date": "2026-13-01"},
    ):
        r = await c.post("/api/v1/transactions", json=bad)
        assert r.status_code == 422, (bad, r.text)
        assert r.json()["error"]["code"] == "validation_error"
