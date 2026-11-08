import itertools

from app.analytics.health import financial_health


def months(*pairs):
    return [{"month": f"2026-{i + 1:02d}", "incomeFils": inc, "expenseFils": exp, "netFils": inc - exp} for i, (inc, exp) in enumerate(pairs)]


def test_perfect_score_100():
    h = financial_health(months((1_000_000, 500_000)) * 3, 3_000_000, 0, 0)
    assert h["score"] == 100
    assert h["savingsRate"] == 0.5
    assert h["emergencyFundMonths"] == 6.0
    assert h["debtToIncome"] == 0.0
    assert h["tips"]


def test_worst_score_0():
    h = financial_health(months((100_000, 300_000)), 0, 5_000_000, 100_000)
    assert h["score"] == 0
    assert h["savingsRate"] == 0.0
    assert h["emergencyFundMonths"] == 0.0
    assert h["debtToIncome"] == 1.0
    assert any("more than you earned" in t for t in h["tips"])


def test_hand_checked_middle():
    # savings 10% -> 35 * 0.10/0.20 = 17.5
    # emergency 1,350,000 / 900,000 = 1.5 months -> 35 * 1.5/6 = 8.75
    # DTI 300,000 / 1,000,000 = 0.30 -> 30 * (0.50-0.30)/0.40 = 15
    # total 41.25 -> 41
    h = financial_health(months((1_000_000, 900_000), (1_000_000, 900_000)), 1_350_000, 2_000_000, 300_000)
    assert h["score"] == 41
    assert h["savingsRate"] == 0.1
    assert h["emergencyFundMonths"] == 1.5
    assert h["debtToIncome"] == 0.3


def test_empty_months_ignored_and_snake_case_supported():
    data = [{"income_fils": 0, "expense_fils": 0}, {"income_fils": 1_000_000, "expense_fils": 800_000}]
    h = financial_health(data, 800_000, 0, 0)
    assert h["savingsRate"] == 0.2
    assert h["emergencyFundMonths"] == 1.0  # averaged over 1 month, not 2


def test_no_data():
    h = financial_health([], 0, 0, 0)
    assert h["savingsRate"] is None and h["emergencyFundMonths"] is None and h["debtToIncome"] is None
    assert h["score"] == 30  # only the no-debt component scores
    assert any("Add a few months" in t for t in h["tips"])
    h = financial_health([], 0, 100_000, 5000)
    assert h["score"] == 0


def test_score_always_within_bounds():
    incomes = [0, 1, 500_000, 10_000_000]
    expenses = [0, 1, 400_000, 20_000_000]
    liquids = [-500_000, 0, 1_000_000, 10**10]
    mins = [0, 50_000, 10**9]
    for inc, exp, liq, mp in itertools.product(incomes, expenses, liquids, mins):
        h = financial_health(months((inc, exp)), liq, mp * 10, mp)
        assert isinstance(h["score"], int)
        assert 0 <= h["score"] <= 100
        if h["savingsRate"] is not None:
            assert 0.0 <= h["savingsRate"] <= 1.0
