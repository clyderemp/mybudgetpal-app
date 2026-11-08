"""Financial health score (spec §6 health.py).

Inputs: monthly summaries (``monthly_summary``/``monthly_series`` dicts; camelCase or
snake_case keys). Months with zero income and zero expense are ignored.

Metrics:
  savingsRate         = sum(income - expense) / sum(income), clamped to [0, 1]; None if no income
  emergencyFundMonths = liquid_balance / average monthly expense; None if no expense
  debtToIncome        = monthly_min_payments / average monthly income; None if no income

Weights (total 100, rounded half-up, clamped 0..100):
  savings rate    35: linear 0 -> 35 as rate goes 0% -> 20%+; None -> 0
  emergency fund  35: linear 0 -> 35 as months go 0 -> 6+; no expense data -> 35 if
                      liquid > 0 else 0
  debt-to-income  30: <= 10% -> 30, >= 50% -> 0, linear between; no debt
                      (no min payments and no total debt) -> 30; debt but no income -> 0
"""

from __future__ import annotations

from typing import Any, Iterable

from ._common import format_aed, get, round_half_up

W_SAVINGS = 35
W_EMERGENCY = 35
W_DTI = 30
SAVINGS_TARGET = 0.20
EMERGENCY_TARGET_MONTHS = 6
DTI_GOOD = 0.10
DTI_BAD = 0.50


def _field(m: Any, camel: str, snake: str) -> int:
    v = get(m, camel)
    if v is None:
        v = get(m, snake, 0)
    return int(v or 0)


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def financial_health(
    monthly: Iterable[Any],
    liquid_balance_fils: int,
    total_debt_fils: int,
    monthly_min_payments_fils: int,
) -> dict:
    rows = [(_field(m, "incomeFils", "income_fils"), _field(m, "expenseFils", "expense_fils")) for m in monthly]
    rows = [r for r in rows if r[0] or r[1]]
    n = len(rows)
    total_income = sum(r[0] for r in rows)
    total_expense = sum(r[1] for r in rows)
    avg_income = total_income / n if n else 0.0
    avg_expense = total_expense / n if n else 0.0
    liquid = int(liquid_balance_fils)
    total_debt = max(0, int(total_debt_fils))
    min_pay = max(0, int(monthly_min_payments_fils))
    has_debt = total_debt > 0 or min_pay > 0

    savings_rate = None
    if total_income > 0:
        savings_rate = round(_clamp((total_income - total_expense) / total_income), 4)
    s_savings = W_SAVINGS * _clamp((savings_rate or 0.0) / SAVINGS_TARGET)

    emergency_months = None
    if avg_expense > 0:
        emergency_months = round(max(0.0, liquid / avg_expense), 2)
        s_emergency = W_EMERGENCY * _clamp(emergency_months / EMERGENCY_TARGET_MONTHS)
    else:
        s_emergency = W_EMERGENCY if liquid > 0 else 0.0

    dti = None
    if avg_income > 0:
        dti = round(min_pay / avg_income, 4)
        s_dti = W_DTI * _clamp((DTI_BAD - dti) / (DTI_BAD - DTI_GOOD))
    else:
        s_dti = 0.0 if has_debt else float(W_DTI)

    score = int(_clamp(round_half_up(s_savings + s_emergency + s_dti), 0, 100))

    tips: list[str] = []
    if n == 0:
        tips.append("Add a few months of income and expenses to get a meaningful health score.")
    else:
        if total_expense > total_income:
            tips.append(
                f"You spent {format_aed(round_half_up(total_expense - total_income))} more than you earned "
                "over this period; trim lifestyle categories first."
            )
        elif savings_rate is not None and savings_rate < SAVINGS_TARGET:
            tips.append("Aim to save at least 20% of income; automate a transfer on payday.")
        if emergency_months is not None and emergency_months < 3:
            tips.append(
                f"Build an emergency fund of 3-6 months of expenses "
                f"(about {format_aed(round_half_up(avg_expense * 3))} for 3 months)."
            )
        elif emergency_months is not None and emergency_months < EMERGENCY_TARGET_MONTHS:
            tips.append("Keep growing your emergency fund toward 6 months of expenses.")
        if dti is not None and dti > 0.36:
            tips.append("Debt payments take a large share of income; focus extra money on the highest-APR debt.")
        elif has_debt and dti is not None and dti > DTI_GOOD:
            tips.append("Pay more than the minimums to become debt-free sooner and save on interest.")
        if has_debt and avg_income <= 0:
            tips.append("Record your income so debt affordability can be assessed.")
    if not tips:
        tips.append("Great shape: keep saving consistently and review your budget monthly.")

    return {
        "score": score,
        "savingsRate": savings_rate,
        "emergencyFundMonths": emergency_months,
        "debtToIncome": dti,
        "tips": tips,
    }
