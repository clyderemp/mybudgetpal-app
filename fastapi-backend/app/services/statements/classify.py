"""What a statement row *is*, from its text alone (pure; no household data).

``classify_row`` returns ``RowFacts``: a display name (merchant/payee), whether the bank printed no
name at all, the kind of movement (card purchase, person transfer, account transfer, card payment,
BNPL instalment, ATM, ...), the other account's last 4 digits when printed, and a category hint.
Matching against the household's accounts, rules and transactions happens in ``matching``.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.services.statements.types import StatementRow

# Kinds
PURCHASE = "purchase"        # card purchase (or refund when money comes in)
PERSON = "person"            # transfer to/from a named person or company
ACCOUNT = "account"          # account-to-account transfer with the other account's number
CARD_PAYMENT = "card_payment"  # payment to a credit card (other account = the card)
BNPL = "bnpl"                # Tabby / Tamara instalment
ATM = "atm"                  # cash withdrawal
CASH_DEPOSIT = "cash_deposit"
SALARY = "salary"
FEE = "fee"
INTEREST = "interest"
REMITTANCE = "remittance"    # international (TT) remittance
OTHER = "other"

PURPOSES = (
    "Family Support", "Family support", "Goods Bought or Sold", "Goods or Services Bought", "Personal Investments",
    "Educational Support", "Rent Payments", "Professional Consulting Services", "Sent from Wio Bank",
    "Own Account Transfer", "Salary", "Charity",
)
PURPOSE_RES = {p: re.compile(r"\s?".join(re.escape(c) for c in p.replace(" ", "")), re.I) for p in PURPOSES}
CITY_TAIL = re.compile(
    r"\s+(L?DUBAI|I?DUBAI|Dubai|DAI DX|R?ABU DHABI|ABUDHABI|Abu Dhabi|AL AIN|ALAIN|AAIN AI|Sharjah|SHARJAH|"
    r"AJMAN|STOCKHOLM|Stockholm|San Mateo|LONDON|800[−-]\d+|\S+\.COM?|\S+\.co)$", re.I)
BNPL_NAMES = ("TABBY", "TAMARA", "POSTPAY", "CASHEW")


@dataclass
class RowFacts:
    kind: str
    label: str                     # what to show as merchant/payee
    name: str | None = None        # cleaned real name (None when the bank printed none)
    no_name: bool = False
    note: str = ""
    counter_last4: str | None = None   # other account's last 4 (IBAN / account / card)
    counter_name: str | None = None    # payee / payer name as printed (own-transfer check)
    counter_bank: str | None = None    # IPP bank code of the other side (e.g. BOM, ADC)
    bnpl: str | None = None
    category_hint: str | None = None   # category *name* suggestion
    match_text: str = ""
    extra: dict = field(default_factory=dict)


def title(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip(" ,-/")
    return s.title() if s.isupper() or s.islower() else s


def _card_merchant(desc: str) -> tuple[str, bool]:
    """Merchant text of an ENBD 'CARD NO.' row, and whether it is an ATM withdrawal."""
    body = re.sub(r"^CARD NO\.\S+\s*", "", desc)
    atm = re.search(r"\d{2}:\d{2}:\d{2}\s+[A-Z]\d{7}\s+\d{6}\s+(.*?)(?:,\s*ATM)?\s+(?:DUBAI|Dubai)?\s*AE$", body)
    if atm:
        return atm.group(1).strip(" ,"), True
    body = re.split(r":(?:AE|US|SE|LU|GB|IE|NL|SG|IN|PH|CA)\b", body)[0]
    body = re.split(r"\s+AE\s+\S*\d{6}", body)[0]
    body = re.split(r"\s+AE\s+AD\d+", body)[0]
    for _ in range(2):
        body = CITY_TAIL.sub("", body)
    return body.strip(" ,-"), False


def _mashreq_card_merchant(desc: str) -> str:
    raw = re.sub(r"^.*?Card number ending with \d{4},?\s*", "", desc)
    raw = re.sub(r"\s+\.\.\d{4}\s+AED\s+\d+\s+DUBAI$|\s+\d{6}\s+DUBAI$|\s+DUBAI$", "", raw)
    raw = re.sub(r"\s+\d{6,}$", "", raw)
    return raw.strip(" ,-")


def _split_name_note(tail: str) -> tuple[str, str]:
    """'JOSEPH MBALU MUTISYA Family support' -> ('JOSEPH MBALU MUTISYA', 'Family support')."""
    tail = re.sub(r"\s*/\s?RE\s?F\s?/\s*", " ", tail).strip()
    for p in PURPOSES:  # bank line wraps can split words anywhere: allow a space between letters
        m = PURPOSE_RES[p].search(tail)
        if m and m.start() > 0:
            return tail[: m.start()].strip(), tail[m.start():].strip()
    words = tail.split()
    if words and words[0].isupper():
        k = 0
        while k < len(words) and (words[k].isupper() or not words[k].isalpha()) and not words[k].isdigit():
            k += 1
        return " ".join(words[:k]), " ".join(words[k:])
    k = 0
    while k < len(words) and words[k][:1].isupper():
        k += 1
    return " ".join(words[:k]), " ".join(words[k:])


def _person(desc: str) -> tuple[str | None, str]:
    """(payee/payer name, free-text note) from a person-to-person transfer row."""
    m = re.search(r"FASTPAY TRANSFER (?:FROM|TO) (.+?) MOB\s?IL", desc)
    if m:
        note = re.sub(r".*BNK REF\.-\S+\s*\d*\s*", "", desc).strip()
        return m.group(1), "" if note.lower() in ("mepay", "") else note
    m = re.search(r"MOBILE BANKING TRANSFER (?:FROM|TO) ([A-Z][A-Z .'-]+?) AE(?:\.\.|\s?\d)", desc)
    if m:
        return m.group(1), re.sub(r".*RefNo:-\s*\S+\s*", "", desc).strip()
    m = re.search(r"IPP TRANSFER \S+ - (.+?) - ", desc)  # Mashreq
    if m:
        parts = desc.split(" - ")
        return m.group(1), (parts[3].strip() if len(parts) > 3 and not parts[3].strip().startswith("T_") else "")
    m = re.search(r"A\s?ED\s+[\d .]+?\s+([A-Za-z].*)$", desc)  # ENBD IPP / RMA tail
    if m and desc.startswith(("IPP", "RMA")):
        tail = re.sub(r"\bAE\.\.\d{4}\b|\.\.\d{4}\b|\b(?=[A-Z]*\d)[A-Z0-9]{8,}\b", " ", m.group(1))
        if not re.search(r"[A-Za-z]{2,}", tail):
            return None, ""
        name, note = _split_name_note(tail.strip())
        return (name or None), note
    m = re.search(r"TT REF:\s*\S+\s+AED\s+[\d.]+\s+/\d+/\d+\s+(.+?)\s*/REF/(.*)$", desc)
    if m:
        return re.sub(r"\b([A-Z]{1,3}) ([A-Z]+)\b", r"\1\2", m.group(1)), m.group(2).strip()
    return None, ""


def _counter_from_account_numbers(desc: str, own_last4: str | None) -> str | None:
    m = re.search(r"FROM ACCOUNT No:\s*\.\.(\d{4})\s+TO ACCOUNT No:\s*\.\.(\d{4})", desc)
    if m:
        a, b = m.groups()
        return b if a == own_last4 else a
    return None


def classify_row(row: StatementRow, section_last4: str | None) -> RowFacts:
    d = row.description
    up = d.upper()
    incoming = row.direction == "in"
    cp = row.counterparty_last4
    to_from = "from" if incoming else "to"

    def facts(kind: str, label: str, name: str | None = None, **kw) -> RowFacts:  # type: ignore[no-untyped-def]
        f = RowFacts(kind=kind, label=label, name=name, **kw)
        f.match_text = f"{label} {d}"
        return f

    # credit-card payment: the description is just the masked card number
    if re.fullmatch(r"(?:\d{6}|XXXX)X*(\d{4})", d.strip()):
        last4 = row.card_last4 or d.strip()[-4:]
        return facts(CARD_PAYMENT, f"Card payment ..{last4}", None, counter_last4=last4, category_hint="Debt payment")

    # own-account style transfers that print the other account number
    other = _counter_from_account_numbers(d, section_last4)
    if other or up.startswith(("ACCT TO ACCT", "ACCOUNT TO ACCOUNT")):
        other = other or cp
        name, note = _person(d)
        if not name:
            m = re.search(r"\.\.\d{4} - ([A-Za-z][A-Za-z ]+?)(?:TOC-| TOC-|\s-\s|$)", d)
            name = m.group(1).strip() if m else None
        label = f"Transfer {to_from} ..{other}" if other else "Account transfer"
        return facts(ACCOUNT, label, None, counter_last4=other, counter_name=name, note="")

    if up.startswith("MOBILE BANKING TRANSFER"):
        name, note = _person(d)
        if name:
            return facts(PERSON, title(name), title(name), counter_last4=cp, counter_name=name, note=note)
        return facts(ACCOUNT, f"Transfer {to_from} ..{cp}" if cp else "Mobile banking transfer", None,
                     no_name=True, counter_last4=cp, note=re.sub(r".*RefNo:-\s*\S+\s*", "", d).strip())

    # card rows
    if up.startswith("CARD NO."):
        raw, atm = _card_merchant(d)
        if atm:
            return facts(ATM, f"ATM {title(raw)}" if raw else "ATM withdrawal", f"ATM {title(raw)}")
        for b in BNPL_NAMES:
            if b in raw.upper():
                return facts(BNPL, b.title(), b.title(), bnpl=b.title(), category_hint="Debt payment")
        if not raw:
            return facts(PURCHASE, f"Card purchase ..{row.card_last4 or ''}".rstrip("."), None, no_name=True)
        note = f"{row.original_amount} {row.original_currency}" if row.original_currency else ""
        return facts(PURCHASE, title(raw), title(raw), note=note,
                     category_hint="Other income" if incoming else None)
    if up.startswith("DEBIT CARD PURCHASE") or "CARD NUMBER ENDING WITH" in up:
        raw = _mashreq_card_merchant(d)
        if not raw:
            return facts(PURCHASE, f"Card purchase ..{row.card_last4}" if row.card_last4 else "Card purchase", None,
                         no_name=True)
        for b in BNPL_NAMES:
            if b in raw.upper():
                return facts(BNPL, b.title(), b.title(), bnpl=b.title(), category_hint="Debt payment")
        return facts(PURCHASE, title(raw), title(raw))

    # salary / fees / interest / bonus
    if re.search(r"JOINING BENEFIT|CASHBACK|BONUS", up) and incoming:
        return facts(INTEREST, "Bank reward", "Bank reward", category_hint="Other income")
    if "SALARY" in up and incoming:
        name, note = _person(d)
        m = re.search(r"Salary From (\S+)", d)
        label = title(name) if name else ("Salary " + m.group(1) if m else "Salary")
        return facts(SALARY, label, label, category_hint="Salary", note=note)
    if re.search(r"CHEQUE RETURN|FALL BELOW|VALUE ADDED TAX|INT\.COLL|\bCHARGES?\b|\bFEES?\b", up) and not incoming:
        label = "Bank fee (VAT)" if "VALUE ADDED TAX" in up else ("Bank interest/charge" if "INT.COLL" in up else "Bank fee")
        return facts(FEE, label, label, category_hint="Fees")
    if "INTEREST" in up and incoming:
        return facts(INTEREST, "Interest", "Interest", category_hint="Other income")

    # cash
    if up.startswith("SDM REF") or "CASH DEPOSIT" in up:
        where = d.split(";")[-1].strip() if ";" in d else ""
        label = f"Cash deposit {title(where)}".strip()
        return facts(CASH_DEPOSIT, label, label)

    # international remittance (TT abroad)
    if up.startswith("RMA TT REF") or (up.startswith("RMA") and re.search(r"\b(?!AED)[A-Z]{3}\s?\d+(?:\.\d+)?@", up)):
        m = re.search(r"\b([A-Z]{3})\s?(\d+(?:\.\d+)?)@([\d.]+)", d)
        n = re.search(r"\s([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})$", d)
        if m:
            label = f"International remittance ({m.group(1)})"
            return facts(REMITTANCE, label, label, note=f"{m.group(1)} {m.group(2)} @ {m.group(3)}",
                         counter_name=n.group(1) if n else None, category_hint="Debt payment")
        name = n.group(1) if n else None
        label = f"{name} (international remittance)" if name else "International remittance"
        return facts(REMITTANCE, label, name, no_name=name is None, counter_name=name)

    # person / bank transfers (FASTPAY, IPP, RMA)
    if up.startswith(("FASTPAY", "IPP", "RMA", "VALUE DATE")) or "IPP TRANSFER" in up:
        name, note = _person(d)
        m = re.match(r"^IPP \d{8}([A-Z]{3})", d)
        bank = m.group(1) if m else None
        if name:
            return facts(PERSON, title(name), title(name), counter_last4=cp, counter_name=name, counter_bank=bank,
                         note=note)
        return facts(PERSON, f"Transfer {to_from} ..{cp}" if cp else f"Bank transfer {to_from} unknown", None,
                     no_name=True, counter_last4=cp, counter_bank=bank, note=note)
    if "CHQ" in up or "CHEQUE" in up:
        m = re.search(r"CHQ\.? NO:?\s*(\d+)", d)
        label = f"Cheque {m.group(1)}" if m else "Cheque"
        return facts(OTHER, label, label)

    label = title(re.sub(r"\s+\S*\d{5,}\S*", "", d)[:60]) or "Bank transaction"
    return facts(OTHER, label, label)


def holder_names(holder: str | None) -> list[str]:
    """Account holder line -> individual names ('A AND OR B' / 'A AND/OR B')."""
    if not holder:
        return []
    parts = re.split(r"\s+AND\s*/?\s*OR\s+|\s+AND\s+|\s*&\s*", holder.upper())
    return [p.strip() for p in parts if len(p.split()) >= 2]


def _tokens(name: str) -> set[str]:
    return {t for t in re.findall(r"[A-Z]{2,}", name.upper())}


def same_person(name: str | None, holders: list[str]) -> bool:
    """True when a printed payee/payer name is one of the statement's account holders."""
    if not name:
        return False
    toks = _tokens(name)
    if len(toks) < 2:
        return False
    for h in holders:
        ht = _tokens(h)
        common = toks & ht
        if len(common) >= 2 and len(common) >= 0.6 * min(len(toks), len(ht)):
            return True
    return False
