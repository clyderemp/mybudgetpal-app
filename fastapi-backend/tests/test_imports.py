"""Staged statement import: proposals (matching, transfers, review flags), commit, idempotency, rollback, rules."""
from __future__ import annotations

import asyncio

import httpx
import pytest

from app.models import Transaction

from tests.conftest import first_category, make_account, register
from tests.statement_fixtures import csv_bytes, enbd_pdf, mashreq_consolidated_pdf
from tests.test_statement_parsers import ENBD_ROWS, MASHREQ_ACCOUNTS

API = "/api/v1"


def enbd_bytes() -> bytes:
    return enbd_pdf(ENBD_ROWS, opening=500000)


async def upload(c: httpx.AsyncClient, data: bytes, name: str = "statement.pdf") -> httpx.Response:
    return await c.post(f"{API}/imports", files={"file": (name, data, "application/pdf")})


async def household_accounts(c: httpx.AsyncClient) -> dict[str, dict]:
    accs = {
        "joint": await make_account(c, "Joint current", last4="1004", institution="Emirates NBD"),
        "savings": await make_account(c, "Savings pot", last4="1002", institution="Emirates NBD"),
        "card": await make_account(c, "Credit card", last4="6358", type="credit_card"),
        "cash": await make_account(c, "Cash wallet", type="cash"),
        "tabby": await make_account(c, "Tabby", type="credit_card"),
        "mashreq": await make_account(c, "Mashreq current", last4="0666", institution="Mashreq"),
    }
    return accs


def rows_by_index(imp: dict) -> list[dict]:
    return sorted(imp["rows"], key=lambda r: (r["sectionIndex"], int(r["id"].split("-")[1])))


async def cat_name(c: httpx.AsyncClient) -> dict[str, str]:
    r = await c.get(f"{API}/categories")
    return {x["id"]: x["name"] for x in r.json()["items"]}


async def test_upload_proposes_every_row(owner: httpx.AsyncClient):
    accs = await household_accounts(owner)
    r = await upload(owner, enbd_bytes())
    assert r.status_code == 201, r.text
    imp = r.json()
    assert imp["status"] == "draft" and imp["bank"] == "Emirates NBD"
    sec = imp["sections"][0]
    assert sec["accountId"] == accs["joint"]["id"] and sec["reconciliation"]["ok"]
    assert sec["last4"] == "1004" and sec["closingFils"] == 500000 + sum((c or 0) - (d or 0) for _, _, d, c in ENBD_ROWS)
    rows = rows_by_index(imp)
    names = await cat_name(owner)
    got = [(x["status"], x["type"], names.get(x["categoryId"] or ""), x["merchant"]) for x in rows]
    assert got[0] == ("new", "expense", "Utilities", "DEWA")
    assert got[1] == ("transfer", "transfer", None, "To Savings pot")
    assert rows[1]["counterAccountId"] == accs["savings"]["id"]
    assert got[2][:3] == ("new", "income", "Salary")
    assert got[3] == ("review", "expense", "Other", "Transfer to ..5404")
    assert rows[3]["needsReview"] and rows[3]["reviewReason"] == "no_name"
    assert got[4][:2] == ("transfer", "transfer") and rows[4]["counterAccountId"] == accs["card"]["id"]
    assert rows[5]["counterAccountId"] == accs["tabby"]["id"]
    assert rows[6]["counterAccountId"] == accs["cash"]["id"] and rows[6]["merchant"] == "To Cash wallet"
    assert rows[7]["type"] == "transfer" and rows[7]["counterAccountId"] == accs["mashreq"]["id"]  # own name + BOM
    assert got[8][:3] == ("new", "expense", "Other")
    assert got[9][2] == "Debt payment"
    assert got[10][0] == "review" and rows[10]["merchant"] == "Transfer to ..1901"
    assert imp["counts"]["review"] == 2 and imp["counts"]["toImport"] == 11
    assert all("AE07026" not in x["description"] for x in rows)  # IBANs masked


