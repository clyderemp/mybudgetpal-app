"""Bills / expected income (app.analytics.bills) with synthetic, hand-checked numbers."""

from __future__ import annotations

import datetime as dt
from itertools import count

from app.analytics.bills import (
    bill_window,
    detect_recurring,
    expected_amounts,
    instalment_number,
    is_due_in,
    last_month,
    match_month,
    merchant_key,
    month_report,
    monthly_share,
    safe_to_spend,
    zero_based_plan,
)

TODAY = dt.date(2026, 11, 10)
BANK = "acc-bank"
_ids = count(1)


def bill(name, amount, day_from, day_to=None, **kw):
    return {
        "id": kw.pop("id", name.lower().replace(" ", "-")),
        "name": name,
        "kind": kw.pop("kind", "bill"),
        "amount_fils": amount,
        "amount_mode": kw.pop("amount_mode", "fixed"),
        "cadence": kw.pop("cadence", "monthly"),
        "due_day_from": day_from,
        "due_day_to": day_to or day_from,
        "account_id": kw.pop("account_id", None),
        "category_id": kw.pop("category_id", None),
        "match_text": kw.pop("match_text", []),
        "amount_tolerance_pct": kw.pop("tol", 10),
        "start_month": kw.pop("start_month", "2026-01"),
        "end_month": kw.pop("end_month", None),
        "instalments_total": kw.pop("instalments_total", None),
        "instalments_paid": kw.pop("instalments_paid", 0),
        "purpose": kw.pop("purpose", "household"),
        "active": kw.pop("active", True),
        "skipped_months": kw.pop("skipped_months", []),
        "ignored_transaction_ids": kw.pop("ignored", []),
    }


def txn(date, amount, merchant, type_="expense", **kw):
    return {
        "id": kw.pop("id", f"t{next(_ids)}"),
        "date": dt.date.fromisoformat(date),
        "amount_fils": amount,
        "type": type_,
        "account_id": kw.pop("account_id", BANK),
        "to_account_id": kw.pop("to_account_id", None),
        "category_id": kw.pop("category_id", None),
        "merchant": merchant,
        "note": kw.pop("note", None),
        "bill_id": kw.pop("bill_id", None),
    }


def household_bills():
    return [
        bill("Spotify", 2_474, 3, kind="subscription", match_text=["spotify"], tol=5),
        bill("OpenAI", 8_251, 12, kind="subscription", match_text=["openai"]),
        bill("DEWA", 60_000, 15, 20, amount_mode="estimate", match_text=["dewa"], tol=25),
        bill("Zero Max", 335_000, 1, 5, kind="loan", match_text=["zero max"], instalments_total=48, instalments_paid=10),
        bill("Tabby", 25_000, 8, kind="bnpl", match_text=["tabby"], instalments_total=4, start_month="2026-09"),
        bill("Car insurance", 240_000, 20, cadence="yearly", start_month="2026-03", match_text=["insurance"]),
    ]


def streams():
    return [
        {
            "id": "clyde",
            "name": "Clyde salary",
            "member_id": "u1",
            "account_id": BANK,
            "active": True,
            "parts": [{"id": "sal", "label": "Salary", "kind": "salary", "amount_fils": 1_750_000, "day_from": 4,
                       "day_to": 7, "match_text": ["salary", "salvone"]}],
        },
        {
            "id": "trish",
            "name": "Trish salary",
            "member_id": "u2",
            "account_id": BANK,
            "active": True,
            "parts": [
                {"id": "adv", "label": "Advance", "kind": "cash_deposit", "amount_fils": 250_000,
                 "amount_min_fils": 200_000, "amount_max_fils": 300_000, "day_from": 5, "day_to": 10,
                 "match_text": ["cash deposit"]},
                {"id": "rem", "label": "Remainder", "kind": "cash_deposit", "amount_fils": 300_000,
                 "day_from": 20, "day_to": 28, "match_text": ["cash deposit"]},
            ],
        },
    ]


def november_txns():
    return [
        txn("2026-08-18", 50_000, "DEWA"),
        txn("2026-09-17", 70_000, "DEWA"),
        txn("2026-10-16", 66_000, "DEWA"),
        txn("2026-11-02", 335_000, "ZERO MAX AUTO", id="zm"),
        txn("2026-11-03", 2_699, "SPOTIFY P1234", id="sp"),
        txn("2026-11-04", 31_250, "Carrefour"),
        txn("2026-11-05", 1_750_000, "SALVONE SALARY NOV", "income", id="sal"),
        txn("2026-11-08", 220_000, "CASH DEPOSIT CDM", "income", id="adv"),
    ]


# ---------------------------------------------------------------- schedule


