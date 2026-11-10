"""Statement imports (staged, reviewable, reversible) and merchant categorisation rules."""
from __future__ import annotations

import datetime as dt
from datetime import datetime
from typing import Literal

from beanie import PydanticObjectId
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.models.base import HouseholdDocument


class MerchantRule(HouseholdDocument):
    """'Always categorise <pattern> as <category>' (case-insensitive whole-word match on the bank text
    and the cleaned merchant). ``merchant`` optionally renames the payee (e.g. "DUBAI ELECTRICITY" -> "DEWA")."""

    pattern: str
    category_id: PydanticObjectId | None = None
    merchant: str | None = None
    source: Literal["default", "user"] = "user"
    archived: bool = False

    class Settings:
        name = "merchant_rules"
        indexes = [IndexModel([("household_id", ASCENDING), ("archived", ASCENDING)])]


class ImportReconciliation(BaseModel):
    ok: bool = True
    arithmetic_ok: bool = True
    running_balance_ok: bool = True
    messages: list[str] = Field(default_factory=list)


class ImportSection(BaseModel):
    index: int
    bank: str
    product: str
    account_type: str
    last4: str | None = None
    iban_last4: str | None = None
    currency: str = "AED"
    holder: str | None = None
    period_from: dt.date | None = None
    period_to: dt.date | None = None
    opening_fils: int | None = None
    closing_fils: int | None = None
    total_debit_fils: int = 0
    total_credit_fils: int = 0
    account_id: PydanticObjectId | None = None
    reconciliation: ImportReconciliation = Field(default_factory=ImportReconciliation)


class ImportRow(BaseModel):
    id: str
    section_index: int
    date: dt.date
    description: str
    debit_fils: int | None = None
    credit_fils: int | None = None
    balance_fils: int | None = None
    ref: str | None = None
    card_last4: str | None = None
    counterparty_last4: str | None = None
    original_amount: str | None = None
    original_currency: str | None = None
    source_ref: str = ""
    # proposal (re-computed by matching unless ``edited``)
    status: Literal["new", "recorded", "transfer", "review"] = "new"
    action: Literal["import", "skip"] = "import"
    type: Literal["income", "expense", "transfer"] = "expense"
    category_id: PydanticObjectId | None = None
    merchant: str | None = None
    note: str | None = None
    counter_account_id: PydanticObjectId | None = None
    needs_review: bool = False
    review_reason: str | None = None
    matched_transaction_id: PydanticObjectId | None = None
    paired_row_id: str | None = None
    reason: str = ""
    edited: bool = False
    # set on commit
    transaction_id: PydanticObjectId | None = None

    @property
    def amount_fils(self) -> int:
        return self.credit_fils or self.debit_fils or 0

    @property
    def direction(self) -> str:
        return "in" if self.credit_fils else "out"


class AccountCheck(BaseModel):
    section_index: int
    account_id: PydanticObjectId
    account_name: str
    period_to: dt.date | None = None
    statement_closing_fils: int | None = None
    app_balance_fils: int
    difference_fils: int | None = None
    current_balance_fils: int


class CommitResult(BaseModel):
    created_count: int = 0
    skipped_count: int = 0
    accounts: list[AccountCheck] = Field(default_factory=list)


class StatementImport(HouseholdDocument):
    filename: str
    file_sha256: str
    bank: str
    format: str
    # committing / rolling_back are short-lived claims taken atomically (no double commit)
    status: Literal["draft", "committing", "committed", "rolling_back", "rolled_back"] = "draft"
    sections: list[ImportSection] = Field(default_factory=list)
    rows: list[ImportRow] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    created_by: PydanticObjectId
    committed_at: datetime | None = None
    committed_by: PydanticObjectId | None = None
    rolled_back_at: datetime | None = None
    commit_result: CommitResult | None = None

    class Settings:
        name = "statement_imports"
        indexes = [IndexModel([("household_id", ASCENDING), ("created_at", DESCENDING)])]
