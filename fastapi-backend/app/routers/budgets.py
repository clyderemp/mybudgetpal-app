from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends

from app.errors import AppError, validation_error
from app.models import Budget, BudgetLine, Category
from app.schemas.budgets import BudgetLineOut, BudgetOut, BudgetPut
from app.security.deps import CurrentUser, get_current_user
from app.services.analytics_data import load_analytics_txns
from app.services.bills import PlanInputs, compose_plan, load_plan_inputs
from app.services.months import month_bounds, parse_month

router = APIRouter(prefix="/budgets", tags=["budgets"])


async def load_budget_inputs(
    household_id: PydanticObjectId, month: str
) -> tuple[Budget | None, list[dict[str, Any]], dict[str, Category]]:
    """Budget doc, the month's transactions and the household's categories in one round trip.
    (All categories, not just budgeted ones, so the lookup needn't wait for the budget.)"""
    start, end = month_bounds(month)
    budget, txns, cats = await asyncio.gather(
        Budget.find_one({"household_id": household_id, "month": month}),
        load_analytics_txns(household_id, start, end),
        Category.find({"household_id": household_id}).to_list(),
    )
    return budget, txns, {str(c.id): c for c in cats}


async def build_budget_out(household_id: PydanticObjectId, month: str) -> BudgetOut:
    """Budget for a month with spent/remaining. totalSpentFils = all expense in the month;
    unbudgetedSpentFils = expense in categories without a budget line."""
    return compose_budget_out(month, *(await load_budget_inputs(household_id, month)))


def compose_budget_out(
    month: str, budget: Budget | None, txns: list[dict[str, Any]], cats: dict[str, Category]
) -> BudgetOut:
    """Pure part of build_budget_out. ``txns`` must be exactly the month's transactions."""
    spent: dict[str | None, int] = defaultdict(int)
    income = 0
    total_spent = 0
    for t in txns:
        if t["type"] == "expense":
            spent[t["category_id"]] += t["amount_fils"]
            total_spent += t["amount_fils"]
        elif t["type"] == "income":
            income += t["amount_fils"]
    lines: list[BudgetLineOut] = []
    budgeted: set[str] = set()
    if budget and budget.lines:
        for ln in budget.lines:
            cid = str(ln.category_id)
            cat = cats.get(cid)
            budgeted.add(cid)
            s = spent.get(cid, 0)
            lines.append(
                BudgetLineOut(
                    category_id=cid,
                    category_name=cat.name if cat else "(deleted)",
                    group=cat.group if cat else "other",
                    limit_fils=ln.limit_fils,
                    spent_fils=s,
                    remaining_fils=ln.limit_fils - s,
                )
            )
    unbudgeted = sum(v for k, v in spent.items() if k not in budgeted)
    return BudgetOut(
        month=month,
        lines=lines,
        note=budget.note if budget else None,
        total_limit_fils=sum(ln.limit_fils for ln in lines),
        total_spent_fils=total_spent,
        income_fils=income,
        unbudgeted_spent_fils=unbudgeted,
    )


def with_plan(out: BudgetOut, plan_inputs: PlanInputs) -> BudgetOut:
    """Attach the zero-based plan (bills, expected income and these limits) to a budget response."""
    out.plan = compose_plan(plan_inputs, out.month, out.total_limit_fils, [ln.category_id for ln in out.lines])
    return out


@router.get("/{month}", response_model=BudgetOut)
async def get_budget(month: str, current: CurrentUser = Depends(get_current_user)) -> BudgetOut:
    month = parse_month(month)
    inputs, plan_inputs = await asyncio.gather(
        load_budget_inputs(current.household_id, month), load_plan_inputs(current.household_id, month)
    )
    return with_plan(compose_budget_out(month, *inputs), plan_inputs)


async def _upsert(
    household_id: PydanticObjectId, month: str, lines: list[BudgetLine], note: str | None
) -> Budget:
    budget = await Budget.find_one({"household_id": household_id, "month": month})
    if budget is None:
        budget = Budget(household_id=household_id, month=month, lines=lines, note=note)
        await budget.insert()
    else:
        budget.lines = lines
        budget.note = note
        budget.touch()
        await budget.save()
    return budget


async def _upsert_and_build(
    household_id: PydanticObjectId, month: str, lines: list[BudgetLine], note: str | None
) -> BudgetOut:
    """Write the budget while the month's transactions / categories load concurrently."""
    start, end = month_bounds(month)
    budget, txns, cats, plan_inputs = await asyncio.gather(
        _upsert(household_id, month, lines, note),
        load_analytics_txns(household_id, start, end),
        Category.find({"household_id": household_id}).to_list(),
        load_plan_inputs(household_id, month),
    )
    return with_plan(compose_budget_out(month, budget, txns, {str(c.id): c for c in cats}), plan_inputs)


@router.put("/{month}", response_model=BudgetOut)
async def put_budget(month: str, body: BudgetPut, current: CurrentUser = Depends(get_current_user)) -> BudgetOut:
    month = parse_month(month)
    ids = [ln.category_id for ln in body.lines]
    if len(set(ids)) != len(ids):
        raise validation_error({"lines": "duplicate categoryId"})
    oids = [PydanticObjectId(i) for i in ids]
    found = {
        str(c.id): c
        async for c in Category.find({"household_id": current.household_id, "_id": {"$in": oids}})
    }
    fields: dict[str, str] = {}
    for idx, cid in enumerate(ids):
        cat = found.get(cid)
        if cat is None:
            fields[f"lines.{idx}.categoryId"] = "category not found"
        elif cat.kind != "expense":
            fields[f"lines.{idx}.categoryId"] = "only expense categories can be budgeted"
    if fields:
        raise validation_error(fields)
    lines = [BudgetLine(category_id=PydanticObjectId(ln.category_id), limit_fils=ln.limit_fils) for ln in body.lines]
    return await _upsert_and_build(current.household_id, month, lines, body.note)


@router.post("/{month}/copy-from/{from_month}", response_model=BudgetOut)
async def copy_budget(
    month: str, from_month: str, current: CurrentUser = Depends(get_current_user)
) -> BudgetOut:
    month = parse_month(month)
    from_month = parse_month(from_month, "fromMonth")
    source = await Budget.find_one({"household_id": current.household_id, "month": from_month})
    if source is None:
        raise AppError(404, "not_found", f"No budget for {from_month}")
    return await _upsert_and_build(current.household_id, month, list(source.lines), source.note)
