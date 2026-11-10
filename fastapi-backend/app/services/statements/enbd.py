"""Emirates NBD "Statement of Account" / "Authenticated Statement" PDFs.

Layout (Chromium-rendered, 612x792): a metadata block (Statement Date, period, Account type/number,
IBAN, Currency) above a table with columns Date | Details | Debit | Credit | Balance (+ Cr/Dr).
Each row's multi-line Details cell is vertically centred on the Date/amount line, so description
lines are attached to the nearest date line. Known quirks:
* The printed "BROUGHT FORWARD" balance can disagree with the rows (the rows chain; the printed
  opening does not) — reported, not fixed.
* Card rows print the transaction date without the day ("-07-2026 16:11:32 ...").
* IBANs in descriptions are sometimes split by a space.
"""
from __future__ import annotations

import datetime as dt
import re
from typing import Any

from app.services.statements.pdfutil import page_lines, xc
from app.services.statements.types import (
    AMOUNT_RE,
    DASH,
    StatementRow,
    StatementSection,
    iban_last4s,
    iso_dmy,
    mask_numbers,
    to_fils,
)

BANK = "Emirates NBD"
DATE_DMY = re.compile(r"^\d{2}/\d{2}/\d{4}$")
HEADER = ("Date", "Details", "Debit", "Credit", "Balance")
PRODUCTS = {
    "CURRENT ACCOUNT": ("Current account", "bank"),
    "SAVINGS ACCOUNT": ("Savings account", "savings"),
    "PLUSSAVER": ("PlusSaver", "savings"),
}


def detect(first_page: str) -> bool:
    t = first_page
    return ("Emirates NBD" in t or "emiratesnbd" in t.lower()) and all(k in t for k in HEADER)


def _meta(lines: list[dict], hdr_top: float, meta: dict[str, Any]) -> None:
    holder: list[str] = []
    in_holder = False
    for ln in lines:
        if ln["top"] >= hdr_top:
            break
        t = ln["text"]
        m = re.search(r"Statement period\s+(\S+) to (\S+)", t)
        if m:
            meta["period_from"], meta["period_to"] = iso_dmy(m.group(1)), iso_dmy(m.group(2))
        m = re.search(r"Statement Date:\s*(\d{2}/\d{2}/\d{4})", t)
        if m:
            meta["statement_date"] = iso_dmy(m.group(1))
            in_holder = True
            continue
        m = re.search(r"Account type\s+(.+?)$", t)
        if m and "product_raw" not in meta:
            meta["product_raw"] = m.group(1).strip()
        m = re.search(r"Account number\s+(\d+)", t)
        if m:
            meta["last4"] = m.group(1)[-4:]
        m = re.search(r"IBAN\s+(AE\d{21})", t)
        if m:
            meta["iban_last4"] = m.group(1)[-4:]
        m = re.search(r"Currency\s+([A-Z]{3})\b", t)
        if m:
            meta["currency"] = m.group(1)
        if in_holder:
            left = " ".join(w["text"] for w in ln["words"] if w["x0"] < 240).strip()
            if not left:
                continue
            if left.startswith((".", "POST", "P.O")) or re.match(r"^\d", left):
                in_holder = False
            elif re.fullmatch(r"[A-Z][A-Z .'/-]+", left):
                holder.append(left)
    if holder:
        meta["holder"] = " ".join(holder)


def parse(pdf: Any) -> list[StatementSection]:
    meta: dict[str, Any] = {}
    issues: list[str] = []
    date_rows: list[dict] = []
    desc_lines: list[tuple[int, float, str]] = []
    opening = None
    for pno, page in enumerate(pdf.pages, 1):
        lines = page_lines(page)
        hdr = None
        for ln in lines:
            ws = {w["text"]: w for w in ln["words"]}
            if all(k in ws for k in HEADER):
                hdr = ln
                cols = {k: xc(ws[k]) for k in ("Debit", "Credit", "Balance")}
                amt_start = ws["Debit"]["x0"] - 25
                details_x0 = ws["Details"]["x0"] - 110 if ws["Details"]["x0"] > 150 else ws["Details"]["x0"] - 5
                details_x0 = max(details_x0, ws["Date"]["x1"] + 5)
                break
        if hdr is None:
            if pno == 1:
                raise ValueError("no Date/Details/Debit/Credit/Balance header on page 1")
            issues.append(f"page {pno}: no column header found; page skipped")
            continue
        if pno == 1:
            _meta(lines, hdr["top"], meta)
        footer_y = min([ln["top"] for ln in lines if ln["arabic"] and ln["top"] > hdr["top"] + 10] or [page.height])
        for ln in lines:
            if not (hdr["top"] + 3 < ln["top"] < footer_y) or not ln["words"]:
                continue
            ws = ln["words"]
            first = ws[0]
            if DATE_DMY.match(first["text"]) and first["x0"] < details_x0:
                inline, amts, suffix, stray = [], [], None, []
                for w in ws[1:]:
                    if w["x0"] >= amt_start:
                        if AMOUNT_RE.match(w["text"]):
                            col = min(cols, key=lambda k: abs(cols[k] - xc(w)))
                            amts.append((col, to_fils(w["text"])))
                        elif w["text"] in ("Cr", "Dr"):
                            suffix = w["text"]
                        else:
                            stray.append(w["text"])
                    else:
                        inline.append(w["text"])
                if stray:
                    issues.append(f"page {pno} {first['text']}: unexpected text in the amount columns")
                debit = credit = balance = None
                for col, v in amts:
                    if col == "Debit":
                        debit = v if debit is None else debit + v
                    elif col == "Credit":
                        credit = v if credit is None else credit + v
                    else:
                        balance = v
                if balance is not None and suffix == "Dr" and balance > 0:
                    balance = -balance
                text = " ".join(inline)
                if text.startswith("BROUGHT FORWARD"):
                    opening = balance
                    continue
                date_rows.append({"page": pno, "y": ln["top"], "date": iso_dmy(first["text"]), "inline": text,
                                  "debit": debit, "credit": credit, "balance": balance, "before": [], "after": []})
            elif all(w["x0"] >= details_x0 - 1 and w["x1"] < amt_start for w in ws):
                desc_lines.append((pno, ln["top"], ln["text"]))
            else:
                issues.append(f"page {pno}: unrecognised line in the table was ignored")
    _attach(date_rows, desc_lines, issues)

    rows = []
    for r in date_rows:
        parts = [t for _, t in sorted(r["before"])] + ([r["inline"]] if r["inline"] else []) + [t for _, t in sorted(r["after"])]
        desc = re.sub(r"\s+", " ", " ".join(parts)).strip()
        if r["debit"] == 0:
            r["debit"] = None
        if r["credit"] == 0:
            r["credit"] = None
        row = StatementRow(date=r["date"], description=desc, debit_fils=r["debit"], credit_fils=r["credit"],
                           balance_fils=r["balance"], page=r["page"])
        _enrich(row)
        row.description = mask_numbers(desc)
        rows.append(row)

    raw = meta.get("product_raw", "")
    product, acct_type = PRODUCTS.get(raw.upper(), (raw.title() or "Account", "bank"))
    if "SAVER" in raw.upper() or "SAVING" in raw.upper():
        acct_type = "savings"
    sec = StatementSection(
        bank=BANK, product=product, account_type=acct_type, last4=meta.get("last4"),
        currency=meta.get("currency", "AED"), iban_last4=meta.get("iban_last4"), holder=meta.get("holder"),
        period_from=meta.get("period_from"), period_to=meta.get("period_to"),
        opening_fils=opening, closing_fils=rows[-1].balance_fils if rows else opening, rows=rows, issues=issues,
    )
    if opening is None:
        sec.issues.append("no BROUGHT FORWARD (opening) balance found")
    return [sec]


