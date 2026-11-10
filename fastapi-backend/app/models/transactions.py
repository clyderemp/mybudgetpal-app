import datetime as dt
from datetime import datetime
from typing import Literal

from beanie import PydanticObjectId
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.models.base import HouseholdDocument

TxnType = Literal["income", "expense", "transfer"]
SOURCE_REF_INDEX = "household_source_ref_unique"
LEGACY_SOURCE_REF_INDEX = "household_id_1_source_ref_1"


class TxnItem(BaseModel):
    """One line of a receipt/purchase (optional breakdown of a transaction)."""

    name: str
    amount_fils: int | None = None
    quantity: float | None = None


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
    # Optional line items (receipt scan or typed in).
    items: list[TxnItem] = Field(default_factory=list)
    # Flagged for a person to look at, e.g. a bank row with no merchant/payee name.
    needs_review: bool = False
    review_reason: str | None = None
    # Statement imports: stable id of the source row (bank ref or a hash) and the batch it came in,
    # so re-uploading a statement never duplicates and a whole batch can be rolled back.
    source_ref: str | None = None
    import_batch: str | None = None
    # Rollback moves source_ref here so the unique (household, source_ref) index lets the row come back.
    rolled_back_source_ref: str | None = None
    # Set when this transaction pays a recurring bill/subscription/instalment.
    bill_id: PydanticObjectId | None = None

    class Settings:
        name = "transactions"
        indexes = [
            IndexModel([("household_id", ASCENDING), ("date", DESCENDING)]),
            IndexModel([("household_id", ASCENDING), ("category_id", ASCENDING)]),
            # One transaction per statement row per household (imports are idempotent even under
            # concurrent commits). Replaces the earlier non-unique index on the same keys (see db.py).
            IndexModel([("household_id", ASCENDING), ("source_ref", ASCENDING)], unique=True,
                       partialFilterExpression={"source_ref": {"$type": "string"}},
                       name=SOURCE_REF_INDEX),
            IndexModel([("household_id", ASCENDING), ("needs_review", ASCENDING)]),
        ]