def test_schedule_cadence_and_instalments():
    tabby = bill("Tabby", 25_000, 8, instalments_total=4, instalments_paid=1, start_month="2026-10")
    assert last_month(tabby) == "2026-12"  # 3 remaining: Oct, Nov, Dec
    assert [is_due_in(tabby, m) for m in ("2026-09", "2026-10", "2026-12", "2027-01")] == [False, True, True, False]
    assert instalment_number(tabby, "2026-11") == 3

    quarterly = bill("Water", 30_000, 10, cadence="quarterly", start_month="2026-02")
    assert [m for m in ("2026-02", "2026-03", "2026-05", "2026-08", "2026-09") if is_due_in(quarterly, m)] == [
        "2026-02", "2026-05", "2026-08"]
    assert monthly_share(quarterly) == 10_000
    assert monthly_share(bill("Insurance", 100_000, 1, cadence="yearly")) == 8_333  # 833.33, half-up

    ended = bill("Gym", 20_000, 1, end_month="2026-10")
    assert is_due_in(ended, "2026-10") and not is_due_in(ended, "2026-11")


def test_payment_windows_never_overlap():
    b = bill("Rent", 100, 1)
    assert bill_window(b, "2026-11") == (dt.date(2026, 10, 22), dt.date(2026, 11, 20))
    assert bill_window(b, "2026-12") == (dt.date(2026, 11, 21), dt.date(2026, 12, 21))
    # Day 31 clamps to the month's last day.
    assert bill_window(bill("X", 100, 31), "2026-02")[0] == dt.date(2026, 2, 18)


# ---------------------------------------------------------------- matching


def test_month_report_statuses_and_amounts():
    rep = month_report(household_bills(), streams(), november_txns(), "2026-11", TODAY)
    by = {i["name"]: i for i in rep["items"]}
    assert list(by) == ["Zero Max", "Spotify", "Tabby", "OpenAI", "DEWA"]  # due order; insurance not due in Nov

    assert by["Zero Max"]["status"] == "paid"
    assert by["Zero Max"]["matches"][0]["transactionId"] == "zm"
    assert by["Zero Max"]["instalmentNumber"] == 21 and by["Zero Max"]["instalmentsTotal"] == 48

    spotify = by["Spotify"]
    assert spotify["status"] == "paid" and spotify["paidFils"] == 2_699
    assert spotify["priceChanged"] is True and spotify["differenceFils"] == 225  # 9.1% > 5% tolerance
    assert spotify["needsConfirmation"] is True  # outside tolerance -> medium confidence

    assert by["Tabby"]["status"] == "overdue"  # due 8th, today 10th, nothing paid
    assert by["OpenAI"]["status"] == "due_soon"  # due 12th, within 3 days
    assert by["DEWA"]["status"] == "upcoming"
    assert by["DEWA"]["expectedFils"] == 62_000  # estimate: (500 + 700 + 660) / 3

    inc = {(i["streamId"], i["partId"]): i for i in rep["income"]}
    assert inc[("clyde", "sal")]["status"] == "received" and inc[("clyde", "sal")]["receivedFils"] == 1_750_000
    assert inc[("trish", "adv")]["status"] == "received" and inc[("trish", "adv")]["receivedFils"] == 220_000
    assert inc[("trish", "rem")]["status"] == "upcoming"

    t = rep["totals"]
    assert t["billsExpectedFils"] == 335_000 + 2_474 + 25_000 + 8_251 + 62_000
    assert t["billsPaidFils"] == 335_000 + 2_699
    assert t["billsRemainingFils"] == 25_000 + 8_251 + 62_000
    assert t["incomeExpectedFils"] == 2_300_000 and t["incomeReceivedFils"] == 1_970_000
    assert t["incomeWaitingFils"] == 300_000
    # Confident (in-tolerance) rule matches are offered for persisting; the price-changed Spotify one isn't.
    assert ("zm", "zero-max") in rep["links"] and ("sp", "spotify") not in rep["links"]


def test_overdue_income_and_skipped_bill():
    b = household_bills()
    b[1]["skipped_months"] = ["2026-11"]
    rep = month_report(b, streams(), [], "2026-11", dt.date(2026, 11, 12))
    by = {i["name"]: i for i in rep["items"]}
    assert by["OpenAI"]["status"] == "skipped"
    inc = {i["partId"]: i for i in rep["income"]}
    assert inc["sal"]["status"] == "overdue"  # due 4-7 (+3 days grace) and nothing by the 12th
    assert inc["adv"]["status"] == "due_soon"  # window 5-10, grace to the 13th
    assert rep["totals"]["billsCount"] == 4  # skipped bill left out of totals


