from datetime import date

from app.analytics.forecast import forecast_next_month, trend_vs_last

TODAY = date(2026, 11, 8)  # full months before today: 2026-05 .. 2026-10


def tx(y, m, amount, typ="expense", cat="groceries"):
    return {"date": date(y, m, 15), "amount_fils": amount, "type": typ, "category_id": cat, "account_id": "a"}


def series(values, cat="groceries", end=(2026, 10)):
    """Monthly expenses ending at ``end`` (oldest first)."""
    y, m = end
    out = []
    for i, v in enumerate(reversed(values)):
        idx = y * 12 + (m - 1) - i
        out.append(tx(idx // 12, idx % 12 + 1, v, cat=cat))
    return out


def test_zero_data():
    f = forecast_next_month([], TODAY)
    assert f == {"month": "2026-12", "totalExpenseFils": 0, "totalIncomeFils": 0, "byCategory": [], "confidence": "low"}


def test_only_current_month_and_transfers_is_zero_data():
    txns = [tx(2026, 11, 5000), {"date": date(2026, 10, 1), "amount_fils": 9999, "type": "transfer", "category_id": None, "account_id": "a"}]
    f = forecast_next_month(txns, TODAY)
    assert f["byCategory"] == [] and f["confidence"] == "low"


def test_two_months_ewma_only_low_confidence():
    # Sep 100000, Oct 200000. Weights: Oct 1, Sep 0.5 -> (200000 + 50000) / 1.5 = 166666.67 -> 166667.
    # n = 2 < 4 so no trend blend; trend = forecast vs last month: 166667 vs 200000 (-16.7%) -> "down".
    f = forecast_next_month(series([100000, 200000]), TODAY)
    assert f["byCategory"] == [{"categoryId": "groceries", "forecastFils": 166667, "trend": "down"}]
    assert f["totalExpenseFils"] == 166667
    assert f["confidence"] == "low"


def test_three_months_medium():
    f = forecast_next_month(series([100000, 100000, 100000]), TODAY)
    assert f["confidence"] == "medium"
    assert f["byCategory"][0] == {"categoryId": "groceries", "forecastFils": 100000, "trend": "flat"}


def test_six_months_linear_blend_high():
    # 10000..60000. EWMA weights (newest first) 1, .5, .25, .125, .0625, .03125 (sum 1.96875):
    # 60000 + 25000 + 10000 + 3750 + 1250 + 312.5 = 100312.5 -> / 1.96875 = 50952.381
    # Linear fit is exact: prediction at x=6 = 70000. Blend (50952.381 + 70000) / 2 = 60476.19 -> 60476.
    # Trend: 60476 vs last month 60000 = +0.8% -> inside the 5% band -> "flat".
    f = forecast_next_month(series([10000, 20000, 30000, 40000, 50000, 60000]), TODAY)
    assert f["confidence"] == "high"
    assert f["byCategory"] == [{"categoryId": "groceries", "forecastFils": 60476, "trend": "flat"}]


def test_downtrend_clamped_at_zero():
    # EWMA = 17812.5 / 1.96875 = 9047.62; prediction = -10000; blend = -476 -> clamp 0.
    # Trend: forecast 0 vs last month 0 -> "flat".
    f = forecast_next_month(series([50000, 40000, 30000, 20000, 10000, 0]), TODAY)
    assert f["byCategory"] == [{"categoryId": "groceries", "forecastFils": 0, "trend": "flat"}]
    assert f["totalExpenseFils"] == 0


def test_data_span_starts_at_first_active_month():
    # Household started in Sep: window has 6 months but only 2 count -> low confidence and the
    # four empty months before do not dilute the average.
    f = forecast_next_month(series([80000, 80000]), TODAY)
    assert f["confidence"] == "low"
    assert f["byCategory"][0]["forecastFils"] == 80000


def test_zero_months_inside_span_count_and_history_cap():
    # 8 months of history but only the last 6 (May..Oct) are used -> high.
    txns = series([999999, 999999, 0, 0, 0, 0, 0, 60000])
    f = forecast_next_month(txns, TODAY)
    assert f["confidence"] == "high"
    # Only Oct has spend among May..Oct: EWMA = 60000 / 1.96875 = 30476.19;
    # LinearRegression on [0,0,0,0,0,60000]: slope = 60000*(5-2.5)/17.5 = 8571.43,
    # intercept = 10000 - 8571.43*2.5 = -11428.57, pred(6) = 40000.0 -> blend 35238.10 -> 35238.
    assert f["byCategory"][0]["forecastFils"] == 35238


def test_income_and_multiple_categories_sorted():
    txns = series([50000] * 3, cat="fuel") + series([150000] * 3, cat="rent")
    txns += [tx(2026, mo, 1_000_000, typ="income", cat="salary") for mo in (8, 9, 10)]
    f = forecast_next_month(txns, TODAY)
    assert [c["categoryId"] for c in f["byCategory"]] == ["rent", "fuel"]
    assert f["totalExpenseFils"] == 200000
    assert f["totalIncomeFils"] == 1_000_000
    assert f["month"] == "2026-12"


def test_december_rolls_to_next_year():
    f = forecast_next_month(series([1000], end=(2026, 11)), date(2026, 12, 31))
    assert f["month"] == "2027-01"
    assert f["byCategory"][0]["forecastFils"] == 1000


def test_trend_up_vs_last_month_despite_negative_slope():
    # Seeded "Shopping" shape: forecast above last month while the long-run slope is negative.
    # [200000 x5, 100000]: EWMA = (100000 + 200000 * 0.96875) / 1.96875 = 149206.35.
    # Fit: mean 183333.33, slope = -250000 / 17.5 = -14285.71, pred(6) = 183333.33 - 3.5 * 14285.71
    # = 133333.33. Blend = 141269.84 -> 141270 vs last 100000 (+41%) -> "up" (slope said "down").
    f = forecast_next_month(series([200000, 200000, 200000, 200000, 200000, 100000]), TODAY)
    assert f["byCategory"] == [{"categoryId": "groceries", "forecastFils": 141270, "trend": "up"}]


def test_trend_down_vs_last_month_despite_positive_slope():
    # [100000 x5, 300000]: EWMA = (300000 + 96875) / 1.96875 = 201587.30; slope = 500000 / 17.5
    # = 28571.43, pred(6) = 133333.33 + 3.5 * 28571.43 = 233333.33 -> blend 217460.32 -> 217460
    # vs last 300000 (-27.5%) -> "down".
    f = forecast_next_month(series([100000, 100000, 100000, 100000, 100000, 300000]), TODAY)
    assert f["byCategory"] == [{"categoryId": "groceries", "forecastFils": 217460, "trend": "down"}]


def test_trend_flat_band_edges():
    assert trend_vs_last(104_999, 100_000) == "flat"
    assert trend_vs_last(95_001, 100_000) == "flat"
    assert trend_vs_last(105_000, 100_000) == "up"
    assert trend_vs_last(95_000, 100_000) == "down"
    assert trend_vs_last(136_400, 103_800) == "up"  # AED 1,364 vs 1,038
    assert trend_vs_last(1, 0) == "up"
    assert trend_vs_last(0, 0) == "flat"
    assert trend_vs_last(0, 50_000) == "down"


def test_history_that_stopped_is_not_read_as_zero_and_is_low_confidence():
    # Recorded May..Jul (100000/month), nothing Aug..Oct: the forecast uses May..Jul, not
    # [x, x, x, 0, 0, 0] (which used to clamp to 0 with "high" confidence).
    f = forecast_next_month(series([100000, 100000, 100000], end=(2026, 7)), TODAY)
    assert f["byCategory"][0]["forecastFils"] == 100000
    assert f["confidence"] == "low"
