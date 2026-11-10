"""Statement import (staged) and merchant rule request/response models."""
from __future__ import annotations

import datetime as dt
from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.models.transactions import TxnType
from app.schemas.base import ApiModel, InputModel, LongText, ObjectIdStr, ShortText

RowStatus = Literal["new", "recorded", "transfer", "review"]
RowAction = Literal["import", "skip"]
ImportStatus = Literal["draft", "committing", "committed", "rolling_back", "rolled_back"]
RowId = Annotated[str, StringConstraints(pattern=r"^\d{1,3}-\d{1,5}$")]
Pattern = Annotated[str, StringConstraints(min_length=2, max_length=100)]


# ------------------------------------------------------------------ responses
class ReconciliationOut(ApiModel):
    ok: bool
    arithmetic_ok: bool
    running_balance_ok: bool
    messages: list[str] = []


class ImportCounts(ApiModel):
    total: int = 0
    new: int = 0
    recorded: int = 0
    transfer: int = 0
    review: int = 0
    to_import: int = 0
    skipped: int = 0


class ImportSectionOut(ApiModel):
    index: int
    bank: str
    product: str
    account_type: str
    last4: str | None
    currency: str
    period_from: dt.date | None
    period_to: dt.date | None
    opening_fils: int | None
    closing_fils: int | None
    total_debit_fils: int
    total_credit_fils: int
    row_count: int
    account_id: str | None
    account_name: str | None
    suggested_account_name: str
    reconciliation: ReconciliationOut
    counts: ImportCounts


class ImportRowOut(ApiModel):
    id: str
    section_index: int
    date: dt.date
    description: str
    debit_fils: int | None
    credit_fils: int | None
    balance_fils: int | None
    amount_fils: int
    direction: Literal["in", "out"]
    ref: str | None
    card_last4: str | None
    counterparty_last4: str | None
    original_amount: str | None
    original_currency: str | None
    source_ref: str
    status: RowStatus
    action: RowAction
    type: TxnType
    category_id: str | None
    merchant: str | None
    note: str | None
    # Transfers: the household's other account (money goes to it on a debit, comes from it on a credit).
    counter_account_id: str | None
    needs_review: bool
    review_reason: str | None
    matched_transaction_id: str | None
    paired_row_id: str | None
    reason: str
    edited: bool


class AccountCheckOut(ApiModel):
    section_index: int
    account_id: str
    account_name: str
    period_to: dt.date | None
    statement_closing_fils: int | None
    # The app's balance for this account counting transactions dated on or before the statement end.
    app_balance_fils: int
    difference_fils: int | None
    current_balance_fils: int


class CommitResultOut(ApiModel):
    created_count: int
    skipped_count: int
    accounts: list[AccountCheckOut]


class ImportSummaryOut(ApiModel):
    id: str
    filename: str
    bank: str
    format: str
    status: ImportStatus
    created_at: datetime
    created_by_name: str | None
    committed_at: datetime | None
    rolled_back_at: datetime | None
    period_from: dt.date | None
    period_to: dt.date | None
    sections: list[ImportSectionOut]
    counts: ImportCounts
    issues: list[str]
    commit_result: CommitResultOut | None


class ImportOut(ImportSummaryOut):
    rows: list[ImportRowOut]


# ------------------------------------------------------------------ requests
class SectionAccountIn(InputModel):
    index: int = Field(ge=0, le=999)
    account_id: ObjectIdStr | None = None


class ImportPatch(InputModel):
    """Map statement sections to accounts (re-runs matching), or just re-run matching."""

    sections: list[SectionAccountIn] = Field(default_factory=list, max_length=50)
    rematch: bool = False


class RowPatchIn(InputModel):
    id: RowId
    action: RowAction | None = None
    type: TxnType | None = None
    category_id: ObjectIdStr | None = None
    merchant: ShortText | None = None
    note: LongText | None = None
    counter_account_id: ObjectIdStr | None = None
    needs_review: bool | None = None


class ImportRowsPatch(InputModel):
    rows: list[RowPatchIn] = Field(min_length=1, max_length=2000)


class MerchantRuleCreate(InputModel):
    pattern: Pattern
    category_id: ObjectIdStr
    merchant: ShortText | None = None


class MerchantRulePatch(InputModel):
    pattern: Pattern | None = None
    category_id: ObjectIdStr | None = None
    merchant: ShortText | None = None


class MerchantRuleOut(ApiModel):
    id: str
    pattern: str
    merchant: str | None
    category_id: str | None
    category_name: str | None
    kind: str | None
    source: str
    archived: bool
    created_at: datetime
    updated_at: datetime
