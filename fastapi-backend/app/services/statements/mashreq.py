"""Mashreq NEO PDFs: the monthly "Consolidated Relationship Statement" (several accounts) and the
single-account "Account Statement" (app export, any period).

Known quirks (consolidated, UniServe renderer):
* glyph 'f' is extracted as form feed and Arabic as (cid:N) — see ``pdfutil.clean_text``;
* "DUBAI" in card details is rendered as "UBAI" + "D" (the "D" sometimes clipped by the row);
* each transaction is one band between full-width ruling lines; continuation bands carry text only;
* the summary page shows balances at statement *generation* time, not at period end — never used
  as the closing balance.
"""
from __future__ import annotations

import datetime as dt
import re
from typing import Any

from app.services.statements.pdfutil import check_deadline, clean_text, page_lines, xc
from app.services.statements.types import (
    AMOUNT_RE,
    StatementRow,
    StatementSection,
    iban_last4s,
    iso_dmy,
    mask_numbers,
    to_fils,
)

BANK = "Mashreq"
DATE_DMY = re.compile(r"^\d{2}/\d{2}/\d{4}$")
DATE_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
VALUE_DATE_RE = re.compile(r"VALUE DATE:\s*(\d{2})-(\d{2})-(\d{4})")


def detect_consolidated(first_page: str) -> bool:
    return "Consolidated Relationship Statement" in first_page and "Mashreq" in first_page


def detect_account(first_page: str) -> bool:
    return "Mashreq" in first_page and re.search(r"(Savings|Current) account statement", first_page) is not None


def _account_type(text: str) -> str:
    return "savings" if re.search(r"sav", text, re.I) else "bank"


def fix_description(desc: str) -> str:
    """Normalise whitespace and repair the renderer's 'UBAI' + 'D' split of DUBAI."""
    d = re.sub(r"\s+", " ", desc).strip()
    d = re.sub(r"\bUBAI D$", "DUBAI", d)
    d = re.sub(r"\bUBAI$", "DUBAI", d)
    return d


def _finish_row(row: StatementRow) -> StatementRow:
    d = row.description
    m = VALUE_DATE_RE.search(d)
    if m:
        try:
            row.value_date = dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    m = re.search(r"Card number ending with (\d{4})", d)
    row.card_last4 = m.group(1) if m else None
    # "Acct to Acct transfer - FUND TRANSFER - <12-digit account> - <name>": that account is the other side.
    m = re.search(r"\b(\d{12})\s+-\s+", d)
    if m:
        row.counterparty_last4 = m.group(1)[-4:]
    else:
        m = re.search(r"IPPTRANSFER\d{6,12}(AE\d{21})", d.replace(" ", ""))
        ib = iban_last4s(d)
        if m:
            row.counterparty_last4 = m.group(1)[-4:]
        elif ib and row.debit_fils:
            row.counterparty_last4 = ib[0]
    row.description = mask_numbers(d)
    return row