def test_explicit_link_wins_and_one_to_one():
    bills = [
        bill("Tabby phone", 25_000, 8, match_text=["tabby"], id="b1"),
        bill("Tabby sofa", 40_000, 8, match_text=["tabby"], id="b2"),
    ]
    txns = [
        txn("2026-11-08", 40_000, "TABBY", id="x40"),
        txn("2026-11-08", 25_000, "TABBY", id="x25"),
        # Linked by hand to the sofa although the amount is off: the link wins, no rule needed.
        txn("2026-11-09", 39_000, "Tabby late fee?", id="manual", bill_id="b2"),
    ]
    bm, _ = match_month(bills, [], txns, "2026-11")
    assert [m["txn"]["id"] for m in bm["b1"]] == ["x25"]  # amount picks the right plan
    assert [(m["txn"]["id"], m["confidence"]) for m in bm["b2"]] == [("manual", "linked")]


def test_ignored_and_foreign_linked_transactions_never_match():
    b = bill("Spotify", 2_474, 3, match_text=["spotify"], ignored=["t-ignored"], id="sp")
    other = bill("Other", 2_474, 3, match_text=["nothing"], id="other")
    txns = [
        txn("2026-11-03", 2_474, "Spotify", id="t-ignored"),
        txn("2026-11-03", 2_474, "Spotify", id="t-other", bill_id="other"),
    ]
    bm, _ = match_month([b, other], [], txns, "2026-11")
    assert "sp" not in bm


def test_early_payment_counts_for_the_month_it_pays():
    b = bill("Zero Max", 335_000, 1, 5, match_text=["zero max"], id="zm")
    txns = [txn("2026-10-29", 335_000, "Zero Max", id="early")]
    assert [m["txn"]["id"] for m in match_month([b], [], txns, "2026-11")[0]["zm"]] == ["early"]
    assert "zm" not in match_month([b], [], txns, "2026-10")[0]


def test_amount_far_off_and_wrong_account():
    b = bill("Etisalat", 30_000, 10, match_text=["etisalat"], account_id=BANK, id="et")
    far = [txn("2026-11-10", 99_000, "Etisalat")]
    assert match_month([b], [], far, "2026-11")[0] == {}
    other_acc = [txn("2026-11-10", 30_000, "Etisalat", account_id="card")]
    assert match_month([b], [], other_acc, "2026-11")[0]["et"][0]["confidence"] == "medium"


def test_estimate_falls_back_to_amount_without_history():
    b = bill("DEWA", 60_000, 15, amount_mode="estimate", match_text=["dewa"], id="dewa")
    assert expected_amounts([b], [], [], "2026-11")[0] == {"dewa": 60_000}


# ---------------------------------------------------------------- safe to spend


def test_safe_to_spend_until_next_salary():
    bills, ss, txns = household_bills(), streams(), november_txns()
    nov = month_report(bills, ss, txns, "2026-11", TODAY)
    dec = month_report(bills, ss, txns, "2026-12", TODAY)
    out = safe_to_spend(1_000_000, nov["items"] + dec["items"], nov["income"] + dec["income"], TODAY)
    assert out["until"] == "2026-12-04"
    assert out["nextSalary"]["streamName"] == "Clyde salary"
    # Unpaid by Dec 4: Tabby (overdue) 250 + OpenAI 82.51 + DEWA 620 + Zero Max (Dec 1) 3,350 + Spotify (Dec 3) 24.74.
    assert out["billsDueFils"] == 25_000 + 8_251 + 62_000 + 335_000 + 2_474
    assert {b["name"] for b in out["bills"]} == {"Tabby", "OpenAI", "DEWA", "Zero Max", "Spotify"}
    # Trish's remainder (~25th) lands before then; December's advance (5th-10th) does not.
    assert out["incomeExpectedFils"] == 300_000
    assert out["safeToSpendFils"] == 1_000_000 - 432_725 + 300_000


def test_safe_to_spend_late_salary_and_no_salary():
    late = [{"kind": "salary", "status": "overdue", "streamName": "S", "label": "Salary", "dueFrom": "2026-11-04",
             "dueTo": "2026-11-07", "expectedFils": 100, "minFils": None}]
    bills = [{"billId": "b", "name": "B", "status": "upcoming", "purpose": "household", "dueFrom": "2026-11-15",
              "expectedFils": 500, "paidFils": 0}]
    out = safe_to_spend(1_000, bills, late, TODAY)
    assert out["until"] == "2026-11-10"  # salary is late: horizon is today
    assert out["billsDueFils"] == 0 and out["safeToSpendFils"] == 1_000
    out = safe_to_spend(1_000, bills, [], TODAY)
    assert out["until"] == "2026-11-30" and out["safeToSpendFils"] == 500 and out["nextSalary"] is None


def test_business_bills_never_count():
    b = [{"billId": "b", "name": "B", "status": "overdue", "purpose": "business", "dueFrom": "2026-11-01",
          "expectedFils": 500, "paidFils": 0}]
    assert safe_to_spend(1_000, b, [], TODAY)["billsDueFils"] == 0


