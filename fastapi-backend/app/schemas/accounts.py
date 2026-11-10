from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.models.accounts import AccountPurpose, AccountType
from app.schemas.base import ApiModel, Color, Currency, Fils, InputModel, Name, ShortText

Last4 = Annotated[str, StringConstraints(pattern=r"^\d{4}$")]


class AccountCreate(InputModel):
    name: Name
    institution: ShortText | None = None
    type: AccountType
    currency: Currency = "AED"
    opening_balance_fils: Fils = 0
    last4: Last4 | None = None
    color: Color | None = None
    purpose: AccountPurpose = "household"


class AccountPatch(InputModel):
    name: Name | None = None
    institution: ShortText | None = None
    type: AccountType | None = None
    currency: Currency | None = None
    opening_balance_fils: Fils | None = None
    last4: Last4 | None = None
    color: Color | None = None
    purpose: AccountPurpose | None = None


class AccountOut(ApiModel):
    id: str
    name: str
    institution: str | None
    type: str
    currency: str
    opening_balance_fils: int
    balance_fils: int
    last4: str | None
    color: str | None
    archived: bool
    purpose: str = "household"
    created_at: datetime
    updated_at: datetime