# ------------------------------------------------------------------ single-account statement
def parse_account(pdf: Any) -> list[StatementSection]:
    meta: dict[str, Any] = {}
    issues: list[str] = []
    date_rows: list[dict] = []
    desc_lines: list[tuple[int, float, str]] = []
    opening = closing = None
    cols_state = None
    for pno, page in enumerate(pdf.pages, 1):
        lines = page_lines(page)
        for ln in lines:
            t = ln["text"]
            m = re.search(r"Account Number\s+(\d+)\s+([A-Z]{3})", t)
            if m:
                meta["last4"], meta["currency"] = m.group(1)[-4:], m.group(2)
            m = re.search(r"IBAN\s+(AE\d{21})", t)
            if m:
                meta["iban_last4"] = m.group(1)[-4:]
            m = re.search(r"^(.+?)\s+(Savings|Current) account statement$", t)
            if m and "holder" not in meta:
                meta["holder"], meta["product"] = m.group(1).strip(), f"{m.group(2)} account"
            m = re.search(r"Statement for period (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})", t)
            if m:
                meta["period_from"] = dt.date.fromisoformat(m.group(1))
                meta["period_to"] = dt.date.fromisoformat(m.group(2))
        hdr = next((ln for ln in lines if all(k in ln["text"].split() for k in
                                               ("Date", "Transaction", "Reference", "Debit", "Credit", "Balance"))), None)
        if hdr is not None:
            ws = {w["text"]: w for w in hdr["words"]}
            cols = {k: xc(ws[k]) for k in ("Debit", "Credit", "Balance")}
            ref_x0 = ws["Reference"]["x0"] - 20
            amt_start = (ws["Reference"]["x1"] + ws["Debit"]["x0"]) / 2 + 20
            details_x0 = ws["Transaction"]["x0"] - 10
            cols_state = (cols, ref_x0, amt_start, details_x0)
            body_start = hdr["top"] + 3
        elif cols_state is None:
            issues.append(f"page {pno}: no column header; page skipped")
            continue
        else:
            cols, ref_x0, amt_start, details_x0 = cols_state
            body_start = max([ln["top"] for ln in lines if "regulated by the Central Bank" in ln["text"]] or [0]) + 3
        footer_y = min([ln["top"] for ln in lines if re.match(r"^Page \d+ of \d+$", ln["text"])] or [page.height])
        for ln in lines:
            if not (body_start < ln["top"] < footer_y) or not ln["words"]:
                continue
            ws = ln["words"]
            first = ws[0]
            if first["x0"] < details_x0 and not DATE_ISO.match(first["text"]):
                continue  # boilerplate in the left margin
            desc_ws = [w for w in ws if details_x0 <= w["x0"] < ref_x0]
            ref_ws = [w for w in ws if ref_x0 <= w["x0"] < amt_start]
            amt_ws = [w for w in ws if w["x0"] >= amt_start]
            amts: dict[str, int] = {}
            for w in amt_ws:
                if AMOUNT_RE.match(w["text"]):
                    amts[min(cols, key=lambda k: abs(cols[k] - xc(w)))] = to_fils(w["text"])
            desc = " ".join(w["text"] for w in desc_ws)
            if DATE_ISO.match(first["text"]):
                date_rows.append({"page": pno, "y": ln["top"], "date": dt.date.fromisoformat(first["text"]),
                                  "inline": desc, "ref": " ".join(w["text"] for w in ref_ws) or None,
                                  "debit": amts.get("Debit"), "credit": amts.get("Credit"),
                                  "balance": amts.get("Balance"), "before": [], "after": []})
            elif desc.startswith("Opening Balance"):
                opening = amts.get("Balance")
            elif desc.startswith("Closing Balance"):
                closing = amts.get("Balance")
            elif desc and not ref_ws and not amt_ws:
                desc_lines.append((pno, ln["top"], desc))
    # first description line sits ~3pt above the date line, continuation lines every ~12.7pt below
    for page, y, text in desc_lines:
        cands = [r for r in date_rows if r["page"] == page]
        if not cands:
            issues.append(f"page {page}: description text with no transaction on the page was ignored")
            continue
        nearest = min(cands, key=lambda r: abs(r["y"] - y))
        if abs(y - nearest["y"]) > 16:
            above = [r for r in cands if r["y"] < y]
            if not above:
                continue
            nearest = max(above, key=lambda r: r["y"])
        (nearest["before"] if y < nearest["y"] else nearest["after"]).append((y, text))
    rows = []
    for r in date_rows:
        parts = [t for _, t in sorted(r["before"])] + ([r["inline"]] if r["inline"] else []) + [t for _, t in sorted(r["after"])]
        row = StatementRow(date=r["date"], description=fix_description(" ".join(parts)),
                           debit_fils=r["debit"] or None, credit_fils=r["credit"] or None,
                           balance_fils=r["balance"], ref=r["ref"], page=r["page"])
        rows.append(_finish_row(row))
    product = meta.get("product", "Account")
    sec = StatementSection(
        bank=BANK, product=f"NEO {product}", account_type=_account_type(product), last4=meta.get("last4"),
        currency=meta.get("currency", "AED"), iban_last4=meta.get("iban_last4"), holder=meta.get("holder"),
        period_from=meta.get("period_from"), period_to=meta.get("period_to"), opening_fils=opening,
        closing_fils=closing if closing is not None else (rows[-1].balance_fils if rows else opening),
        rows=rows, issues=issues,
    )
    return [sec]


