"""Needs-review flow, line-item search and keeping business accounts out of household figures."""

from __future__ import annotations

import datetime as dt

import pytest
from beanie import PydanticObjectId

from app.models import Transaction
from app.services.analytics_data import apply_business_boundary
from app.services.insights import get_today
from tests.conftest import first_category, make_account, register

TODAY = dt.date(2026, 11, 8)
D = dt.date(2026, 11, 2)


# --------------------------------------------------------------------- pure boundary rule


def _t(i: str, type_: str, acc: str, to: str | None = None, cat: str | None = "c", amount: int = 100) -> dict:
    return {"id": i, "date": D, "amount_fils": amount, "type": type_, "category_id": cat,
            "account_id": acc, "to_account_id": to}


BIZ = {"B1": "Sessions DXB", "B2": "Sessions Card"}


def test_boundary_without_business_accounts_is_identity():
    txns = [_t("1", "expense", "H1"), _t("2", "transfer", "H1", "H2", cat=None)]
    assert apply_business_boundary(txns, {}) == txns


def test_boundary_drops_business_income_and_expense():
    txns = [_t("1", "expense", "B1"), _t("2", "income", "B1"), _t("3", "expense", "H1")]
    assert [t["id"] for t in apply_business_boundary(txns, BIZ)] == ["3"]


def test_boundary_business_to_household_is_income():
    (out,) = apply_business_boundary([_t("1", "transfer", "B1", "H1", cat=None, amount=500_000)], BIZ)
    assert out == {
        "id": "1", "date": D, "amount_fils": 500_000, "type": "income", "category_id": "business:B1",
        "account_id": "H1", "to_account_id": None, "merchant": "From Sessions DXB", "business_account_id": "B1",
    }


def test_boundary_household_to_business_is_expense():
    (out,) = apply_business_boundary([_t("1", "transfer", "H1", "B2", cat=None, amount=7_000)], BIZ)
    assert out["type"] == "expense" and out["account_id"] == "H1" and out["to_account_id"] is None
    assert out["category_id"] == "business:B2" and out["merchant"] == "To Sessions Card"
    assert out["business_account_id"] == "B2" and out["amount_fils"] == 7_000


def test_boundary_same_side_transfers_stay_neutral():
    hh = _t("1", "transfer", "H1", "H2", cat=None)
    bb = _t("2", "transfer", "B1", "B2", cat=None)
    assert apply_business_boundary([hh, bb], BIZ) == [hh]


def test_boundary_does_not_mutate_input():
    t = _t("1", "transfer", "B1", "H1", cat=None)
    apply_business_boundary([t], BIZ)
    assert t["type"] == "transfer" and "merchant" not in t


# --------------------------------------------------------------------- review flag + items


async def _post(c, **body) -> dict:
    r = await c.post("/api/v1/transactions", json=body)
    assert r.status_code == 201, r.text
    return r.json()


async def _flag(txn_id: str, reason: str | None) -> None:
    doc = await Transaction.get(PydanticObjectId(txn_id))
    assert doc is not None
    doc.needs_review = True
    doc.review_reason = reason
    await doc.save()


async def test_review_count_flag_and_mark_reviewed(owner):
    c = owner
    acc = (await make_account(c, "Bank"))["id"]
    groceries = (await first_category(c, "Groceries"))["id"]
    dining = (await first_category(c, "Dining"))["id"]
    a = await _post(c, accountId=acc, date="2026-11-01", amountFils=1_000, type="expense", categoryId=groceries,
                    merchant="Card purchase ..1155")
    b = await _post(c, accountId=acc, date="2026-11-02", amountFils=2_000, type="expense", categoryId=groceries)
    assert (await c.get("/api/v1/transactions/review-count")).json() == {"count": 0}

    await _flag(a["id"], "no_name")
    # manual flag from the UI: reason "manual"
    r = await c.patch(f"/api/v1/transactions/{b['id']}", json={"needsReview": True})
    assert r.status_code == 200 and r.json()["needsReview"] is True and r.json()["reviewReason"] == "manual"
    assert (await c.get("/api/v1/transactions/review-count")).json() == {"count": 2}
    listed = (await c.get("/api/v1/transactions", params={"needsReview": "true"})).json()
    assert listed["total"] == 2

    # setting only the category keeps the placeholder-name flag ...
    r = await c.patch(f"/api/v1/transactions/{a['id']}", json={"categoryId": dining})
    assert r.json()["needsReview"] is True and r.json()["reviewReason"] == "no_name"
    # ... typing a real name clears it
    r = await c.patch(f"/api/v1/transactions/{a['id']}", json={"merchant": "Carrefour"})
    assert r.json()["needsReview"] is False and r.json()["reviewReason"] is None
    # "Mark reviewed"
    r = await c.patch(f"/api/v1/transactions/{b['id']}", json={"needsReview": False})
    assert r.json()["needsReview"] is False and r.json()["reviewReason"] is None
    assert (await c.get("/api/v1/transactions/review-count")).json() == {"count": 0}

    # deleted rows don't count
    await _flag(b["id"], "manual")
    assert (await c.delete(f"/api/v1/transactions/{b['id']}")).status_code == 204
    assert (await c.get("/api/v1/transactions/review-count")).json() == {"count": 0}


