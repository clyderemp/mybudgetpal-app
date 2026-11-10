"""Generic CSV exports: one account, a header row naming the columns."""
from __future__ import annotations

import csv
import datetime as dt
import io
import re

from app.services.statements.types import StatementError, StatementRow, StatementSection, mask_numbers, to_fils

COLUMNS = {
    "date": ("date", "transaction date", "posting date", "txn date", "booking date", "value date"),
    "description": ("description", "details", "narrative", "particulars", "transaction", "transaction details", "merchant", "memo"),
    "debit": ("debit", "withdrawal", "withdrawals", "money out", "debit amount", "paid out"),
    "credit": ("credit", "deposit", "deposits", "money in", "credit amount", "paid in"),
    "amount": ("amount", "amount (aed)", "amount aed", "transaction amount"),
    "balance": ("balance", "running balance", "balance (aed)", "available balance"),
    "ref": ("reference", "ref", "reference no", "reference number", "ref no"),
}
DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d-%b-%Y", "%d/%m/%y", "%d %B %Y")


def _date(text: str) -> dt.date:
    t = text.strip()
    for fmt in DATE_FORMATS:
        try:
            return dt.datetime.strptime(t, fmt).date()
        except ValueError:
            continue
    raise StatementError(f"unrecognised date {t[:20]!r}")


def _money(text: str) -> int | None:
    t = re.sub(r"[^\d.,()-]", "", text or "")
    if not t or not re.search(r"\d", t):
        return None
    neg = t.startswith("-") or (t.startswith("(") and t.endswith(")"))
    t = t.strip("()-")
    if not re.fullmatch(r"(\d{1,3}(,\d{3})+|\d+)(\.\d{1,3})?", t):
        raise StatementError(f"unrecognised amount {text[:20]!r}")
    value = to_fils(t if "." in t else t + ".00")
    return -value if neg else value


def looks_like_csv(data: bytes) -> bool:
    try:
        head = data[:4096].decode("utf-8-sig")
    except UnicodeDecodeError:
        return False
    first = head.splitlines()[0] if head.splitlines() else ""
    return "," in first or ";" in first


def parse(data: bytes) -> list[StatementSection]:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise StatementError("CSV must be UTF-8 text") from exc
    dialect = csv.Sniffer().sniff(text[:2048], delimiters=",;\t") if text.strip() else csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    header = [h.strip().lower() for h in next(reader, [])]
    idx: dict[str, int] = {}
    for key, names in COLUMNS.items():
        for i, h in enumerate(header):
            if h in names and key not in idx:
                idx[key] = i
    if "date" not in idx or "description" not in idx or not ({"debit", "credit"} & idx.keys() or "amount" in idx):
        raise StatementError("CSV needs date, description and debit/credit (or amount) columns")
    rows: list[StatementRow] = []
    for n, rec in enumerate(reader, start=2):
        if not any(c.strip() for c in rec):
            continue
        get = lambda k: rec[idx[k]].strip() if k in idx and idx[k] < len(rec) else ""  # noqa: E731
        debit = credit = None
        if "debit" in idx or "credit" in idx:
            d, c = _money(get("debit")), _money(get("credit"))
            debit = abs(d) if d else None
            credit = abs(c) if c else None
        if debit is None and credit is None and "amount" in idx:
            a = _money(get("amount"))
            if a:
                debit, credit = (-a, None) if a < 0 else (None, a)
        if debit is None and credit is None:
            continue
        desc = re.sub(r"\s+", " ", get("description"))
        rows.append(StatementRow(date=_date(get("date")), description=mask_numbers(desc), debit_fils=debit,
                                 credit_fils=credit, balance_fils=_money(get("balance")) if "balance" in idx else None,
                                 ref=get("ref") or None))
    if not rows:
        raise StatementError("CSV has no transaction rows")
    if len(rows) > 1 and rows[0].date > rows[-1].date:
        rows.reverse()  # newest-first exports
    opening = None
    if rows[0].balance_fils is not None:
        opening = rows[0].balance_fils - (rows[0].credit_fils or 0) + (rows[0].debit_fils or 0)
    closing = rows[-1].balance_fils
    sec = StatementSection(bank="CSV", product="CSV export", account_type="bank", last4=None,
                           period_from=min(r.date for r in rows), period_to=max(r.date for r in rows),
                           opening_fils=opening, closing_fils=closing, rows=rows)
    if opening is None:
        sec.notes.append("no balance column: opening and closing balances are unknown")
    return [sec]