# ------------------------------------------------------------------ consolidated statement
def _group_lines(words: list[dict], tol: float = 1.5) -> list[tuple[float, list[dict]]]:
    lines: list[list[Any]] = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if lines and abs(lines[-1][0] - w["top"]) <= tol:
            lines[-1][1].append(w)
        else:
            lines.append([w["top"], [w]])
    return [(t, sorted(ws, key=lambda w: w["x0"])) for t, ws in lines]


def _page_words(page: Any) -> list[dict]:
    check_deadline()
    out = []
    for w in page.extract_words(x_tolerance=1.5, y_tolerance=1):
        t = clean_text(w["text"]).strip()
        if t:
            w = dict(w)
            w["text"] = t
            out.append(w)
    return out


def _columns(words: list[dict]) -> dict[str, float] | None:
    """Cell boundaries from the column header (Date | Transaction | Reference no | Debit | Credit | Balance)."""
    by = {}
    for w in words:
        if w["text"] in ("Date", "Transaction", "Reference", "Debit", "Credit", "Balance") and w["text"] not in by:
            by[w["text"]] = w
    if len(by) < 6 or abs(by["Date"]["top"] - by["Balance"]["top"]) > 3:
        return None
    return {
        "date": by["Transaction"]["x0"] - 3.5,
        "txn": by["Reference"]["x0"] - 3,
        "ref": by["Debit"]["x0"] - 61.5,
        "debit": by["Credit"]["x0"] - 41.7,
        "credit": by["Balance"]["x0"] - 51,
        "header_bottom": by["Transaction"]["bottom"] + 8,
    }


def _col_of(w: dict, b: dict[str, float]) -> str | None:
    x = w["x0"]
    if x < 45:
        return None  # rotated 'e-statement' sidebar
    for name in ("date", "txn", "ref", "debit", "credit"):
        if x < b[name]:
            return name
    return "balance"


def _band(words: list[dict], b: dict[str, float]) -> dict:
    cols: dict[str, list[dict]] = {k: [] for k in ("date", "txn", "ref", "debit", "credit", "balance")}
    for w in words:
        c = _col_of(w, b)
        if c:
            cols[c].append(w)
    txn_lines = _group_lines(cols["txn"])
    desc = " ".join(" ".join(w["text"] for w in ws) for _, ws in txn_lines)
    date_words = [w for w in cols["date"] if DATE_DMY.match(w["text"])]
    key_top = None
    kind = "continuation"
    if date_words:
        key_top, kind = date_words[0]["top"], "txn"
    else:
        for t, ws in txn_lines:
            s = " ".join(w["text"] for w in ws)
            for label, k in (("OPENING BALANCE", "opening"), ("CLOSING BALANCE", "closing"),
                             ("Balance brought forward", "brought"), ("Balance carried forward", "carried")):
                if s.startswith(label):
                    key_top, kind = t, k
    amounts: dict[str, int | None] = {}
    if key_top is not None:
        for c in ("debit", "credit", "balance"):
            cands = [w for w in cols[c] if abs(w["top"] - key_top) <= 4 and AMOUNT_RE.match(w["text"])]
            amounts[c] = to_fils(cands[0]["text"]) if cands else None
    ref = [w["text"] for w in cols["ref"] if key_top is None or abs(w["top"] - key_top) <= 4]
    return {"kind": kind, "date": iso_dmy(date_words[0]["text"]) if date_words else None, "desc": desc,
            "ref": " ".join(ref) or None, "amounts": amounts}


