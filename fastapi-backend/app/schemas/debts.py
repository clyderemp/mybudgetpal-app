from __future__ import annotations

import datetime as dt
from datetime import datetime

from pydantic import Field

from app.models.debts import DebtKind
from app.schemas.base import ApiModel, InputModel, Name, NonNegFils, ObjectIdStr, PosFils
from app.schemas.transactions import TransactionOut


class DebtCreate(InputModel):
    name: Name
    kind: DebtKind
    balance_fils: NonNegFils
    apr_bps: int = Field(ge=0, le=100_000)
    min_payment_fils: NonNegFils
    due_day: int = Field(ge=1, le=28)
    account_id: ObjectIdStr | None = None


class DebtPatch(InputModel):
    name: Name | None = None
    kind: DebtKind | None = None
    balance_fils: NonNegFils | None = None
    apr_bps: int | None = Field(default=None, ge=0, le=100_000)
    min_payment_fils: NonNegFils | None = None
    due_day: int | None = Field(default=None, ge=1, le=28)
    account_id: ObjectIdStr | None = None


class DebtPaymentIn(InputModel):
    amount_fils: PosFils
    date: dt.date
    account_id: ObjectIdStr


class DebtOut(ApiModel):
    id: str
    name: str
    kind: str
    balance_fils: int
    apr_bps: int
    min_payment_fils: int
    due_day: int
    account_id: str | None
    archived: bool
    created_at: datetime
    updated_at: datetime


class DebtPaymentOut(ApiModel):
    debt: DebtOut
    transaction: TransactionOut
