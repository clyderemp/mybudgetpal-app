from __future__ import annotations

from typing import Any

from pydantic import Field

from app.schemas.base import ApiModel, InputModel, LongText, NonNegFils, ObjectIdStr


class BudgetLineIn(InputModel):
    category_id: ObjectIdStr
    limit_fils: NonNegFils


class BudgetPut(InputModel):
    lines: list[BudgetLineIn] = Field(max_length=200)
    note: LongText | None = None


class BudgetLineOut(ApiModel):
    category_id: str
    category_name: str
    group: str
    limit_fils: int
    spent_fils: int
    remaining_fils: int


class BudgetOut(ApiModel):
    month: str
    lines: list[BudgetLineOut]
    note: str | None = None
    total_limit_fils: int
    total_spent_fils: int
    income_fils: int
    unbudgeted_spent_fils: int
    # Zero-based plan (GET/PUT /budgets/{month}, copy): expected income -> commitments -> sinking funds
    # -> flexible limits -> left to assign. Built by app.analytics.bills.zero_based_plan; null elsewhere.
    plan: dict[str, Any] | None = None
