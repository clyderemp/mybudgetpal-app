from __future__ import annotations

import pytest

from tests.conftest import first_category, make_account, register


@pytest.mark.parametrize("settings_overrides", [{"allow_registration": True}])
async def test_cross_household_isolation(new_client):
    async with new_client() as a, new_client() as b:
        await register(a, "a@example.com", "A home")
        await register(b, "b@example.com", "B home")
        acc = await make_account(a, "A bank", 1000)
        groceries = await first_category(a, "Groceries")
        txn = (
            await a.post(
                "/api/v1/transactions",
                json={"accountId": acc["id"], "date": "2026-11-01", "amountFils": 500,
                      "type": "expense", "categoryId": groceries["id"]},
            )
        ).json()

        assert (await b.get(f"/api/v1/accounts/{acc['id']}")).status_code == 404
        assert (await b.patch(f"/api/v1/accounts/{acc['id']}", json={"name": "pwn"})).status_code == 404
        assert (await b.post(f"/api/v1/accounts/{acc['id']}/archive")).status_code == 404
        assert (await b.get(f"/api/v1/transactions/{txn['id']}")).status_code == 404
        assert (await b.patch(f"/api/v1/transactions/{txn['id']}", json={"amountFils": 1})).status_code == 404
        assert (await b.delete(f"/api/v1/transactions/{txn['id']}")).status_code == 404
        assert (await b.patch(f"/api/v1/categories/{groceries['id']}", json={"name": "x"})).status_code == 404

        assert (await b.get("/api/v1/accounts")).json()["total"] == 0
        assert (await b.get("/api/v1/transactions")).json()["total"] == 0
        assert (await b.get("/api/v1/transactions", params={"accountId": acc["id"]})).json()["total"] == 0

        # B cannot reference A's account/category in its own transaction
        b_acc = await make_account(b, "B bank")
        r = await b.post(
            "/api/v1/transactions",
            json={"accountId": acc["id"], "date": "2026-11-01", "amountFils": 5,
                  "type": "expense", "categoryId": groceries["id"]},
        )
        assert r.status_code == 422
        assert set(r.json()["error"]["fields"]) == {"accountId", "categoryId"}
        r = await b.post(
            "/api/v1/transactions",
            json={"accountId": b_acc["id"], "toAccountId": acc["id"], "date": "2026-11-01",
                  "amountFils": 5, "type": "transfer"},
        )
        assert r.status_code == 422

        # A's data untouched
        a_acc = (await a.get(f"/api/v1/accounts/{acc['id']}")).json()
        assert a_acc["name"] == "A bank" and a_acc["balanceFils"] == 500


async def test_invalid_id_is_404(owner):
    assert (await owner.get("/api/v1/accounts/not-an-id")).status_code == 404
