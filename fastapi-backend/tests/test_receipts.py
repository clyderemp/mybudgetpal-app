"""Receipt reading: redaction, local parser, AI fallback chain, endpoint."""
import datetime as dt
import json

import httpx
import pytest

from app.services import receipts as rc
from tests.conftest import make_account, make_settings

TODAY = dt.date(2026, 11, 10)
CARREFOUR = """CARREFOUR
MALL OF THE EMIRATES
TAX INVOICE  TRN 100234567800003
Date: 08/11/2026  Time: 18:42
Milk 2L            9.75
Bread              4.50
Sub Total         13.57
VAT 5%             0.68
TOTAL AED         14.25
VISA ************4821
Change             0.00
"""
NAMES = ["Groceries", "Fuel", "Dining", "Other"]


def test_redaction_keeps_last4_and_dates():
    out = rc.redact_for_ai("TRN 100234567800003 card 4111 1111 1111 4821 on 08/11/2026 a@b.com")
    assert "100234567800003" not in out and "[number ending 0003]" in out
    assert "[number ending 4821]" in out and "08/11/2026" in out and "[email]" in out


def test_local_parser_reads_supermarket_receipt():
    r = rc.local_reading(CARREFOUR, NAMES, TODAY)
    assert (r.merchant, r.total, r.currency, r.date) == ("Carrefour", 14.25, "AED", "2026-11-08")
    assert (r.category, r.card_last4, r.vat) == ("Groceries", "4821", 0.68)


@pytest.mark.parametrize(
    ("text", "total", "date"),
    [
        ("ENOC\n26 Oct 2026\nSuper 98  40.12 L\nAmount Due\nAED 120.00", 120.0, "2026-10-26"),
        ("Cafe\nTotal 1,040.50\n2026-01-03", 1040.5, "2026-01-03"),
        ("Shop\nSubtotal 50.00\nGrand Total 52.50\nTotal items 3", 52.5, None),
        ("Shop 31/12/2099\nTOTAL 10.00", 10.0, None),  # future date rejected
    ],
)
def test_local_parser_variants(text, total, date):
    r = rc.local_reading(text, NAMES, TODAY)
    assert r.total == total and r.date == date


def _reply(content: dict | str, status: int = 200, model: str = "m") -> httpx.Response:
    body = content if isinstance(content, str) else json.dumps(content)
    return httpx.Response(status, json={"model": model, "choices": [{"message": {"content": body}}]})


async def test_ai_falls_back_through_models_and_local_fills_gaps():
    rc.reset_model_cooldowns()
    settings = make_settings(openrouter_api_key="k", openrouter_model="a/one:free,b/two:free")
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append(body)
        assert "4111111111114821" not in request.content.decode()
        if body["model"] == "a/one:free":
            return httpx.Response(429)
        return _reply({"merchant": "Carrefour MOE", "total": 14.25, "currency": "Dhs", "date": "2026-11-08",
                       "category": "groceries", "cardLast4": None, "vat": None,
                       "items": [{"name": "Milk 2L", "amount": 9.75}, {"name": "Bread", "amount": 450.0}]},
                      model="b/two:free")

    r = await rc.read_receipt(settings, CARREFOUR + "\ncard 4111111111114821", NAMES, TODAY, httpx.MockTransport(handler))
    assert [b["model"] for b in seen] == ["a/one:free", "b/two:free"]
    assert (r.model, r.merchant, r.total, r.currency, r.category) == ("b/two:free", "Carrefour MOE", 14.25, "AED", "Groceries")
    assert r.card_last4 == "4821" and r.vat == 0.68  # filled by the local parser
    assert [(i.name, i.amount) for i in r.items] == [("Milk 2L", 9.75), ("Bread", None)]


async def test_all_models_fail_uses_local_and_rejects_bad_ai_values():
    rc.reset_model_cooldowns()
    settings = make_settings(openrouter_api_key="k", openrouter_model="a/one:free,b/two:free")
    replies = iter([_reply("not json"), _reply({"total": -5})])
    r = await rc.read_receipt(settings, CARREFOUR, NAMES, TODAY, httpx.MockTransport(lambda _: next(replies)))
    assert r.model is None and r.ai_error and r.total == 14.25

    rc.reset_model_cooldowns()
    bad = _reply({"merchant": None, "total": 3.0, "currency": None, "date": "2031-01-01", "category": "Rent",
                  "cardLast4": None, "vat": None, "items": []})
    r = await rc.read_receipt(settings, CARREFOUR, NAMES, TODAY, httpx.MockTransport(lambda _: bad))
    assert r.date == "2026-11-08"  # implausible AI date replaced by the local one
    assert r.category == "Groceries"  # AI category not in the household list is ignored


def test_paid_models_are_refused():
    with pytest.raises(ValueError):
        make_settings(openrouter_model="openai/gpt-5")


async def test_endpoint_prefills_from_text(owner):
    acct = await make_account(owner, "Visa", last4="4821")
    r = await owner.post("/api/v1/receipts/read", json={"text": CARREFOUR})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["amountFils"] == 1425 and body["date"] == "2026-11-08" and body["merchant"] == "Carrefour"
    assert body["accountId"] == acct["id"] and body["source"] == "text" and body["vatFils"] == 68
    cats = (await owner.get("/api/v1/categories")).json()["items"]
    assert next(c["name"] for c in cats if c["id"] == body["categoryId"]) == "Groceries"


async def test_endpoint_requires_login_and_validates(new_client, owner):
    async with new_client() as anon:
        assert (await anon.post("/api/v1/receipts/read", json={"text": "x"})).status_code in (401, 403)
    assert (await owner.post("/api/v1/receipts/read", json={"text": ""})).status_code == 422
    assert (await owner.post("/api/v1/receipts/read", json={"text": "x" * 8001})).status_code == 422


async def test_slow_model_is_cut_off_and_printed_date_wins():
    import asyncio

    rc.reset_model_cooldowns()
    settings = make_settings(openrouter_api_key="k", openrouter_model="slow/one:free,fast/two:free",
                             receipt_ai_model_timeout_seconds=2.0, receipt_ai_deadline_seconds=10.0)

    async def handler(request: httpx.Request) -> httpx.Response:
        if json.loads(request.content)["model"] == "slow/one:free":
            await asyncio.sleep(30)
        return _reply({"merchant": "Carrefour", "total": 14.25, "currency": "AED", "date": "2026-11-10",
                       "category": None, "cardLast4": None, "vat": None, "items": []}, model="fast/two:free")

    r = await rc.read_receipt(settings, CARREFOUR, NAMES, TODAY, httpx.MockTransport(handler))
    assert r.model == "fast/two:free"
    assert r.date == "2026-11-08"  # the AI said "today"; the receipt says 08/11/2026


async def test_ai_false_skips_the_model(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("AI must not be called")

    monkeypatch.setattr(rc, "ai_reading", boom)
    settings = make_settings(openrouter_api_key="k")
    r = await rc.read_receipt(settings, CARREFOUR, NAMES, TODAY, use_ai=False)
    assert r.total == 14.25 and r.model is None and r.ai_error is None
