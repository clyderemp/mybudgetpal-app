"""Spending anomaly detection (spec §6 anomalies.py).

Lookback = the ``lookback_months`` calendar months before ``month``. Like the forecast,
lookback months before the household's first transaction in the window are dropped;
zero months after that count as zero spend.

category_spike (needs >= 2 lookback data months), all of:
  * spend > mean + 2 * std   (population std, ddof = 0)
  * spend >= 1.2 * mean      (at least 20% above mean)
  * spend - mean >= AED 100  (10_000 fils)
large_transaction (needs >= 3 lookback expense transactions in that category):
  * amount > 3 * median of the category's lookback transaction amounts

Output: spikes first (largest excess first), then large transactions (largest first).
``baselineFils`` = rounded mean (spike) or median (large transaction).
"""

from __future__ import annotations

import statistics
from collections import defaultdict
from typing import Any, Iterable

from ._common import EXPENSE, add_months, amount, format_aed, get, month_range, parse_month, round_half_up, spending_txns, txn_month, txn_type

MIN_EXCESS_FILS = 10_000
MIN_RATIO = 1.2
STD_MULT = 2
LARGE_MULT = 3
MIN_SPIKE_MONTHS = 2
MIN_MEDIAN_SAMPLES = 3


def detect_anomalies(txns: Iterable[Any], month: str, lookback_months: int = 6) -> list[dict]:
    parse_month(month)
    window = month_range(add_months(month, -1), lookback_months) if lookback_months > 0 else []
    window_set = set(window)

    current_by_cat: dict[Any, int] = defaultdict(int)
    current_txns: list[Any] = []
    hist_by_cat: dict[Any, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    hist_amounts: dict[Any, list[int]] = defaultdict(list)
    active: set[str] = set()

    for t in spending_txns(txns):
        m = txn_month(t)
        if m in window_set:
            active.add(m)
        if txn_type(t) != EXPENSE:
            continue
        cid = get(t, "category_id")
        if m == month:
            current_by_cat[cid] += amount(t)
            current_txns.append(t)
        elif m in window_set:
            hist_by_cat[cid][m] += amount(t)
            hist_amounts[cid].append(amount(t))

    span = window[window.index(min(active)):] if active else []
    n = len(span)

    spikes: list[tuple[int, dict]] = []
    if n >= MIN_SPIKE_MONTHS:
        for cid, spend in current_by_cat.items():
            series = [hist_by_cat.get(cid, {}).get(m, 0) for m in span]
            mean = sum(series) / n
            std = statistics.pstdev(series)
            excess = spend - mean
            if spend > mean + STD_MULT * std and spend >= MIN_RATIO * mean and excess >= MIN_EXCESS_FILS:
                baseline = round_half_up(mean)
                pct = round_half_up(excess / mean * 100) if mean > 0 else None
                above = f"{pct}% above" if pct is not None else "well above"
                spikes.append((
                    spend - baseline,
                    {
                        "kind": "category_spike",
                        "categoryId": cid,
                        "transactionId": None,
                        "amountFils": spend,
                        "baselineFils": baseline,
                        "message": (
                            f"Spending of {format_aed(spend)} is {above} the "
                            f"{n}-month average of {format_aed(baseline)}."
                        ),
                    },
                ))

    large: list[dict] = []
    for t in current_txns:
        cid = get(t, "category_id")
        samples = hist_amounts.get(cid, [])
        if len(samples) < MIN_MEDIAN_SAMPLES:
            continue
        median = statistics.median(samples)
        a = amount(t)
        if a > LARGE_MULT * median:
            baseline = round_half_up(median)
            large.append({
                "kind": "large_transaction",
                "categoryId": cid,
                "transactionId": None if get(t, "id") is None else str(get(t, "id")),
                "amountFils": a,
                "baselineFils": baseline,
                "message": (
                    f"A single transaction of {format_aed(a)} is over {LARGE_MULT}x the "
                    f"usual {format_aed(baseline)} for this category."
                ),
            })

    spikes.sort(key=lambda s: (-s[0], str(s[1]["categoryId"])))
    large.sort(key=lambda x: (-x["amountFils"], str(x["categoryId"]), x["transactionId"] or ""))
    return [s for _, s in spikes] + large
