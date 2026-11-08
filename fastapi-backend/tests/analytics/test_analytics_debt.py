from app.analytics.debt import compare_strategies, monthly_interest, simulate_payoff

# Worked example used throughout.
#   A: 1,000.00 AED (100000 fils), APR 24% (2400 bps -> 2%/month), min 100.00 (10000)
#   B:   500.00 AED  (50000 fils), APR 12% (1200 bps -> 1%/month), min  50.00  (5000)
#   Budget 300.00 AED/month (30000 fils) -> 15000 extra after minimums.
DEBTS = [
    {"id": "A", "name": "Card", "balance_fils": 100000, "apr_bps": 2400, "min_payment_fils": 10000},
    {"id": "B", "name": "Loan", "balance_fils": 50000, "apr_bps": 1200, "min_payment_fils": 5000},
]


def _rows(result):
    return [
        (s["month"], {p["debtId"]: (p["interestFils"], p["paymentFils"], p["balanceFils"]) for p in s["payments"]}, s["totalBalanceFils"])
        for s in result["schedule"]
    ]


def test_monthly_interest_half_up():
    assert monthly_interest(100000, 2400) == 2000
    assert monthly_interest(53540, 2400) == 1071  # 1070.80 -> 1071
    assert monthly_interest(40955, 1200) == 410  # 409.55 -> 410 (half-up)
    assert monthly_interest(250, 1200) == 3  # exactly 2.5 -> 3 (banker's would give 2)
    assert monthly_interest(50, 1200) == 1  # exactly 0.5 -> 1
    assert monthly_interest(0, 2400) == 0
    assert monthly_interest(1000, 0) == 0


def test_avalanche_worked_example():
    # Avalanche target: A (24% > 12%). Per month: interest added, minimums paid, extra -> target.
    # M1 2026-01: A 100000+2000=102000 -10000 -15000 = 77000 (paid 25000)
    #             B  50000+ 500= 50500 - 5000        = 45500 (paid  5000)   total 122500
    # M2 2026-02: A 77000*2%=1540 -> 78540 -25000 = 53540
    #             B 45500*1%= 455 -> 45955 - 5000 = 40955                    total  94495
    # M3 2026-03: A 53540*2%=1070.80->1071 -> 54611 -25000 = 29611
    #             B 40955*1%= 409.55->410  -> 41365 - 5000 = 36365           total  65976
    # M4 2026-04: A 29611*2%= 592.22->592  -> 30203 -25000 =  5203
    #             B 36365*1%= 363.65->364  -> 36729 - 5000 = 31729           total  36932
    # M5 2026-05: A  5203*2%= 104.06->104  ->  5307, min capped -> pays 5307 -> 0 (paid off)
    #             B 31729*1%= 317.29->317  -> 32046 - 5000 = 27046; leftover 30000-5307-5000=19693
    #             -> B 27046-19693 = 7353 (paid 24693)                       total   7353
    # M6 2026-06: B 7353*1%=73.53->74 -> 7427, pays 7427 -> 0                total      0
    # Interest A = 2000+1540+1071+592+104 = 5307; B = 500+455+410+364+317+74 = 2120; total 7427
    # Paid = 5*30000 + 7427 = 157427 = 150000 principal + 7427 interest.
    r = simulate_payoff(DEBTS, 30000, "avalanche", "2026-01")
    assert r["feasible"] is True
    assert r["strategy"] == "avalanche"
    assert r["order"] == ["A", "B"]
    assert _rows(r) == [
        ("2026-01", {"A": (2000, 25000, 77000), "B": (500, 5000, 45500)}, 122500),
        ("2026-02", {"A": (1540, 25000, 53540), "B": (455, 5000, 40955)}, 94495),
        ("2026-03", {"A": (1071, 25000, 29611), "B": (410, 5000, 36365)}, 65976),
        ("2026-04", {"A": (592, 25000, 5203), "B": (364, 5000, 31729)}, 36932),
        ("2026-05", {"A": (104, 5307, 0), "B": (317, 24693, 7353)}, 7353),
        ("2026-06", {"B": (74, 7427, 0)}, 0),
    ]
    assert r["months"] == 6
    assert r["debtFreeMonth"] == "2026-06"
    assert r["totalInterestFils"] == 7427
    assert r["totalPaidFils"] == 157427
    assert r["perDebt"] == [
        {"debtId": "A", "payoffMonth": "2026-05", "interestFils": 5307},
        {"debtId": "B", "payoffMonth": "2026-06", "interestFils": 2120},
    ]


