from beanie import PydanticObjectId
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel

from app.models.base import HouseholdDocument


class BudgetLine(BaseModel):
    category_id: PydanticObjectId
    limit_fils: int


class Budget(HouseholdDocument):
    month: str
    lines: list[BudgetLine] = Field(default_factory=list)
    note: str | None = None

    class Settings:
        name = "budgets"
        indexes = [IndexModel([("household_id", ASCENDING), ("month", ASCENDING)], unique=True)]
