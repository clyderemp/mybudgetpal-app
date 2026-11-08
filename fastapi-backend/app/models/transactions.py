import datetime as dt
from datetime import datetime
from typing import Literal

from beanie import PydanticObjectId
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.models.base import HouseholdDocument

TxnType = Literal["income", "expense", "transfer"]


class Transaction(HouseholdDocument):
    account_id: PydanticObjectId
    date: dt.date
    amount_fils: int
    type: TxnType
    category_id: PydanticObjectId | None = None
    to_account_id: PydanticObjectId | None = None
    merchant: str | None = None
    note: str | None = None
    created_by: PydanticObjectId
    source: Literal["manual", "import"] = "manual"
    deleted_at: datetime | None = None

    class Settings:
        name = "transactions"
        indexes = [
            IndexModel([("household_id", ASCENDING), ("date", DESCENDING)]),
            IndexModel([("household_id", ASCENDING), ("category_id", ASCENDING)]),
        ]
