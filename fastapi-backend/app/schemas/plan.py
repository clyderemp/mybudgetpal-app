from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas.base import ApiModel, InputModel, NonNegFils

Strategy = Literal["avalanche", "snowball"]


class PlanOut(ApiModel):
    strategy: Strategy
    monthly_debt_budget_fils: int
    monthly_savings_fils: int
    emergency_fund_months: int


class PlanPut(InputModel):
    strategy: Strategy
    monthly_debt_budget_fils: NonNegFils
    monthly_savings_fils: NonNegFils
    emergency_fund_months: int = Field(default=3, ge=0, le=24)
