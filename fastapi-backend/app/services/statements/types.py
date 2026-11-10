"""Normalised statement data (pure; no I/O). Money is integer fils."""
from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal


class StatementError(ValueError):
    """The file is not a statement we can read (wrong bank/format, encrypted, empty)."""


class StatementTooComplex(StatementError):
    """The PDF exceeds the per-page / total object caps or the parsing time budget."""


@dataclass
class StatementRow:
    date: dt.date
    description: str
    debit_fils: int | None
    credit_fils: int | None
    balance_fils: int | None
    ref: str | None = None
    value_date: dt.date | None = None
    card_last4: str | None = None
    counterparty_last4: str | None = None
    original_amount: str | None = None
    original_currency: str | None = None
    page: int = 0

    @property
    def direction(self) -> str:
        return "in" if self.credit_fils else "out"

    @property
    def amount_fils(self) -> int:
        return self.credit_fils or self.debit_fils or 0


@dataclass
class Reconciliation:
    ok: bool = True
    arithmetic_ok: bool = True
    running_balance_ok: bool = True
    messages: list[str] = field(default_factory=list)


@dataclass
class StatementSection:
    """One bank account inside a statement file."""

    bank: str
    product: str
    account_type: str  # app AccountType: bank | savings | credit_card ...
    last4: str | None
    currency: str = "AED"
    iban_last4: str | None = None
    holder: str | None = None
    period_from: dt.date | None = None
    period_to: dt.date | None = None
    opening_fils: int | None = None
    closing_fils: int | None = None
    rows: list[StatementRow] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    reconciliation: Reconciliation = field(default_factory=Reconciliation)

    @property
    def total_debit_fils(self) -> int:
        return sum(r.debit_fils or 0 for r in self.rows)

    @property
    def total_credit_fils(self) -> int:
        return sum(r.credit_fils or 0 for r in self.rows)


@dataclass
class ParsedStatement:
    bank: str
    format: str
    sections: list[StatementSection]
    issues: list[str] = field(default_factory=list)


# ------------------------------------------------------------------ small helpers shared by parsers
AMOUNT_RE = re.compile(r"^-?(\d{1,3}(,\d{3})+|\d+)\.\d{2,3}$")
DASH = "[−‐‑‒–-]"  # unicode minus / hyphen variants used in statements


def to_fils(text: str) -> int:
    """'1,234.50' / '2,454.970' -> 123450 / 245497 (half-up on a third decimal)."""
    value = Decimal(text.replace(",", "")) * 100
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def iso_dmy(text: str) -> dt.date:
    """dd/mm/yyyy or dd-mm-yyyy (any dash) -> date."""
    d, m, y = re.split(DASH + "|/", text.strip())
    return dt.date(int(y), int(m), int(d))


def mask_numbers(text: str) -> str:
    """Never keep full IBAN / account / card numbers: keep the last 4 digits only."""
    text = re.sub(r"\bAE\s?\d{2}(?:\s?\d){19}", lambda m: "AE.." + re.sub(r"\D", "", m.group(0))[-4:], text)
    text = re.sub(r"\d{9,}", lambda m: ".." + m.group(0)[-4:], text)
    text = re.sub(r"\b\d{6}X{4,}(\d{4})\b", r"XXXX\1", text)
    return text


def iban_last4s(text: str) -> list[str]:
    """Last 4 digits of every UAE IBAN in the text (stray spaces inside the number allowed)."""
    out = []
    for m in re.finditer(r"AE\d[\d ]{18,30}\d", text):
        digits = m.group(0).replace(" ", "")
        if len(digits) >= 23:
            out.append(digits[:23][-4:])
    return out
