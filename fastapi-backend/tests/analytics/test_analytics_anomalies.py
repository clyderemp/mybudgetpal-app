from datetime import date

from app.analytics.anomalies import detect_anomalies

MONTH = "2026-11"  # lookback 2026-05 .. 2026-10


def tx(y, m, amount, cat="groceries", typ="expense", tid=None, day=10):
    d = {"date": date(y, m, day), "amount_fils": amount, "type": typ, "category_id": cat, "account_id": "a"}
    if tid:
        d["id"] = tid
    return d


def history(values, cat="groceries"):
    """values for 2026-05 .. 2026-10."""
    return [tx(2026, 5 + i, v, cat=cat) for i, v in enumerate(values)]


def kinds(result):
    return [(a["kind"], a["categoryId"]) for a in result]


def test_category_spike_constant_baseline():
    # mean 100000, std 0. 125000 = 25% above, excess 25000 >= 10000 -> spike.
    txns = history([100000] * 6) + [tx(2026, 11, 125000)]
    r = detect_anomalies(txns, MONTH)
    assert kinds(r) == [("category_spike", "groceries")]
    a = r[0]
    assert a["amountFils"] == 125000 and a["baselineFils"] == 100000 and a["transactionId"] is None
    assert "25% above" in a["message"] and "AED 1,000.00" in a["message"]


def test_below_20_percent_not_flagged():
    txns = history([100000] * 6) + [tx(2026, 11, 115000)]
    assert detect_anomalies(txns, MONTH) == []


def test_below_aed_100_excess_not_flagged():
    # mean 10000 (AED 100), 15000 is 50% above but only AED 50 more.
    txns = history([10000] * 6) + [tx(2026, 11, 15000)]
    assert detect_anomalies(txns, MONTH) == []
    # AED 100 more exactly is flagged.
    txns = history([10000] * 6) + [tx(2026, 11, 20000)]
    assert kinds(detect_anomalies(txns, MONTH)) == [("category_spike", "groceries")]


def test_two_sigma_threshold():
    # 50000/150000 alternating: mean 100000, population std 50000 -> threshold 200000 (strict >).
    base = history([50000, 150000] * 3)
    assert detect_anomalies(base + [tx(2026, 11, 200000)], MONTH) == []
    r = detect_anomalies(base + [tx(2026, 11, 200001)], MONTH)
    assert kinds(r) == [("category_spike", "groceries")]


def test_new_category_is_not_a_spike():
    # No prior spend in "gifts": a first purchase is not "well above an average of AED 0".
    txns = history([100000] * 6, cat="rent") + [tx(2026, 11, 30000, cat="gifts")]
    assert detect_anomalies(txns, MONTH) == []


def test_category_with_one_prior_month_can_spike():
    txns = history([100000] * 6, cat="rent") + [tx(2026, 9, 5000, cat="gifts"), tx(2026, 11, 300000, cat="gifts")]
    r = detect_anomalies(txns, MONTH)
    assert kinds(r) == [("category_spike", "gifts")]


def test_empty_months_after_recording_stopped_are_ignored():
    # Data May..Jul only (Aug..Oct not recorded). Baseline is May..Jul (mean 100000, std 0), not
    # [x, x, x, 0, 0, 0] (mean 50000, std 50000 -> threshold 150000, which hid this +40% month).
    txns = [tx(2026, m, 100000) for m in (5, 6, 7)] + [tx(2026, 11, 140000)]
    r = detect_anomalies(txns, MONTH)
    assert kinds(r) == [("category_spike", "groceries")] and r[0]["baselineFils"] == 100000
    assert "3-month average" in r[0]["message"]


def test_needs_two_months_of_history():
    txns = [tx(2026, 10, 10000), tx(2026, 11, 900000)]
    assert detect_anomalies(txns, MONTH) == []
    assert detect_anomalies([], MONTH) == []


def test_large_transaction_over_three_times_median():
    # history amounts 1000, 2000, 3000 (+ two more 2000) -> median 2000; > 6000 flagged.
    hist = [tx(2026, 6, 1000), tx(2026, 7, 2000), tx(2026, 8, 3000), tx(2026, 9, 2000), tx(2026, 10, 2000)]
    cur = [tx(2026, 11, 6000, tid="t-eq", day=1), tx(2026, 11, 6001, tid="t-big", day=2)]
    r = detect_anomalies(hist + cur, MONTH)
    large = [a for a in r if a["kind"] == "large_transaction"]
    assert large == [{
        "kind": "large_transaction",
        "categoryId": "groceries",
        "transactionId": "t-big",
        "amountFils": 6001,
        "baselineFils": 2000,
        "message": large[0]["message"],
    }]
    assert "AED 60.01" in large[0]["message"]


def test_large_transaction_needs_three_samples():
    hist = [tx(2026, 9, 1000), tx(2026, 10, 1000)]
    r = detect_anomalies(hist + [tx(2026, 11, 50000, tid="x")], MONTH)
    assert kinds(r) == [("category_spike", "groceries")]  # spike yes, large_transaction no


def test_spikes_before_large_and_transfers_income_ignored():
    txns = history([100000] * 6) + history([100000] * 6, cat="dining")
    # 300001 > 3 x median 100000 (exactly 3x would not be flagged)
    txns += [tx(2026, 11, 300001, cat="dining", tid="d1"), tx(2026, 11, 150000, cat="groceries", tid="g1")]
    txns += [tx(2026, 11, 9_000_000, cat=None, typ="transfer"), tx(2026, 11, 9_000_000, cat="salary", typ="income")]
    r = detect_anomalies(txns, MONTH)
    assert kinds(r) == [
        ("category_spike", "dining"),
        ("category_spike", "groceries"),
        ("large_transaction", "dining"),
    ]
    assert r[2]["transactionId"] == "d1"
