from dataclasses import dataclass
from datetime import date

from app.analytics.summary import monthly_series, monthly_summary


def tx(d, amount, typ, cat=None, acct="acc1"):
    return {"date": d, "amount_fils": amount, "type": typ, "category_id": cat, "account_id": acct}


TXNS = [
    tx(date(2026, 10, 1), 1_500_000, "income", "salary"),
    tx(date(2026, 10, 3), 600_000, "expense", "rent"),
    tx(date(2026, 10, 5), 150_000, "expense", "groceries"),
    tx(date(2026, 10, 20), 50_000, "expense", "groceries"),
    tx(date(2026, 10, 21), 200_000, "expense", "dining"),
    tx(date(2026, 10, 22), 999_999, "transfer", None),  # ignored
    tx(date(2026, 9, 30), 70_000, "expense", "rent"),  # other month
    tx(date(2026, 11, 1), 10_000, "expense", "rent"),  # other month
]


def test_monthly_summary_hand_checked():
    s = monthly_summary(TXNS, "2026-10")
    # income 15,000.00; expense 6,000 + 1,500 + 500 + 2,000 = 10,000.00; net 5,000.00
    assert s["month"] == "2026-10"
    assert s["incomeFils"] == 1_500_000
    assert s["expenseFils"] == 1_000_000
    assert s["netFils"] == 500_000
    assert s["savingsRate"] == 0.3333
    assert s["byCategory"] == [
        {"categoryId": "rent", "expenseFils": 600_000, "share": 0.6},
        {"categoryId": "dining", "expenseFils": 200_000, "share": 0.2},
        {"categoryId": "groceries", "expenseFils": 200_000, "share": 0.2},
    ]


def test_monthly_summary_empty_and_no_income():
    s = monthly_summary([], "2026-10")
    assert s == {"month": "2026-10", "incomeFils": 0, "expenseFils": 0, "netFils": 0, "savingsRate": None, "byCategory": []}
    s = monthly_summary([tx(date(2026, 10, 1), 5000, "expense", "x")], "2026-10")
    assert s["savingsRate"] is None and s["netFils"] == -5000


def test_savings_rate_clamped_when_overspending():
    s = monthly_summary([tx(date(2026, 10, 1), 1000, "income", "s"), tx(date(2026, 10, 2), 3000, "expense", "x")], "2026-10")
    assert s["netFils"] == -2000
    assert s["savingsRate"] == 0.0


def test_accepts_dataclasses_and_iso_strings():
    @dataclass
    class T:
        date: object
        amount_fils: int
        type: str
        category_id: str | None
        account_id: str

    s = monthly_summary([T("2026-10-02", 100, "income", "s", "a"), T(date(2026, 10, 3), 40, "expense", "g", "a")], "2026-10")
    assert (s["incomeFils"], s["expenseFils"], s["netFils"]) == (100, 40, 60)


def test_monthly_series_zero_filled_across_year():
    series = monthly_series(TXNS, "2026-11", 4)
    assert [m["month"] for m in series] == ["2026-08", "2026-09", "2026-10", "2026-11"]
    assert series[0] == {"month": "2026-08", "incomeFils": 0, "expenseFils": 0, "netFils": 0}
    assert series[1] == {"month": "2026-09", "incomeFils": 0, "expenseFils": 70_000, "netFils": -70_000}
    assert series[2]["netFils"] == 500_000
    assert series[3]["expenseFils"] == 10_000
    assert [m["month"] for m in monthly_series([], "2027-02", 3)] == ["2026-12", "2027-01", "2027-02"]
    assert monthly_series(TXNS, "2026-10", 0) == []
