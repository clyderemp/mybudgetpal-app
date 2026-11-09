from __future__ import annotations

import asyncio
import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.analytics import compare_strategies, simulate_payoff
from app.errors import validation_error
from app.models import Plan
from app.schemas.base import MAX_FILS
from app.schemas.plan import PlanOut, PlanPut, Strategy
from app.security.deps import CurrentUser, get_current_user
from app.services.insights import active_debts, debts_for_analytics, get_plan, get_today, month_str, sum_minimums

router = APIRouter(prefix="/plan", tags=["plan"])


def _plan_out(plan: Plan | None, minimums: int) -> PlanOut:
    """Saved plan, or defaults (avalanche, budget = sum of current minimums) when none saved."""
    if plan is None:
        return PlanOut(
            strategy="avalanche",
            monthly_debt_budget_fils=minimums,
            monthly_savings_fils=0,
            emergency_fund_months=3,
        )
    return PlanOut(
        strategy=plan.strategy,
        monthly_debt_budget_fils=plan.monthly_debt_budget_fils,
        monthly_savings_fils=plan.monthly_savings_fils,
        emergency_fund_months=plan.emergency_fund_months,
    )


@router.get("", response_model=PlanOut)
async def get_plan_settings(current: CurrentUser = Depends(get_current_user)) -> PlanOut:
    debts, plan = await asyncio.gather(active_debts(current.household_id), get_plan(current.household_id))
    return _plan_out(plan, sum_minimums(debts))


@router.put("", response_model=PlanOut)
async def put_plan_settings(body: PlanPut, current: CurrentUser = Depends(get_current_user)) -> PlanOut:
    debts, plan = await asyncio.gather(active_debts(current.household_id), get_plan(current.household_id))
    minimums = sum_minimums(debts)
    # 0 is allowed and means "the sum of minimum payments" (same as payoff/compare below).
    if 0 < body.monthly_debt_budget_fils < minimums:
        raise validation_error(
            {"monthlyDebtBudgetFils": f"must be at least the sum of minimum payments ({minimums} fils)"}
        )
    data = body.model_dump()
    if plan is None:
        plan = Plan(household_id=current.household_id, **data)
        await plan.insert()
    else:
        for key, value in data.items():
            setattr(plan, key, value)
        plan.touch()
        await plan.save()
    return _plan_out(plan, minimums)


async def _inputs(current: CurrentUser, budget: int | None) -> tuple[list[dict[str, Any]], int, Plan | None]:
    debts, plan = await asyncio.gather(active_debts(current.household_id), get_plan(current.household_id))
    # Omitted -> the saved budget; 0 (explicit or saved) -> the sum of minimum payments.
    if budget is None:
        budget = plan.monthly_debt_budget_fils if plan else 0
    if budget == 0:
        budget = sum_minimums(debts)
    return debts_for_analytics(debts), budget, plan


@router.get("/payoff")
async def payoff(
    strategy: Strategy | None = Query(None),
    monthly_budget_fils: int | None = Query(None, alias="monthlyBudgetFils", ge=0, le=MAX_FILS),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    """simulate_payoff for current (non-archived) debts starting this month (Asia/Dubai).
    Omitted params default to the saved plan (no plan: avalanche, budget = sum of minimums)."""
    debts, budget, plan = await _inputs(current, monthly_budget_fils)
    strat = strategy or (plan.strategy if plan else "avalanche")
    return simulate_payoff(debts, budget, strat, month_str(today))


@router.get("/compare")
async def compare(
    monthly_budget_fils: int | None = Query(None, alias="monthlyBudgetFils", ge=0, le=MAX_FILS),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    debts, budget, _ = await _inputs(current, monthly_budget_fils)
    return compare_strategies(debts, budget, month_str(today))