async def test_commit_creates_transactions_and_reports_balances(owner: httpx.AsyncClient):
    accs = await household_accounts(owner)
    imp = (await upload(owner, enbd_bytes())).json()
    r = await owner.post(f"{API}/imports/{imp['id']}/commit")
    assert r.status_code == 200, r.text
    done = r.json()
    assert done["status"] == "committed" and done["commitResult"]["createdCount"] == 11
    txns = (await owner.get(f"{API}/transactions", params={"pageSize": 100})).json()["items"]
    assert len(txns) == 11 and all(t["source"] == "import" and t["importBatch"] == imp["id"] for t in txns)
    flagged = [t for t in txns if t["needsReview"]]
    assert sorted(t["merchant"] for t in flagged) == ["Transfer to ..1901", "Transfer to ..5404"]
    assert all(t["reviewReason"] == "no_name" for t in flagged)
    review = (await owner.get(f"{API}/transactions", params={"needsReview": "true"})).json()
    assert review["total"] == 2
    ipp = next(t for t in txns if t["amountFils"] == 120000)
    assert (ipp["type"], ipp["accountId"], ipp["toAccountId"]) == ("transfer", accs["mashreq"]["id"], accs["joint"]["id"])
    check = done["commitResult"]["accounts"][0]
    net = sum((c or 0) - (d or 0) for _, _, d, c in ENBD_ROWS)
    assert check["statementClosingFils"] == 500000 + net and check["appBalanceFils"] == net
    assert check["differenceFils"] == -500000
    # the user sets the opening balance -> the live check (GET) reports a match
    await owner.patch(f"{API}/accounts/{accs['joint']['id']}", json={"openingBalanceFils": 500000})
    again = (await owner.get(f"{API}/imports/{imp['id']}")).json()
    assert again["commitResult"]["accounts"][0]["differenceFils"] == 0


async def test_reupload_creates_nothing_and_rollback_restores(owner: httpx.AsyncClient):
    await household_accounts(owner)
    first = (await upload(owner, enbd_bytes())).json()
    await owner.post(f"{API}/imports/{first['id']}/commit")
    second = (await upload(owner, enbd_bytes())).json()
    assert second["counts"]["recorded"] == 11 and second["counts"]["toImport"] == 0
    assert all(r["action"] == "skip" and r["matchedTransactionId"] for r in second["rows"])
    done = (await owner.post(f"{API}/imports/{second['id']}/commit")).json()
    assert done["commitResult"]["createdCount"] == 0
    assert (await owner.get(f"{API}/transactions")).json()["total"] == 11

    rb = await owner.post(f"{API}/imports/{first['id']}/rollback")
    assert rb.status_code == 200 and rb.json()["status"] == "rolled_back"
    assert (await owner.get(f"{API}/transactions")).json()["total"] == 0
    assert (await owner.post(f"{API}/imports/{first['id']}/rollback")).status_code == 409
    third = (await upload(owner, enbd_bytes())).json()
    assert third["counts"]["recorded"] == 0 and third["counts"]["toImport"] == 11
    hist = (await owner.get(f"{API}/imports")).json()
    assert [i["status"] for i in hist["items"]] == ["draft", "committed", "rolled_back"]
    assert "rows" not in hist["items"][0]


async def test_already_recorded_manual_entry_is_matched_one_to_one(owner: httpx.AsyncClient):
    accs = await household_accounts(owner)
    util = await first_category(owner, "Utilities")
    for day in ("2026-07-02", "2026-07-20"):  # one within ±2 days, one far away
        await owner.post(f"{API}/transactions", json={
            "accountId": accs["joint"]["id"], "date": day, "amountFils": 215500, "type": "expense",
            "categoryId": util["id"], "merchant": "Dubai Electricity"})
    imp = (await upload(owner, enbd_bytes())).json()
    row = rows_by_index(imp)[0]
    assert row["status"] == "recorded" and row["action"] == "skip" and "already in the app" in row["reason"]
    assert imp["counts"]["recorded"] == 1


