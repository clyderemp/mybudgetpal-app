"""Filtered analytics for the Insights explorer (spec §6 explore).

Pure: transactions, labels and ``today`` are injected. Transfers never count as income or
spending. Every amount is integer fils.

``explore()`` returns, for the filtered transactions in [start, end]:
  * totals and the same totals for the previous range of equal length (``previous``),
  * a zero-filled series per period (day / ISO week starting Monday / calendar month), with the
    previous range aligned by position (``prevExpenseFils`` / ``prevIncomeFils``),
  * a breakdown by ``group_by`` (category, category group, account, member, merchant, weekday),
  * the same breakdown stacked over the periods (top groups + "Other"),
  * spending per weekday and per day (for the calendar heatmap), top merchants, largest items,
  * a forecast for the next ``horizon`` periods (see ``project``) and the pace of the current
    period when the range runs into today.
"""

from __future__ import annotations

import datetime as dt
import math
from collections import defaultdict
from typing import Any, Callable, Iterable

import numpy as np

from ._common import EXPENSE, INCOME, amount, get, round_half_up, txn_date, txn_type

GRANULARITIES = ("day", "week", "month")
GROUP_BYS = ("category", "group", "account", "member", "merchant", "weekday")
WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
STACK_TOP = 6
FORECAST_MIN_PERIODS = 3
FORECAST_MAX_HISTORY = 12
Z80 = 1.2816  # two-sided 80% band


# ---------------------------------------------------------------- periods


def auto_granularity(start: dt.date, end: dt.date) -> str:
    days = (end - start).days + 1
    if days <= 45:
        return "day"
    if days <= 200:
        return "week"
    return "month"


def period_start(d: dt.date, gran: str) -> dt.date:
    if gran == "day":
        return d
    if gran == "week":
        return d - dt.timedelta(days=d.weekday())
    return d.replace(day=1)


def next_period(p: dt.date, gran: str) -> dt.date:
    if gran == "day":
        return p + dt.timedelta(days=1)
    if gran == "week":
        return p + dt.timedelta(days=7)
    return (p.replace(day=28) + dt.timedelta(days=4)).replace(day=1)


def periods_between(start: dt.date, end: dt.date, gran: str) -> list[dt.date]:
    out, p = [], period_start(start, gran)
    while p <= end:
        out.append(p)
        p = next_period(p, gran)
    return out


def period_key(p: dt.date, gran: str) -> str:
    return p.isoformat()[:7] if gran == "month" else p.isoformat()


# ---------------------------------------------------------------- filtering


def apply_filters(
    txns: Iterable[Any],
    *,
    category_ids: set[str] | None = None,
    account_ids: set[str] | None = None,
    member_ids: set[str] | None = None,
    merchant: str | None = None,
) -> list[Any]:
    """Income/expense transactions matching every given filter (transfers dropped).

    ``category_ids`` may contain "none" for uncategorised items.
    """
    needle = (merchant or "").strip().casefold()
    out = []
    for t in txns:
        if txn_type(t) not in (INCOME, EXPENSE):
            continue
        if category_ids and (get(t, "category_id") or "none") not in category_ids:
            continue
        if account_ids and str(get(t, "account_id")) not in account_ids:
            continue
        if member_ids and str(get(t, "created_by") or "") not in member_ids:
            continue
        if needle and needle not in (get(t, "merchant") or "").casefold():
            continue
        out.append(t)
    return out


# ---------------------------------------------------------------- totals


def _totals(txns: list[Any], days: int) -> dict[str, Any]:
    inc = sum(amount(t) for t in txns if txn_type(t) == INCOME)
    exp = sum(amount(t) for t in txns if txn_type(t) == EXPENSE)
    n_exp = sum(1 for t in txns if txn_type(t) == EXPENSE)
    return {
        "incomeFils": inc,
        "expenseFils": exp,
        "netFils": inc - exp,
        "count": len(txns),
        "expenseCount": n_exp,
        "savingsRate": round((inc - exp) / inc, 4) if inc > 0 else None,
        "avgDailyExpenseFils": round_half_up(exp / days) if days > 0 else 0,
        "avgExpenseFils": round_half_up(exp / n_exp) if n_exp else 0,
    }


