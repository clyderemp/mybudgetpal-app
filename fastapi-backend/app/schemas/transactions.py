from __future__ import annotations

import datetime as dt
from datetime import datetime
from typing import Literal

from pydantic import model_validator

from app.models.transactions import TxnType
from app.schemas.base import ApiModel, InputModel, LongText, ObjectIdStr, PosFils, ShortText


class TxnItemIn(InputModel):
    name: ShortText
    amount_fils: PosFils | None = None
    quantity: float | None = None


class TxnItemOut(ApiModel):
    name: str
    amount_fils: int | None = None
    quantity: float | None = None


class TransactionCreate(InputModel):
    account_id: ObjectIdStr
    date: dt.date
    amount_fils: PosFils
    type: TxnType
    category_id: ObjectIdStr | None = None
    to_account_id: ObjectIdStr | None = None
    merchant: ShortText | None = None
    note: LongText | None = None
    items: list[TxnItemIn] = []

    @model_validator(mode="after")
    def _rules(self) -> "TransactionCreate":
        if self.type == "transfer":
            if not self.to_account_id:
                raise ValueError("toAccountId is required for transfers")
            if self.to_account_id == self.account_id:
                raise ValueError("toAccountId must differ from accountId")
            self.category_id = None
        else:
            if not self.category_id:
                raise ValueError("categoryId is required unless type is transfer")
            self.to_account_id = None
        return self


class TransactionPatch(InputModel):
    account_id: ObjectIdStr | None = None
    date: dt.date | None = None
    amount_fils: PosFils | None = None
    type: TxnType | None = None
    category_id: ObjectIdStr | None = None
    to_account_id: ObjectIdStr | None = None
    merchant: ShortText | None = None
    note: LongText | None = None
    items: list[TxnItemIn] | None = None
    needs_review: bool | None = None


class TransactionOut(ApiModel):
    id: str
    account_id: str
    date: dt.date
    amount_fils: int
    type: str
    category_id: str | None
    to_account_id: str | None
    merchant: str | None
    note: str | None
    created_by: str
    created_by_name: str | None
    source: str
    items: list[TxnItemOut] = []
    needs_review: bool = False
    review_reason: str | None = None
    source_ref: str | None = None
    import_batch: str | None = None
    bill_id: str | None = None
    created_at: datetime
    updated_at: datetime


class ReviewCountOut(ApiModel):
    count: int


TxnSort = Literal["date", "-date", "amount", "-amount"]