async def test_transfer_pair_inside_one_statement_and_other_leg_already_recorded(owner: httpx.AsyncClient):
    cur = await make_account(owner, "Neo current", last4="0666", institution="Mashreq")
    sav = await make_account(owner, "Neo saver", last4="3570", institution="Mashreq", type="savings")
    joint = await make_account(owner, "Joint", last4="1004", institution="Emirates NBD")
    # the 05/10 IPP to the joint account was already recorded from the joint account's statement
    await owner.post(f"{API}/transactions", json={
        "accountId": cur["id"], "toAccountId": joint["id"], "date": "2026-10-06", "amountFils": 120000,
        "type": "transfer"})
    imp = (await upload(owner, mashreq_consolidated_pdf(MASHREQ_ACCOUNTS))).json()
    assert [s["accountId"] for s in imp["sections"]] == [cur["id"], sav["id"]]
    rows = {r["id"]: r for r in imp["rows"]}
    out_leg, in_leg = rows["0-3"], rows["1-0"]
    assert out_leg["status"] == "transfer" and out_leg["action"] == "import"
    assert out_leg["counterAccountId"] == sav["id"] and out_leg["pairedRowId"] == "1-0"
    assert in_leg["action"] == "skip" and in_leg["pairedRowId"] == "0-3"
    assert rows["0-4"]["status"] == "recorded"  # other leg recorded earlier (date differs by a day)
    assert rows["0-1"]["status"] == "review" and rows["0-1"]["merchant"] == "Card purchase ..1155"
    assert rows["0-2"]["merchant"] == "Carrefour"
    done = (await owner.post(f"{API}/imports/{imp['id']}/commit")).json()
    assert done["commitResult"]["createdCount"] == 4  # salary, 2 purchases, ONE transfer
    txns = (await owner.get(f"{API}/transactions", params={"type": "transfer"})).json()["items"]
    assert sorted((t["accountId"], t["toAccountId"], t["amountFils"]) for t in txns) == sorted([
        (cur["id"], joint["id"], 120000), (cur["id"], sav["id"], 50000)])
    for chk in done["commitResult"]["accounts"]:
        assert chk["differenceFils"] == (-10000 if chk["accountId"] == cur["id"] else 0)


async def test_unknown_account_must_be_mapped_before_commit(owner: httpx.AsyncClient):
    imp = (await upload(owner, enbd_bytes())).json()
    assert imp["sections"][0]["accountId"] is None
    assert imp["sections"][0]["suggestedAccountName"] == "Emirates NBD Current account ..1004"
    r = await owner.post(f"{API}/imports/{imp['id']}/commit")
    assert r.status_code == 422 and "sections.0" in r.json()["error"]["fields"]
    acc = await make_account(owner, "New joint", last4="1004")
    r = await owner.patch(f"{API}/imports/{imp['id']}", json={"sections": [{"index": 0, "accountId": acc["id"]}]})
    assert r.status_code == 200 and r.json()["sections"][0]["accountName"] == "New joint"
    # transfer rows to accounts the household doesn't have need a decision
    r = await owner.post(f"{API}/imports/{imp['id']}/commit")
    assert r.status_code == 422
    fields = r.json()["error"]["fields"]
    assert set(fields) == {"rows.0-7"}  # transfer in the holder's own name, from an account the app doesn't have
    skip = [{"id": k.split(".")[1], "action": "skip"} for k in fields]
    assert (await owner.patch(f"{API}/imports/{imp['id']}/rows", json={"rows": skip})).status_code == 200
    r = await owner.post(f"{API}/imports/{imp['id']}/commit")
    assert r.status_code == 200, r.text