@pytest.mark.parametrize("settings_overrides", [{"allow_registration": True}])
async def test_review_count_is_household_scoped(new_client):
    async with new_client() as a, new_client() as b, new_client() as anon:
        await register(a, "a@example.com", "A home")
        await register(b, "b@example.com", "B home")
        acc = (await make_account(a, "Bank"))["id"]
        groceries = (await first_category(a, "Groceries"))["id"]
        t = await _post(a, accountId=acc, date="2026-11-01", amountFils=1_000, type="expense", categoryId=groceries)
        await _flag(t["id"], "no_name")
        assert (await a.get("/api/v1/transactions/review-count")).json() == {"count": 1}
        assert (await b.get("/api/v1/transactions/review-count")).json() == {"count": 0}
        assert (await anon.get("/api/v1/transactions/review-count")).status_code == 401


async def test_items_roundtrip_and_search_by_item_name(owner):
    c = owner
    acc = (await make_account(c, "Bank"))["id"]
    groceries = (await first_category(c, "Groceries"))["id"]
    t = await _post(c, accountId=acc, date="2026-11-01", amountFils=3_000, type="expense", categoryId=groceries,
                    merchant="Spinneys", items=[{"name": "Oat milk", "amountFils": 1_250, "quantity": 2},
                                                {"name": "Bread"}])
    assert t["items"] == [{"name": "Oat milk", "amountFils": 1_250, "quantity": 2.0},
                          {"name": "Bread", "amountFils": None, "quantity": None}]
    await _post(c, accountId=acc, date="2026-11-02", amountFils=500, type="expense", categoryId=groceries,
                merchant="Other")
    found = (await c.get("/api/v1/transactions", params={"q": "oat MILK"})).json()
    assert found["total"] == 1 and found["items"][0]["id"] == t["id"]
    # replacing and clearing the list
    r = await c.patch(f"/api/v1/transactions/{t['id']}", json={"items": [{"name": "Eggs", "amountFils": 900}]})
    assert [i["name"] for i in r.json()["items"]] == ["Eggs"]
    r = await c.patch(f"/api/v1/transactions/{t['id']}", json={"items": []})
    assert r.json()["items"] == []
    assert (await c.get("/api/v1/transactions", params={"q": "oat"})).json()["total"] == 0


# --------------------------------------------------------------------- business accounts end to end


@pytest.fixture
async def biz(app, owner):
    """Household bank (opening 10,000) + business bank "Sessions DXB" (opening 50,000).
    Nov: salary 20,000 + groceries 1,000 on household; business sales 30,000 and supplies 4,000
    on business; owner draw business -> household 5,000; household -> business top-up 800;
    household savings transfer 2,000 (neutral)."""
    app.dependency_overrides[get_today] = lambda: TODAY
    c = owner
    hh = (await make_account(c, "Household bank", 1_000_000))["id"]
    sav = (await make_account(c, "Savings", 0, type="savings"))["id"]
    bz = (await make_account(c, "Sessions DXB", 5_000_000, purpose="business"))["id"]
    cat = {n: (await first_category(c, n))["id"] for n in ("Salary", "Other income", "Groceries", "Shopping")}
    await _post(c, accountId=hh, date="2026-11-01", amountFils=2_000_000, type="income", categoryId=cat["Salary"])
    await _post(c, accountId=hh, date="2026-11-03", amountFils=100_000, type="expense", categoryId=cat["Groceries"])
    await _post(c, accountId=bz, date="2026-11-02", amountFils=3_000_000, type="income",
                categoryId=cat["Other income"])
    await _post(c, accountId=bz, date="2026-11-04", amountFils=400_000, type="expense", categoryId=cat["Shopping"])
    await _post(c, accountId=bz, toAccountId=hh, date="2026-11-05", amountFils=500_000, type="transfer")
    await _post(c, accountId=hh, toAccountId=bz, date="2026-11-06", amountFils=80_000, type="transfer")
    await _post(c, accountId=hh, toAccountId=sav, date="2026-11-07", amountFils=200_000, type="transfer")
    yield {"c": c, "hh": hh, "bz": bz, "sav": sav, "cat": cat}
    app.dependency_overrides.pop(get_today, None)


async def test_summary_and_trends_exclude_business(biz):
    c, bz = biz["c"], biz["bz"]
    s = (await c.get("/api/v1/insights/summary")).json()
    assert s["incomeFils"] == 2_000_000 + 500_000  # salary + owner draw
    assert s["expenseFils"] == 100_000 + 80_000  # groceries + top-up to the business
    by = {x["categoryId"]: x["expenseFils"] for x in s["byCategory"]}
    assert by[f"business:{bz}"] == 80_000

    every = (await c.get("/api/v1/insights/summary", params={"includeBusiness": "true"})).json()
    assert every["incomeFils"] == 2_000_000 + 3_000_000
    assert every["expenseFils"] == 100_000 + 400_000

    t = (await c.get("/api/v1/insights/trends", params={"months": 1})).json()["items"][0]
    assert (t["incomeFils"], t["expenseFils"]) == (2_500_000, 180_000)