def test_snowball_worked_example():
    # Snowball target: B (smallest balance).
    # M1: A 102000-10000 = 92000;          B 50500-5000-15000 = 30500         total 122500
    # M2: A 92000*2%=1840 -> 93840-10000 = 83840; B 30500*1%=305 -> 30805-20000 = 10805   total 94645
    # M3: A 83840*2%=1676.80->1677 -> 85517-10000 = 75517
    #     B 10805*1%=108.05->108 -> 10913, pays all 10913 -> 0; leftover 30000-10000-10913 = 9087
    #     -> A 75517-9087 = 66430 (paid 19087)                                total 66430
    # M4: A 66430*2%=1328.60->1329 -> 67759-30000 = 37759
    # M5: A 37759*2%= 755.18-> 755 -> 38514-30000 =  8514
    # M6: A  8514*2%= 170.28-> 170 ->  8684, pays 8684 -> 0
    # Interest A = 2000+1840+1677+1329+755+170 = 7771; B = 500+305+108 = 913; total 8684
    # Paid = 5*30000 + 8684 = 158684.
    r = simulate_payoff(DEBTS, 30000, "snowball", "2026-01")
    assert r["order"] == ["B", "A"]
    assert _rows(r) == [
        ("2026-01", {"A": (2000, 10000, 92000), "B": (500, 20000, 30500)}, 122500),
        ("2026-02", {"A": (1840, 10000, 83840), "B": (305, 20000, 10805)}, 94645),
        ("2026-03", {"A": (1677, 19087, 66430), "B": (108, 10913, 0)}, 66430),
        ("2026-04", {"A": (1329, 30000, 37759)}, 37759),
        ("2026-05", {"A": (755, 30000, 8514)}, 8514),
        ("2026-06", {"A": (170, 8684, 0)}, 0),
    ]
    assert r["months"] == 6
    assert r["totalInterestFils"] == 8684
    assert r["totalPaidFils"] == 158684
    assert r["perDebt"] == [
        {"debtId": "B", "payoffMonth": "2026-03", "interestFils": 913},
        {"debtId": "A", "payoffMonth": "2026-06", "interestFils": 7771},
    ]


def test_compare_strategies():
    c = compare_strategies(DEBTS, 30000, "2026-01")
    assert c["avalanche"]["totalInterestFils"] == 7427
    assert c["snowball"]["totalInterestFils"] == 8684
    assert c["interestSavedFils"] == 1257
    assert c["monthsSaved"] == 0


def test_compare_infeasible_gives_none():
    c = compare_strategies(DEBTS, 1000, "2026-01")
    assert c["interestSavedFils"] is None and c["monthsSaved"] is None


def test_avalanche_tie_breaks_on_smallest_balance():
    debts = [
        {"id": "big", "name": "x", "balance_fils": 90000, "apr_bps": 2000, "min_payment_fils": 1000},
        {"id": "small", "name": "y", "balance_fils": 10000, "apr_bps": 2000, "min_payment_fils": 1000},
        {"id": "low", "name": "z", "balance_fils": 5000, "apr_bps": 500, "min_payment_fils": 1000},
    ]
    assert simulate_payoff(debts, 20000, "avalanche", "2026-01")["order"] == ["small", "big", "low"]


def test_snowball_tie_breaks_on_highest_apr():
    debts = [
        {"id": "cheap", "name": "x", "balance_fils": 10000, "apr_bps": 500, "min_payment_fils": 1000},
        {"id": "dear", "name": "y", "balance_fils": 10000, "apr_bps": 3000, "min_payment_fils": 1000},
        {"id": "huge", "name": "z", "balance_fils": 80000, "apr_bps": 4000, "min_payment_fils": 1000},
    ]
    assert simulate_payoff(debts, 20000, "snowball", "2026-01")["order"] == ["dear", "cheap", "huge"]