async def test_row_edits_rules_and_rematch(owner: httpx.AsyncClient):
    await household_accounts(owner)
    imp = (await upload(owner, enbd_bytes())).json()
    rules = (await owner.get(f"{API}/merchant-rules")).json()
    patterns = {r["pattern"]: r for r in rules["items"]}
    assert patterns["ZERO MAX"]["categoryName"] == "Car payment" and patterns["SPOTIFY"]["categoryName"] == "Subscriptions"
    cats = {c["name"] for c in (await owner.get(f"{API}/categories")).json()["items"]}
    assert {"Car payment", "Subscriptions"} <= cats
    car = await first_category(owner, "Car payment")
    r = await owner.post(f"{API}/merchant-rules", json={"pattern": "Transfer to ..1901", "categoryId": car["id"],
                                                        "merchant": "Zero Max (car loan)"})
    assert r.status_code == 201 and r.json()["source"] == "user"
    imp = (await owner.patch(f"{API}/imports/{imp['id']}", json={"rematch": True})).json()
    row = rows_by_index(imp)[10]
    assert (row["merchant"], row["categoryId"], row["status"], row["needsReview"]) == (
        "Zero Max (car loan)", car["id"], "new", False)
    # a person edits a row: name given -> no longer needs review, survives rematch
    dining = await first_category(owner, "Dining")
    r = await owner.patch(f"{API}/imports/{imp['id']}/rows", json={"rows": [
        {"id": "0-3", "merchant": "Landlord", "categoryId": dining["id"]}, {"id": "0-8", "action": "skip"}]})
    assert r.status_code == 200
    imp = (await owner.patch(f"{API}/imports/{imp['id']}", json={"rematch": True})).json()
    rows = rows_by_index(imp)
    assert (rows[3]["merchant"], rows[3]["status"], rows[3]["edited"]) == ("Landlord", "new", True)
    assert rows[8]["action"] == "skip"
    bad = await owner.patch(f"{API}/imports/{imp['id']}/rows", json={"rows": [{"id": "9-9", "action": "skip"}]})
    assert bad.status_code == 422
    # rule CRUD
    rid = (await owner.get(f"{API}/merchant-rules")).json()["items"][0]["id"]
    assert (await owner.patch(f"{API}/merchant-rules/{rid}", json={"merchant": "Zero Max"})).json()["merchant"] == "Zero Max"
    assert (await owner.delete(f"{API}/merchant-rules/{rid}")).status_code == 204
    assert rid not in {x["id"] for x in (await owner.get(f"{API}/merchant-rules")).json()["items"]}


async def test_skipped_rows_stay_skipped_on_reupload(owner: httpx.AsyncClient):
    await household_accounts(owner)
    imp = (await upload(owner, enbd_bytes())).json()
    await owner.patch(f"{API}/imports/{imp['id']}/rows", json={"rows": [{"id": "0-8", "action": "skip"}]})
    await owner.post(f"{API}/imports/{imp['id']}/commit")
    again = (await upload(owner, enbd_bytes())).json()
    assert again["counts"]["toImport"] == 0
    assert "skipped when" in rows_by_index(again)[8]["reason"]


async def test_csv_upload(owner: httpx.AsyncClient):
    acc = await make_account(owner, "Card account")
    data = csv_bytes([("01/07/2026", "SPOTIFY P1234 STOCKHOLM", "23.99", "", "976.01"),
                      ("02/07/2026", "Refund", "", "10.00", "986.01")])
    r = await upload(owner, data, "export.csv")
    assert r.status_code == 201, r.text
    imp = r.json()
    assert imp["format"] == "csv" and imp["sections"][0]["accountId"] is None
    imp = (await owner.patch(f"{API}/imports/{imp['id']}", json={"sections": [{"index": 0, "accountId": acc["id"]}]})).json()
    assert rows_by_index(imp)[0]["merchant"] == "Spotify"
    assert (await owner.post(f"{API}/imports/{imp['id']}/commit")).json()["commitResult"]["createdCount"] == 2