async def test_budget_and_dashboard_exclude_business(biz):
    c = biz["c"]
    b = (await c.get("/api/v1/budgets/2026-11")).json()
    assert b["incomeFils"] == 2_500_000 and b["totalSpentFils"] == 180_000
    d = (await c.get("/api/v1/dashboard")).json()
    assert d["summary"]["incomeFils"] == 2_500_000 and d["summary"]["expenseFils"] == 180_000
    # accounts are still listed (UI groups them), each with its purpose
    purposes = {a["name"]: a["purpose"] for a in d["accounts"]}
    assert purposes["Sessions DXB"] == "business" and purposes["Household bank"] == "household"


async def test_health_liquid_excludes_business_balance(biz):
    c = biz["c"]
    h = (await c.get("/api/v1/insights/health")).json()
    h_all = (await c.get("/api/v1/insights/health", params={"includeBusiness": "true"})).json()
    # household-only liquid: 10,000 + 20,000 - 1,000 + 5,000 - 800 (bank, incl. savings transfer net 0)
    # monthly expense in household view is projected from 1,800 over 8 days; with business included,
    # the 55,000+ business balance makes the emergency fund much larger.
    assert h_all["emergencyFundMonths"] > h["emergencyFundMonths"]


async def test_explore_labels_and_account_filter(biz):
    c, bz, hh = biz["c"], biz["bz"], biz["hh"]
    params = {"from": "2026-11-01", "to": "2026-11-30", "groupBy": "category"}
    inc = (await c.get("/api/v1/insights/explore", params={**params, "flow": "income"})).json()
    labels = {g["label"]: g["fils"] for g in inc["breakdown"]}
    assert labels == {"Salary": 2_000_000, "From Sessions DXB": 500_000}
    exp = (await c.get("/api/v1/insights/explore", params={**params, "flow": "expense"})).json()
    assert {g["label"]: g["fils"] for g in exp["breakdown"]} == {"Groceries": 100_000, "To Sessions DXB": 80_000}
    grp = (await c.get("/api/v1/insights/explore", params={**params, "flow": "expense", "groupBy": "group"})).json()
    assert "Business" in {g["label"] for g in grp["breakdown"]}
    # filtering on the business account shows the household's flows with it
    only = (await c.get("/api/v1/insights/explore", params={**params, "flow": "income", "accounts": bz})).json()
    assert only["totals"]["incomeFils"] == 500_000
    # by account: the owner draw lands on the household account
    acct = (await c.get("/api/v1/insights/explore", params={**params, "flow": "income", "groupBy": "account"})).json()
    assert {g["key"]: g["fils"] for g in acct["breakdown"]} == {hh: 2_500_000}
    # including business: business sales count, the draw is a neutral transfer
    every = (await c.get("/api/v1/insights/explore",
                         params={**params, "flow": "income", "includeBusiness": "true"})).json()
    assert every["totals"]["incomeFils"] == 5_000_000


async def test_plan_and_health_ignore_debts_linked_to_business_accounts(biz):
    c, bz = biz["c"], biz["bz"]
    r = await c.post("/api/v1/debts", json={"name": "Business card", "kind": "credit_card", "balanceFils": 900_000,
                                            "aprBps": 2400, "minPaymentFils": 45_000, "dueDay": 10, "accountId": bz})
    assert r.status_code == 201, r.text
    r = await c.post("/api/v1/debts", json={"name": "Visa", "kind": "credit_card", "balanceFils": 300_000,
                                            "aprBps": 2999, "minPaymentFils": 15_000, "dueDay": 15})
    assert r.status_code == 201
    payoff = (await c.get("/api/v1/plan/payoff")).json()
    assert [p["debtId"] for p in payoff["perDebt"]] == [r.json()["id"]]
    assert (await c.get("/api/v1/plan")).json()["monthlyDebtBudgetFils"] == 15_000
    d = (await c.get("/api/v1/dashboard")).json()
    assert [u["name"] for u in d["upcomingDebtPayments"]] == ["Visa"]
    # the debts list itself still shows both
    assert (await c.get("/api/v1/debts")).json()["total"] == 2


async def test_archived_business_account_history_stays_out(biz):
    c, bz = biz["c"], biz["bz"]
    assert (await c.post(f"/api/v1/accounts/{bz}/archive")).status_code == 200
    s = (await c.get("/api/v1/insights/summary")).json()
    assert (s["incomeFils"], s["expenseFils"]) == (2_500_000, 180_000)


async def test_switching_purpose_back_to_household(biz):
    c, bz = biz["c"], biz["bz"]
    r = await c.patch(f"/api/v1/accounts/{bz}", json={"purpose": "household"})
    assert r.status_code == 200 and r.json()["purpose"] == "household"
    s = (await c.get("/api/v1/insights/summary")).json()
    assert s["incomeFils"] == 2_000_000 + 3_000_000