# ---------------------------------------------------------------- zero-based plan


def test_zero_based_plan():
    bills = household_bills() + [
        bill("Savings transfer", 100_000, 28, kind="savings"),
        bill("Studio rent", 500_000, 1, purpose="business"),
        bill("Paused", 9_999, 1, active=False),
    ]
    bills[0]["category_id"] = "cat-subs"
    expected, _ = expected_amounts(bills, streams(), november_txns(), "2026-11")
    plan = zero_based_plan(bills, streams(), "2026-11", 500_000, expected, ["cat-subs", "cat-food"])
    assert plan["expectedIncomeFils"] == 2_300_000
    assert plan["commitmentsFils"] == 2_474 + 8_251 + 62_000 + 335_000 + 25_000
    assert {k["kind"]: k["amountFils"] for k in plan["commitmentsByKind"]} == {
        "bill": 62_000, "bnpl": 25_000, "loan": 335_000, "subscription": 10_725}
    assert plan["sinkingFundsFils"] == 20_000  # 2,400 a year / 12
    assert plan["sinkingFunds"][0]["dueThisMonth"] is False
    assert plan["savingsFils"] == 100_000
    assert plan["leftToAssignFils"] == 2_300_000 - 432_725 - 20_000 - 100_000 - 500_000
    assert plan["overlapCategoryIds"] == ["cat-subs"]
    assert plan["committedShare"] == round((432_725 + 20_000) / 2_300_000, 4)


def test_zero_based_plan_without_income():
    plan = zero_based_plan([bill("Rent", 100, 1)], [], "2026-11", 0)
    assert plan["expectedIncomeFils"] == 0 and plan["leftToAssignFils"] == -100 and plan["committedShare"] is None


# ---------------------------------------------------------------- suggestions


def test_merchant_key():
    assert merchant_key("SPOTIFY P1A2B3 Stockholm") == "spotify stockholm"
    assert merchant_key("OPENAI *CHATGPT SUBSCR") == "openai chatgpt subscr"
    assert merchant_key(None) == ""


def test_detect_recurring():
    txns = []
    for m in ("06", "07", "08", "09", "10", "11"):
        txns.append(txn(f"2026-{m}-03", 2_474, "SPOTIFY P1A2B3"))
        txns.append(txn(f"2026-{m}-12", 8_251, "OPENAI *CHATGPT SUBSCR"))
        for d in ("02", "09", "16", "23"):
            txns.append(txn(f"2026-{m}-{d}", 20_000 + int(d) * 10, "Carrefour"))  # weekly: not a bill
    for m in ("09", "10", "11"):
        txns.append(txn(f"2026-{m}-08", 25_000, "Tabby"))
    for m in ("09", "10"):
        txns.append(txn(f"2026-{m}-20", 40_000, "Tabby"))
    txns.append(txn("2026-10-14", 120_000, "IKEA"))  # one-off
    txns.append(txn("2026-04-01", 2_474, "SPOTIFY P1A2B3"))  # older than 6 months: ignored
    existing = [bill("OpenAI", 8_251, 12, match_text=["openai"])]

    out = detect_recurring(txns, existing, TODAY)
    by = {s["name"]: s for s in out}
    assert set(by) == {"Spotify P1A2B3", "Tabby (250.00)", "Tabby (400.00)"}
    sp = by["Spotify P1A2B3"]
    assert (sp["amountFils"], sp["amountMode"], sp["dueDayFrom"], sp["dueDayTo"]) == (2_474, "fixed", 3, 3)
    assert sp["kind"] == "subscription" and sp["confidence"] == "high" and sp["months"] == 6
    assert sp["matchText"] == ["spotify"]
    assert by["Tabby (250.00)"]["kind"] == "bnpl" and by["Tabby (250.00)"]["confidence"] == "high"
    assert by["Tabby (400.00)"]["confidence"] == "medium"  # only 2 months seen
    assert out[0]["confidence"] == "high"


def test_detect_recurring_skips_stopped_payments():
    txns = [txn(f"2026-{m}-04", 9_100, "Cake n More") for m in ("05", "06", "07")]
    assert detect_recurring(txns, [], TODAY) == []  # last one in July: more than 45 days ago
    out = detect_recurring([txn(f"2026-{m}-04", 9_100, "Corner shop") for m in ("09", "10", "11")], [], TODAY)
    assert out[0]["kind"] == "other"


def test_detect_recurring_skips_linked_transactions():
    txns = [txn(f"2026-{m}-03", 2_474, "Spotify", bill_id="sp") for m in ("08", "09", "10")]
    assert detect_recurring(txns, [], TODAY) == []
