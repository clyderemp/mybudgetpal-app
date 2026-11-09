"""Next-month spending forecast (spec §6 forecast.py).

Method (per expense category, and for income):
  * Window = the ``history_months`` full calendar months before ``today``'s month.
  * Data months ``n`` = months from the first month in the window that has any
    income/expense transaction up to the last full month (zero months inside that
    span count as genuine zeros; months before the household started are dropped).
  * EWMA with alpha = 0.5, normalised weights: w_age = (1 - alpha) ** age, age 0 = most
    recent month; ewma = sum(w * x) / sum(w).
  * When n >= 4: fit sklearn LinearRegression on (0..n-1, x), predict x at n, and
    forecast = 0.5 * ewma + 0.5 * prediction. Otherwise forecast = ewma.
  * Clamp >= 0, round half-up to fils.
  * trend: direction of the (rounded) forecast vs the most recent full month ``last``
    (what the UI shows side by side): |forecast - last| < 5% of ``last`` -> "flat",
    otherwise "up"/"down". If ``last`` is 0: forecast > 0 -> "up", else "flat".
    The regression slope is NOT used for the trend (a long-run decline can coexist with
    a forecast above last month, e.g. after a one-month dip).
  * totalExpenseFils = sum of category forecasts (keeps UI totals consistent).
  * confidence: n < 3 -> "low", 3..5 -> "medium", >= 6 -> "high".

The forecast month is the calendar month after ``today``'s month.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any, Iterable

import numpy as np
from sklearn.linear_model import LinearRegression

from ._common import EXPENSE, INCOME, add_months, amount, get, month_of, month_range, round_half_up, spending_txns, txn_month, txn_type

ALPHA = 0.5
TREND_MIN_MONTHS = 4
FLAT_THRESHOLD = 0.05


def _ewma(values: list[int]) -> float:
    n = len(values)
    if n == 0:
        return 0.0
    weights = [(1 - ALPHA) ** (n - 1 - i) for i in range(n)]
    return sum(w * v for w, v in zip(weights, values)) / sum(weights)


def _slope_and_prediction(values: list[int]) -> tuple[float, float]:
    x = np.arange(len(values), dtype=float).reshape(-1, 1)
    y = np.asarray(values, dtype=float)
    model = LinearRegression().fit(x, y)
    pred = float(model.predict(np.array([[float(len(values))]]))[0])
    return float(model.coef_[0]), pred


def trend_vs_last(forecast: int, last: int) -> str:
    """"up"/"down"/"flat" of ``forecast`` vs ``last`` with a +/-5% (exclusive) flat band."""
    if last <= 0:
        return "up" if forecast > 0 else "flat"
    diff = forecast - last
    if abs(diff) < FLAT_THRESHOLD * last:
        return "flat"
    return "up" if diff > 0 else "down"


def _forecast_series(values: list[int]) -> tuple[int, str]:
    n = len(values)
    if n == 0:
        return 0, "flat"
    value = _ewma(values)
    if n >= TREND_MIN_MONTHS:
        _, pred = _slope_and_prediction(values)
        value = 0.5 * value + 0.5 * pred
    fc = max(0, round_half_up(max(0.0, value)))
    return fc, trend_vs_last(fc, values[-1])


def _confidence(n: int) -> str:
    if n < 3:
        return "low"
    if n < 6:
        return "medium"
    return "high"


def forecast_next_month(txns: Iterable[Any], today: date, history_months: int = 6) -> dict:
    current = month_of(today)
    target = add_months(current, 1)
    if history_months < 1:
        window: list[str] = []
    else:
        window = month_range(add_months(current, -1), history_months)
    window_set = set(window)

    income: dict[str, int] = defaultdict(int)
    by_cat: dict[Any, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    active: set[str] = set()
    for t in spending_txns(txns):
        m = txn_month(t)
        if m not in window_set:
            continue
        active.add(m)
        if txn_type(t) == INCOME:
            income[m] += amount(t)
        elif txn_type(t) == EXPENSE:
            by_cat[get(t, "category_id")][m] += amount(t)

    if not active:
        return {
            "month": target,
            "totalExpenseFils": 0,
            "totalIncomeFils": 0,
            "byCategory": [],
            "confidence": "low",
        }

    span = window[window.index(min(active)):]
    n = len(span)

    rows = []
    for cid, per_month in by_cat.items():
        fc, trend = _forecast_series([per_month.get(m, 0) for m in span])
        rows.append({"categoryId": cid, "forecastFils": fc, "trend": trend})
    rows.sort(key=lambda r: (-r["forecastFils"], "" if r["categoryId"] is None else str(r["categoryId"])))

    income_fc, _ = _forecast_series([income.get(m, 0) for m in span])
    return {
        "month": target,
        "totalExpenseFils": sum(r["forecastFils"] for r in rows),
        "totalIncomeFils": income_fc,
        "byCategory": rows,
        "confidence": _confidence(n),
    }