def test_full_tie_keeps_input_order():
    debts = [
        {"id": "first", "name": "x", "balance_fils": 10000, "apr_bps": 1000, "min_payment_fils": 0},
        {"id": "second", "name": "y", "balance_fils": 10000, "apr_bps": 1000, "min_payment_fils": 0},
    ]
    for s in ("avalanche", "snowball"):
        assert simulate_payoff(debts, 5000, s, "2026-01")["order"] == ["first", "second"]


def test_budget_below_minimums():
    r = simulate_payoff(DEBTS, 14000, "avalanche", "2026-01")
    assert r["feasible"] is False
    assert r["reason"] == "budget_below_minimums"
    assert r["shortfallFils"] == 1000  # 10000 + 5000 - 14000
    assert r["schedule"] == [] and r["months"] is None


def test_negative_amortization():
    # 36% APR on 1,000,000 fils -> 30000 interest/month; budget = minimum = 20000 < interest.
    debts = [{"id": "x", "name": "x", "balance_fils": 1_000_000, "apr_bps": 3600, "min_payment_fils": 20000}]
    r = simulate_payoff(debts, 20000, "avalanche", "2026-01")
    assert r["feasible"] is False
    assert r["reason"] == "negative_amortization"
    assert r["debtIds"] == ["x"]


def test_payment_equal_to_interest_is_negative_amortization():
    debts = [{"id": "x", "name": "x", "balance_fils": 1_000_000, "apr_bps": 1200, "min_payment_fils": 10000}]
    r = simulate_payoff(debts, 10000, "snowball", "2026-01")  # interest exactly 10000
    assert r["feasible"] is False and r["reason"] == "negative_amortization"


def test_max_months_exceeded_reports_negative_amortization():
    debts = [{"id": "x", "name": "x", "balance_fils": 1_000_000, "apr_bps": 0, "min_payment_fils": 100}]
    r = simulate_payoff(debts, 100, "avalanche", "2026-01", max_months=12)
    assert r["feasible"] is False and r["reason"] == "negative_amortization"


def test_no_debts_and_zero_balances():
    r = simulate_payoff([{"id": "p", "name": "paid", "balance_fils": 0, "apr_bps": 2000, "min_payment_fils": 500}], 0, "avalanche", "2026-01")
    assert r["feasible"] is True
    assert r["months"] == 0 and r["schedule"] == [] and r["totalInterestFils"] == 0


def test_zero_apr_exact_months_and_year_rollover():
    debts = [{"id": "x", "name": "x", "balance_fils": 30000, "apr_bps": 0, "min_payment_fils": 1000}]
    r = simulate_payoff(debts, 10000, "snowball", "2026-11")
    assert r["months"] == 3
    assert [s["month"] for s in r["schedule"]] == ["2026-11", "2026-12", "2027-01"]
    assert r["debtFreeMonth"] == "2027-01"
    assert r["totalInterestFils"] == 0 and r["totalPaidFils"] == 30000


def test_invariants_paid_equals_principal_plus_interest():
    debts = [
        {"id": "a", "name": "a", "balance_fils": 1_234_567, "apr_bps": 2999, "min_payment_fils": 37037},
        {"id": "b", "name": "b", "balance_fils": 456_789, "apr_bps": 1899, "min_payment_fils": 12000},
        {"id": "c", "name": "c", "balance_fils": 99_999, "apr_bps": 0, "min_payment_fils": 5000},
    ]
    for s in ("avalanche", "snowball"):
        r = simulate_payoff(debts, 150000, s, "2026-01")
        assert r["feasible"]
        principal = sum(d["balance_fils"] for d in debts)
        assert r["totalPaidFils"] == principal + r["totalInterestFils"]
        assert all(st["totalBalanceFils"] >= 0 for st in r["schedule"])
        # Every full month uses the whole budget.
        for st in r["schedule"][:-1]:
            assert sum(p["paymentFils"] for p in st["payments"]) == 150000
    c = compare_strategies(debts, 150000, "2026-01")
    assert c["interestSavedFils"] >= 0