# ---------------------------------------------------------------- forecast


def _ewma(values: list[float], alpha: float = 0.5) -> float:
    w = [(1 - alpha) ** (len(values) - 1 - i) for i in range(len(values))]
    return sum(a * b for a, b in zip(w, values)) / sum(w)


def project(values: list[int], horizon: int) -> list[dict[str, int]] | None:
    """Forecast ``horizon`` values after ``values`` (complete periods, oldest first).

    Leading and trailing zero periods are dropped (before recording began / after it stopped:
    a gap in record-keeping never reads as "spending fell to zero"). Needs >= 3 periods.
    Point = 0.5 * EWMA(alpha 0.5) + 0.5 * max(0, linear trend extrapolation) (the monthly
    forecast's blend, with the trend floored so a decline can't project to zero). Band = point +/- z80 * residual std * sqrt(h), where the
    residuals are of the linear fit (min 10% of the mean so a perfectly flat history still shows
    uncertainty).
    """
    first = next((i for i, v in enumerate(values) if v), None)
    if first is None:
        return None
    last = max(i for i, v in enumerate(values) if v)
    vals = [float(v) for v in values[first : last + 1]][-FORECAST_MAX_HISTORY:]
    n = len(vals)
    if n < FORECAST_MIN_PERIODS or horizon < 1:
        return None
    x = np.arange(n, dtype=float)
    slope, intercept = np.polyfit(x, vals, 1)
    resid = np.asarray(vals) - (slope * x + intercept)
    sd = max(float(np.std(resid, ddof=1)) if n > 2 else 0.0, 0.1 * float(np.mean(vals)))
    level = _ewma(vals)
    out = []
    for h in range(1, horizon + 1):
        # A falling trend is floored at zero before blending, so a few low months can't
        # extrapolate the forecast to nothing; the EWMA half keeps it anchored to recent levels.
        trend = max(0.0, slope * (n - 1 + h) + intercept)
        point = 0.5 * level + 0.5 * trend
        spread = Z80 * sd * math.sqrt(h)
        out.append(
            {
                "fils": round_half_up(point),
                "lowFils": round_half_up(max(0.0, point - spread)),
                "highFils": round_half_up(point + spread),
            }
        )
    return out


# ---------------------------------------------------------------- explore