def _summary(text: str) -> dict[str, dict]:
    out: dict[str, dict] = {}
    lines = [ln.strip() for ln in text.splitlines()]
    for i, ln in enumerate(lines):
        m = re.match(r"^(.*?)(\d{12}) ([A-Z]{3}) (.*)$", ln)
        if not m:
            continue
        prefix, acct, ccy, _rest = m.groups()
        product = prefix.strip() or (lines[i - 1] + " " + (lines[i + 1] if i + 1 < len(lines) else "")).strip()
        out[acct[-4:]] = {"product": re.sub(r"\s+", " ", product), "currency": ccy}
    return out


def parse_consolidated(pdf: Any) -> list[StatementSection]:
    p1 = clean_text(pdf.pages[0].extract_text() or "")
    holder_line = p1.splitlines()[1].strip() if len(p1.splitlines()) > 1 else None
    per = re.search(r"Statement Period (\d{2}/\d{2}/\d{4}) to (\d{2}/\d{2}/\d{4})", p1)
    pf, pt = (iso_dmy(per.group(1)), iso_dmy(per.group(2))) if per else (None, None)
    summary = _summary(p1)
    sections: dict[str, dict] = {}
    order: list[str] = []
    issues: list[str] = []
    for pno, page in enumerate(pdf.pages, 1):
        text = clean_text(page.extract_text() or "")
        m = re.search(r"(Current|Savings) Account Statement.*?\nAccount No (\d{12}) ([A-Z]{3})", text, re.S)
        if not m or "Statement for Period" not in text:
            continue
        acct_type, acct, ccy = m.groups()
        sec = sections.get(acct)
        if sec is None:
            sec = sections[acct] = {"type": acct_type, "acct": acct, "currency": ccy, "bands": []}
            order.append(acct)
        words = _page_words(page)
        bounds = _columns(words)
        if bounds is None:
            issues.append(f"page {pno}: transaction table header not found; page skipped")
            continue
        ys = sorted({round(ln["top"], 1) for ln in page.lines
                     if abs(ln["top"] - ln["bottom"]) < 1 and ln["x0"] < 60 and ln["top"] > bounds["header_bottom"]})
        for y0, y1 in zip(ys, ys[1:]):
            bw = [w for w in words if y0 <= (w["top"] + w["bottom"]) / 2 < y1]
            if bw:
                band = _band(bw, bounds)
                band["page"] = pno
                sec["bands"].append(band)

    out: list[StatementSection] = []
    for acct in order:
        sec = sections[acct]
        rows: list[dict] = []
        opening = closing = None
        for b in sec["bands"]:
            k = b["kind"]
            if k == "opening":
                opening = b["amounts"]["balance"]
            elif k == "closing":
                closing = b["amounts"]["balance"]
            elif k == "continuation":
                if rows:
                    rows[-1]["desc"] += " " + b["desc"]
            elif k == "txn":
                a = b["amounts"]
                rows.append({"date": b["date"], "desc": b["desc"], "ref": b["ref"], "page": b["page"],
                             "debit": a["debit"] or None, "credit": a["credit"] or None, "balance": a["balance"]})
        srows = [_finish_row(StatementRow(date=r["date"], description=fix_description(r["desc"]),
                                          debit_fils=r["debit"], credit_fils=r["credit"], balance_fils=r["balance"],
                                          ref=r["ref"], page=r["page"])) for r in rows]
        info = summary.get(acct[-4:], {})
        product = info.get("product") or f"Neo {sec['type']} Account"
        s = StatementSection(
            bank=BANK, product=product, account_type=_account_type(sec["type"]), last4=acct[-4:],
            currency=sec["currency"], holder=holder_line, period_from=pf, period_to=pt,
            opening_fils=opening, closing_fils=closing if closing is not None else (srows[-1].balance_fils if srows else opening),
            rows=srows, issues=list(issues),
        )
        s.notes.append("the summary page shows balances at statement generation time; the period closing balance is used")
        out.append(s)
    return out
