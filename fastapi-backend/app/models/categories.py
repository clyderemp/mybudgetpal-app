from typing import Literal

from pymongo import ASCENDING, IndexModel

from app.models.base import HouseholdDocument

CategoryKind = Literal["income", "expense"]
CategoryGroup = Literal["essentials", "lifestyle", "debt", "savings", "income", "other"]


class Category(HouseholdDocument):
    name: str
    kind: CategoryKind
    group: CategoryGroup = "other"
    icon: str | None = None
    color: str | None = None
    archived: bool = False

    class Settings:
        name = "categories"
        indexes = [IndexModel([("household_id", ASCENDING), ("name", ASCENDING)])]