@pytest.mark.parametrize("settings_overrides", [{"allow_registration": True}])
async def test_upload_validation_and_isolation(owner: httpx.AsyncClient, new_client):  # type: ignore[no-untyped-def]
    r = await owner.post(f"{API}/imports", files={"file": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 422 and r.json()["error"]["code"] == "unsupported_file"
    r = await upload(owner, b"%PDF-1.4 not really")
    assert r.status_code == 422 and r.json()["error"]["code"] == "unreadable_statement"
    imp = (await upload(owner, enbd_bytes())).json()
    async with new_client() as other:
        await register(other, "eve@example.com", "Elsewhere")
        assert (await other.get(f"{API}/imports/{imp['id']}")).status_code == 404
        assert (await other.post(f"{API}/imports/{imp['id']}/commit")).status_code == 404
        assert (await other.get(f"{API}/imports")).json()["total"] == 0
    await owner.post(f"{API}/imports/{imp['id']}/rollback")  # discard draft
    r = await owner.patch(f"{API}/imports/{imp['id']}", json={"rematch": True})
    assert r.status_code == 409


@pytest.mark.parametrize("settings_overrides", [{"import_max_bytes": 1000}])
async def test_upload_size_limit(owner: httpx.AsyncClient):
    r = await upload(owner, enbd_bytes())
    assert r.status_code == 413 and r.json()["error"]["code"] == "file_too_large"


@pytest.mark.parametrize("settings_overrides", [{"rate_limit_imports_per_min": 1}])
async def test_upload_rate_limited(owner: httpx.AsyncClient):
    assert (await upload(owner, b"hello", "a.csv")).status_code == 422
    r = await upload(owner, b"hello", "a.csv")
    assert r.status_code == 429


async def test_concurrent_commits_record_rows_once(owner: httpx.AsyncClient):
    await household_accounts(owner)
    imp = (await upload(owner, enbd_bytes())).json()
    twin = (await upload(owner, enbd_bytes())).json()  # same statement uploaded twice, both still drafts
    r1, r2, r3 = await asyncio.gather(
        owner.post(f"{API}/imports/{imp['id']}/commit"),
        owner.post(f"{API}/imports/{imp['id']}/commit"),
        owner.post(f"{API}/imports/{twin['id']}/commit"),
    )
    assert sorted([r1.status_code, r2.status_code]) == [200, 409]
    assert r3.status_code == 200
    created = [r.json()["commitResult"]["createdCount"] for r in (r1, r2, r3) if r.status_code == 200]
    assert sum(created) == 11
    assert (await owner.get(f"{API}/transactions", params={"pageSize": 100})).json()["total"] == 11
    # edits after the commit can't overwrite it
    r = await owner.patch(f"{API}/imports/{imp['id']}/rows", json={"rows": [{"id": "0-0", "action": "skip"}]})
    assert r.status_code == 409


async def test_rollback_frees_rows_and_deleted_rows_stay_out(owner: httpx.AsyncClient):
    await household_accounts(owner)
    first = (await upload(owner, enbd_bytes())).json()
    await owner.post(f"{API}/imports/{first['id']}/commit")
    await owner.post(f"{API}/imports/{first['id']}/rollback")
    gone = await Transaction.find({"import_batch": first["id"]}).to_list()
    assert gone and all(t.deleted_at and t.source_ref is None and t.rolled_back_source_ref for t in gone)
    second = (await upload(owner, enbd_bytes())).json()
    done = (await owner.post(f"{API}/imports/{second['id']}/commit")).json()
    assert done["commitResult"]["createdCount"] == 11
    # a person deletes one imported transaction: re-uploading doesn't bring it back
    txn = (await owner.get(f"{API}/transactions", params={"pageSize": 1})).json()["items"][0]
    await owner.delete(f"{API}/transactions/{txn['id']}")
    third = (await upload(owner, enbd_bytes())).json()
    assert third["counts"]["toImport"] == 0
    assert any("deleted in the app" in r["reason"] for r in third["rows"])


async def test_too_complex_pdf_is_refused(owner: httpx.AsyncClient):
    from tests.statement_fixtures import Page, build_pdf

    p = Page(612, 792)
    p.text(20, 100, "Emirates NBD")
    r = await upload(owner, build_pdf([p], padding=5 * 1024 * 1024))
    assert r.status_code == 422 and r.json()["error"]["code"] == "statement_too_complex"
