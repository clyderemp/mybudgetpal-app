from typing import Literal

from pymongo import ASCENDING, IndexModel

from app.models.base import HouseholdDocument


class Plan(HouseholdDocument):
    strategy: Literal["avalanche", "snowball"] = "avalanche"
    monthly_debt_budget_fils: int = 0
    monthly_savings_fils: int = 0
    emergency_fund_months: int = 3

    class Settings:
        name = "plans"
        indexes = [IndexModel([("household_id", ASCENDING)], unique=True)]
