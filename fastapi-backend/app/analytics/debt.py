"""Debt payoff simulation (spec §6 debt.py). Integer fils throughout.

Each simulated month (first month = ``start_month``):
  1. interest_i = round_half_up(balance_i * apr_bps_i / 120_000), added to the balance;
  2. each debt is paid min(min_payment_i, balance_i);
  3. the leftover budget goes to debts in strategy priority order (fixed at the start):
       avalanche: highest APR first, tie -> smallest balance, tie -> input order;
       snowball:  smallest balance first, tie -> highest APR, tie -> input order;
     money freed by paid-off debts (including their minimums) rolls to the next target.

Infeasible:
  * sum(min(min_payment, balance)) > budget -> reason "budget_below_minimums" + shortfallFils.
  * the total balance does not shrink in some month (payments <= interest), or the
    simulation exceeds ``max_months`` -> reason "negative_amortization" + debtIds
    (debts whose own payment that month did not exceed their interest).

``order`` is the strategy priority order. Debts with balance <= 0 are ignored.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Iterable

from ._common import add_months, get, parse_month, round_half_up

STRATEGIES = ("avalanche", "snowball")


def monthly_interest(balance_fils: int, apr_bps: int) -> int:
    """balance * (apr_bps / 10_000) / 12, rounded half-up to whole fils."""
    if balance_fils <= 0 or apr_bps <= 0:
        return 0
    return round_half_up(Decimal(balance_fils) * Decimal(apr_bps) / Decimal(120_000))


def _normalise(debts: Iterable[Any]) -> list[dict]:
    out = []
    for idx, d in enumerate(debts):
        bal = int(get(d, "balance_fils"))
        if bal <= 0:
            continue
        out.append({
            "id": str(get(d, "id")),
            "name": get(d, "name"),
            "balance": bal,
            "apr": int(get(d, "apr_bps") or 0),
            "min": max(0, int(get(d, "min_payment_fils") or 0)),
            "idx": idx,
        })
    return out


def _priority(debts: list[dict], strategy: str) -> list[dict]:
    if strategy == "avalanche":
        key = lambda d: (-d["apr"], d["balance"], d["idx"])  # noqa: E731
    else:
        key = lambda d: (d["balance"], -d["apr"], d["idx"])  # noqa: E731
    return sorted(debts, key=key)


def _infeasible(strategy: str, reason: str, **extra: Any) -> dict:
    return {
        "feasible": False,
        "reason": reason,
        "strategy": strategy,
        "months": None,
        "debtFreeMonth": None,
        "totalInterestFils": None,
        "totalPaidFils": None,
        "order": [],
        "schedule": [],
        "perDebt": [],
        **extra,
    }


def simulate_payoff(
    debts: list[Any],
    monthly_budget_fils: int,
    strategy: str,
    start_month: str,
    max_months: int = 600,
) -> dict:
    if strategy not in STRATEGIES:
        raise ValueError(f"unknown strategy: {strategy!r}")
    parse_month(start_month)
    budget = int(monthly_budget_fils)

    active = _priority(_normalise(debts), strategy)
    order = [d["id"] for d in active]

    if not active:
        return {
            "feasible": True,
            "strategy": strategy,
            "months": 0,
            "debtFreeMonth": None,
            "totalInterestFils": 0,
            "totalPaidFils": 0,
            "order": [],
            "schedule": [],
            "perDebt": [],
        }

    required = sum(min(d["min"], d["balance"]) for d in active)
    if budget < required:
        return _infeasible(strategy, "budget_below_minimums", shortfallFils=required - budget)

    interest_total = {d["id"]: 0 for d in active}
    payoff_month: dict[str, str] = {}
    schedule: list[dict] = []
    total_paid = 0
    month_idx = 0

    while any(d["balance"] > 0 for d in active):
        if month_idx >= max_months:
            return _infeasible(strategy, "negative_amortization", debtIds=[d["id"] for d in active if d["balance"] > 0])
        month = add_months(start_month, month_idx)
        live = [d for d in active if d["balance"] > 0]
        before_total = sum(d["balance"] for d in live)

        interest = {}
        for d in live:
            i = monthly_interest(d["balance"], d["apr"])
            interest[d["id"]] = i
            d["balance"] += i

        paid = {d["id"]: 0 for d in live}
        for d in live:
            p = min(d["min"], d["balance"])
            d["balance"] -= p
            paid[d["id"]] += p
        leftover = budget - sum(paid.values())
        for d in live:  # already in priority order
            if leftover <= 0:
                break
            extra = min(leftover, d["balance"])
            d["balance"] -= extra
            paid[d["id"]] += extra
            leftover -= extra

        after_total = sum(d["balance"] for d in live)
        if after_total > 0 and after_total >= before_total:
            stuck = [d["id"] for d in live if paid[d["id"]] <= interest[d["id"]] and d["balance"] > 0]
            return _infeasible(strategy, "negative_amortization", debtIds=stuck)

        payments = []
        for d in live:
            interest_total[d["id"]] += interest[d["id"]]
            total_paid += paid[d["id"]]
            if d["balance"] == 0:
                payoff_month[d["id"]] = month
            payments.append({
                "debtId": d["id"],
                "paymentFils": paid[d["id"]],
                "interestFils": interest[d["id"]],
                "balanceFils": d["balance"],
            })
        schedule.append({"month": month, "payments": payments, "totalBalanceFils": after_total})
        month_idx += 1

    total_interest = sum(interest_total.values())
    return {
        "feasible": True,
        "strategy": strategy,
        "months": month_idx,
        "debtFreeMonth": schedule[-1]["month"],
        "totalInterestFils": total_interest,
        "totalPaidFils": total_paid,
        "order": order,
        "schedule": schedule,
        "perDebt": [
            {"debtId": did, "payoffMonth": payoff_month[did], "interestFils": interest_total[did]}
            for did in order
        ],
    }


def compare_strategies(
    debts: list[Any],
    monthly_budget_fils: int,
    start_month: str,
    max_months: int = 600,
) -> dict:
    """Both strategies plus avalanche's advantage over snowball (None if either infeasible)."""
    av = simulate_payoff(debts, monthly_budget_fils, "avalanche", start_month, max_months)
    sb = simulate_payoff(debts, monthly_budget_fils, "snowball", start_month, max_months)
    both = av["feasible"] and sb["feasible"]
    return {
        "avalanche": av,
        "snowball": sb,
        "interestSavedFils": sb["totalInterestFils"] - av["totalInterestFils"] if both else None,
        "monthsSaved": sb["months"] - av["months"] if both else None,
    }