def explore(
    txns: list[Any],
    prev_txns: list[Any],
    start: dt.date,
    end: dt.date,
    today: dt.date,
    *,
    granularity: str | None = None,
    group_by: str = "category",
    flow: str = EXPENSE,
    horizon: int = 3,
    history: list[Any] | None = None,
    labels: dict[str, Callable[[Any], str]] | None = None,
) -> dict[str, Any]:
    """See module docstring. ``txns``/``prev_txns``/``history`` must already be filtered.

    ``history``: filtered transactions for the forecast window (complete periods before the
    current one); defaults to ``txns``. ``labels`` maps group_by -> key -> display label.
    ``flow`` ("expense" | "income") picks what the breakdown, stack and heatmap measure.
    """
    gran = granularity if granularity in GRANULARITIES else auto_granularity(start, end)
    days = (end - start).days + 1
    prev_end = start - dt.timedelta(days=1)
    prev_start = prev_end - dt.timedelta(days=days - 1)
    labels = labels or {}

    periods = periods_between(start, end, gran)
    prev_periods = periods_between(prev_start, prev_end, gran)
    idx = {p: i for i, p in enumerate(periods)}
    pidx = {p: i for i, p in enumerate(prev_periods)}
    inc = [0] * len(periods)
    exp = [0] * len(periods)
    cnt = [0] * len(periods)
    pinc = [0] * len(prev_periods)
    pexp = [0] * len(prev_periods)
    for t in txns:
        i = idx.get(period_start(txn_date(t), gran))
        if i is None:
            continue
        cnt[i] += 1
        if txn_type(t) == INCOME:
            inc[i] += amount(t)
        else:
            exp[i] += amount(t)
    for t in prev_txns:
        i = pidx.get(period_start(txn_date(t), gran))
        if i is None:
            continue
        if txn_type(t) == INCOME:
            pinc[i] += amount(t)
        else:
            pexp[i] += amount(t)

    series, running = [], 0
    for i, p in enumerate(periods):
        running += inc[i] - exp[i]
        last_day = min(next_period(p, gran) - dt.timedelta(days=1), end)
        series.append(
            {
                "period": period_key(p, gran),
                "start": max(p, start).isoformat(),
                "end": last_day.isoformat(),
                "incomeFils": inc[i],
                "expenseFils": exp[i],
                "netFils": inc[i] - exp[i],
                "count": cnt[i],
                "cumulativeNetFils": running,
                "prevIncomeFils": pinc[i] if i < len(pinc) else None,
                "prevExpenseFils": pexp[i] if i < len(pexp) else None,
                "partial": p < start or next_period(p, gran) - dt.timedelta(days=1) > end or last_day >= today,
            }
        )

    flow_txns = [t for t in txns if txn_type(t) == flow]
    flow_total = sum(amount(t) for t in flow_txns)

    # --- breakdown
    def key_of(t: Any) -> str:
        if group_by == "category":
            return get(t, "category_id") or "none"
        if group_by == "group":
            return labels.get("category_group", lambda _k: "other")(get(t, "category_id") or "none")
        if group_by == "account":
            return str(get(t, "account_id"))
        if group_by == "member":
            return str(get(t, "created_by") or "unknown")
        if group_by == "merchant":
            m = (get(t, "merchant") or "").strip()
            return m.casefold() if m else "none"
        return str(txn_date(t).weekday())

    merchant_names: dict[str, str] = {}
    sums: dict[str, int] = defaultdict(int)
    counts: dict[str, int] = defaultdict(int)
    by_period_key: dict[str, list[int]] = defaultdict(lambda: [0] * len(periods))
    for t in flow_txns:
        k = key_of(t)
        if group_by == "merchant" and k != "none":
            merchant_names.setdefault(k, (get(t, "merchant") or "").strip())
        sums[k] += amount(t)
        counts[k] += 1
        i = idx.get(period_start(txn_date(t), gran))
        if i is not None:
            by_period_key[k][i] += amount(t)

    label_fn = labels.get(group_by)

    def label(k: str) -> str:
        if group_by == "weekday":
            return WEEKDAYS[int(k)]
        if group_by == "merchant":
            return merchant_names.get(k, "No merchant")
        return label_fn(k) if label_fn else k

    order = sorted(sums, key=lambda k: (-sums[k], label(k)))
    if group_by == "weekday":
        order = sorted(sums, key=int)
    breakdown = [
        {
            "key": k,
            "label": label(k),
            "fils": sums[k],
            "count": counts[k],
            "share": round(sums[k] / flow_total, 4) if flow_total else 0.0,
            "avgFils": round_half_up(sums[k] / counts[k]),
        }
        for k in order
    ]

    ranked = sorted(sums, key=lambda k: (-sums[k], label(k)))
    top = ranked[:STACK_TOP] if len(ranked) <= STACK_TOP + 1 else ranked[: STACK_TOP]
    rest = [k for k in ranked if k not in top]
    stack_keys = [{"key": k, "label": label(k)} for k in top]
    if rest:
        stack_keys.append({"key": "__other", "label": f"Other ({len(rest)})"})
    stacked = []
    for i, p in enumerate(periods):
        values = {k: by_period_key[k][i] for k in top}
        if rest:
            values["__other"] = sum(by_period_key[k][i] for k in rest)
        stacked.append({"period": period_key(p, gran), "values": values})

    # --- weekday + daily (always over the chosen flow)
    weekday = [{"weekday": d, "label": WEEKDAYS[d], "fils": 0, "count": 0} for d in range(7)]
    daily: dict[str, int] = defaultdict(int)
    for t in flow_txns:
        d = txn_date(t)
        weekday[d.weekday()]["fils"] += amount(t)
        weekday[d.weekday()]["count"] += 1
        daily[d.isoformat()] += amount(t)
    n_weekday = [0] * 7
    d = start
    while d <= end:
        n_weekday[d.weekday()] += 1
        d += dt.timedelta(days=1)
    for w in weekday:
        n = n_weekday[w["weekday"]]
        w["avgFils"] = round_half_up(w["fils"] / n) if n else 0

    # --- merchants + largest
    merch: dict[str, dict[str, Any]] = {}
    for t in flow_txns:
        m = (get(t, "merchant") or "").strip()
        if not m:
            continue
        row = merch.setdefault(m.casefold(), {"merchant": m, "fils": 0, "count": 0})
        row["fils"] += amount(t)
        row["count"] += 1
    top_merchants = sorted(merch.values(), key=lambda r: (-r["fils"], r["merchant"]))[:10]
    largest = [
        {
            "id": str(get(t, "id")),
            "date": txn_date(t).isoformat(),
            "fils": amount(t),
            "merchant": get(t, "merchant"),
            "categoryId": get(t, "category_id"),
        }
        for t in sorted(flow_txns, key=lambda t: (-amount(t), txn_date(t)))[:8]
    ]

    # --- forecast: complete periods only, ending before the current one
    cur = period_start(today, gran)
    hist = history if history is not None else txns
    hist_periods = periods_between(min([txn_date(t) for t in hist], default=cur), cur - dt.timedelta(days=1), gran)
    hist_periods = [p for p in hist_periods if p < cur][-FORECAST_MAX_HISTORY:]
    hidx = {p: i for i, p in enumerate(hist_periods)}
    hexp = [0] * len(hist_periods)
    hinc = [0] * len(hist_periods)
    for t in hist:
        i = hidx.get(period_start(txn_date(t), gran))
        if i is None:
            continue
        if txn_type(t) == INCOME:
            hinc[i] += amount(t)
        else:
            hexp[i] += amount(t)
    fexp, finc = project(hexp, horizon), project(hinc, horizon)
    forecast_points = []
    if fexp or finc:
        p = cur
        for h in range(horizon):
            e = fexp[h] if fexp else None
            n_ = finc[h] if finc else None
            forecast_points.append(
                {
                    "period": period_key(p, gran),
                    "expenseFils": e["fils"] if e else None,
                    "expenseLowFils": e["lowFils"] if e else None,
                    "expenseHighFils": e["highFils"] if e else None,
                    "incomeFils": n_["fils"] if n_ else None,
                    "incomeLowFils": n_["lowFils"] if n_ else None,
                    "incomeHighFils": n_["highFils"] if n_ else None,
                }
            )
            p = next_period(p, gran)
    active = [i for i, (e, n_) in enumerate(zip(hexp, hinc)) if e or n_]
    n_hist = len(active)
    # Stale: nothing recorded in the latest complete period, so the forecast rests on old history.
    stale = bool(active) and active[-1] != len(hist_periods) - 1
    confidence = "low" if stale else "high" if n_hist >= 6 else "medium" if n_hist >= 4 else "low"
    last_data = period_key(hist_periods[active[-1]], gran) if active else None

    # pace of the current period (only when the range includes today)
    pace = None
    if start <= today <= end:
        p_end = next_period(cur, gran) - dt.timedelta(days=1)
        total_days = (p_end - cur).days + 1
        elapsed = (today - cur).days + 1
        so_far = sum(amount(t) for t in txns if txn_type(t) == EXPENSE and cur <= txn_date(t) <= today)
        pace = {
            "period": period_key(cur, gran),
            "spentFils": so_far,
            "elapsedDays": elapsed,
            "totalDays": total_days,
            "projectedFils": round_half_up(so_far * total_days / elapsed) if elapsed else so_far,
            "forecastFils": forecast_points[0]["expenseFils"] if forecast_points else None,
        }

    return {
        "range": {"from": start.isoformat(), "to": end.isoformat(), "days": days},
        "previousRange": {"from": prev_start.isoformat(), "to": prev_end.isoformat()},
        "granularity": gran,
        "groupBy": group_by,
        "flow": flow,
        "totals": _totals(txns, days),
        "previous": _totals(prev_txns, days),
        "series": series,
        "breakdown": breakdown,
        "stackKeys": stack_keys,
        "stacked": stacked,
        "weekday": weekday,
        "daily": [{"date": k, "fils": v} for k, v in sorted(daily.items())],
        "topMerchants": top_merchants,
        "largest": largest,
        "forecast": {
            "points": forecast_points,
            "confidence": confidence,
            "basedOnPeriods": n_hist,
            "stale": stale,
            "lastDataPeriod": last_data,
        },
        "pace": pace,
    }