def _attach(date_rows: list[dict], desc_lines: list[tuple[int, float, str]], issues: list[str], max_dy: float = 16.0) -> None:
    """Details lines belong to the nearest date line on the page (rows are centred on it)."""
    for page, y, text in desc_lines:
        cands = [r for r in date_rows if r["page"] == page]
        if not cands:
            issues.append(f"page {page}: description text with no transaction on the page was ignored")
            continue
        nearest = min(cands, key=lambda r: abs(r["y"] - y))
        if abs(y - nearest["y"]) > max_dy:
            above = [r for r in cands if r["y"] < y]
            if not above:
                issues.append(f"page {page}: description text above the first transaction was ignored")
                continue
            nearest = max(above, key=lambda r: r["y"])
        (nearest["before"] if y < nearest["y"] else nearest["after"]).append((y, text))


def _enrich(r: StatementRow) -> None:
    d = r.description
    ref = None
    m = re.search(r"RefNo:-\s*([0-9A-F]{12})", d)
    if m:
        ref = m.group(1)
    if ref is None:
        m = re.search(r"BNK REF\.-\s*(\d+" + DASH + r"\s*\d+)", d)
        if m:
            ref = re.sub(r"\s+", "", m.group(1)).replace("−", "-")
    if ref is None:
        m = re.match(r"^(?:IPP|RMA)\s+(\d{8}[A-Z0-9]+)", d)
        if m:
            ref = m.group(1)
    if ref is None:
        m = re.search(r"TT REF:\s*([A-Z0-9]+)", d)
        if m:
            ref = m.group(1)
    if ref is None:
        m = re.search(r"SDM REF\.-\s*([A-Z0-9]+);", d)
        if m:
            ref = m.group(1)
    if ref is None:
        m = re.search(r"CHQ\. NO:\s*(\d+)|CHEQUE RETURN CHARGE-(\d+)", d)
        if m:
            ref = "CHQ" + (m.group(1) or m.group(2))
    if d.startswith("CARD NO."):
        m = re.match(r"^CARD NO\.(\d{6})X+(\d{4})", d)
        if m:
            r.card_last4 = m.group(2)
        m = (re.search(r"\b(\d{6})\s+(?=\d{2}\s*" + DASH + r")", d) or re.search(r"\b(\d{6})\s*$", d)
             or re.search(r"\b[A-Z]\d{7}\s+(\d{6})\b", d))
        if ref is None and m:
            ref = "auth" + m.group(1)
        m = re.search(r"\b(\d{2})\s*" + DASH + r"\s*(\d{2})\s*" + DASH + r"\s*(\d{4})\b", d)
        if m:
            try:
                r.value_date = dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
            except ValueError:
                pass
        m = re.search(r"(\d[\d,]*\.\d{2}),([A-Z]{3})\s*$", d)
        if m and m.group(2) != "AED":
            r.original_amount, r.original_currency = m.group(1).replace(",", ""), m.group(2)
    m = re.match(r"^(\d{6})X{4,}(\d{4})$", d)
    if m:  # bare card number: payment to that credit card
        r.card_last4 = m.group(2)
    r.ref = ref
    l4 = iban_last4s(d)
    if l4:
        r.counterparty_last4 = l4[0]
    m = re.search(r"\b([A-Z]{3})\s?(\d+(?:\.\d+)?)@([\d.]+)", d)  # remittance: "CAD 200@2.73"
    if m and m.group(1) != "AED":
        r.original_amount, r.original_currency = m.group(2), m.group(1)
