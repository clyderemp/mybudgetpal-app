"""Map parsed statement rows onto the household's data ("auto map to the logged data").

``propose(imp, ctx)`` is pure given a ``MatchContext`` (accounts, categories, rules, existing
transactions): for every row it decides one proposal —

* already recorded  -> skip (same source_ref; else same account, amount and direction, date within
  ±2 days, best merchant similarity first, one-to-one);
* transfer between the household's own accounts -> ONE transfer record (the debit leg; the credit
  leg in the same upload is linked and skipped; a leg already recorded from an earlier upload of
  the other account counts as recorded);
* new income / expense with a category from the merchant rules (or a built-in hint);
* needs review: no merchant/payee name (needs_review, review_reason="no_name"), or a transfer to
  one of the holder's own accounts that isn't in the app yet ("unknown_account").

Rows a person edited (``edited``) keep their values.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from beanie import PydanticObjectId

from app.models import Account, Category, Transaction
from app.models.imports import ImportRow, ImportSection, StatementImport
from app.services.merchant_rules import CompiledRule, match_rule
from app.services.statements import classify as C
from app.services.statements.types import StatementRow

DATE_WINDOW = 2  # days either side for "already recorded" and transfer-leg matching
BANK_CODES = {"Emirates NBD": "enbd", "Mashreq": "mashreq", "CSV": "csv"}


@dataclass
class MatchContext:
    accounts: list[Account]
    categories: list[Category]
    rules: list[CompiledRule]
    existing: list[Transaction] = field(default_factory=list)  # candidates near the statement dates
    by_source_ref: dict[str, Transaction] = field(default_factory=dict)
    skipped_refs: dict[str, str] = field(default_factory=dict)  # source_ref -> file it was skipped in

    def __post_init__(self) -> None:
        self.account_by_id = {str(a.id): a for a in self.accounts}
        self.cat_by_id = {str(c.id): c for c in self.categories}
        self.cat_by_name = {(c.name.lower(), c.kind): c for c in self.categories}

    def category(self, name: str | None, kind: str) -> Category | None:
        return self.cat_by_name.get((name.lower(), kind)) if name else None

    def account_by_last4(self, last4: str | None, exclude: str | None = None,
                         types: tuple[str, ...] | None = None) -> Account | None:
        if not last4:
            return None
        hits = [a for a in self.accounts if a.last4 == last4 and str(a.id) != exclude
                and (types is None or a.type in types)]
        return hits[0] if len(hits) == 1 else (hits[0] if hits else None)


# ------------------------------------------------------------------ helpers
def bank_code(bank: str) -> str:
    return BANK_CODES.get(bank, re.sub(r"\W+", "", bank.lower()) or "bank")


def source_ref_prefix(sec: ImportSection) -> str:
    if sec.last4:
        return f"{bank_code(sec.bank)}:{sec.last4}:"
    return f"{bank_code(sec.bank)}:acct{sec.account_id or 'none'}:"


def assign_source_refs(imp: StatementImport) -> None:
    """Stable per-row key: bank + account + date + direction/amount + bank ref (or a text hash).
    Identical rows on the same day get an occurrence suffix so they stay distinct."""
    seen: Counter[str] = Counter()
    secs = {s.index: s for s in imp.sections}
    for r in imp.rows:
        sec = secs[r.section_index]
        tail = r.ref or "h" + hashlib.sha1(re.sub(r"\W", "", r.description.upper()).encode()).hexdigest()[:10]
        key = f"{source_ref_prefix(sec)}{r.date.isoformat()}:{'i' if r.credit_fils else 'o'}{r.amount_fils}:{tail}"
        seen[key] += 1
        r.source_ref = key if seen[key] == 1 else f"{key}#{seen[key]}"


def auto_map_sections(imp: StatementImport, accounts: list[Account]) -> None:
    for sec in imp.sections:
        if sec.account_id is not None or not sec.last4:
            continue
        hits = [a for a in accounts if a.last4 == sec.last4 and not a.archived]
        if len(hits) > 1:
            word = sec.bank.split()[0].lower()
            hits = [a for a in hits if word in (a.institution or a.name).lower()] or hits
        if hits:
            sec.account_id = hits[0].id


def as_statement_row(r: ImportRow) -> StatementRow:
    return StatementRow(date=r.date, description=r.description, debit_fils=r.debit_fils, credit_fils=r.credit_fils,
                        balance_fils=r.balance_fils, ref=r.ref, card_last4=r.card_last4,
                        counterparty_last4=r.counterparty_last4, original_amount=r.original_amount,
                        original_currency=r.original_currency)


def _words(text: str | None) -> set[str]:
    return set(re.findall(r"[a-z]{3,}", (text or "").lower())) - {"transfer", "card", "purchase", "dubai", "aed"}


def _oid(value: Any) -> PydanticObjectId | None:
    return PydanticObjectId(str(value)) if value else None


# UAE IPP (instant payments) participant codes printed in ENBD references -> a word of the bank's name
IPP_BANKS = {"BOM": "mashreq", "ADC": "adcb", "EBI": "emirates nbd", "ENB": "emirates nbd", "DUI": "dubai islamic",
             "DIB": "dubai islamic", "CBD": "commercial bank of dubai", "WIO": "wio", "FAB": "first abu dhabi",
             "RAK": "rak", "ADI": "abu dhabi islamic", "NBF": "fujairah", "LIV": "liv"}


def _guess_by_bank(code: str | None, ctx: MatchContext, own_id: str | None) -> Account | None:
    word = IPP_BANKS.get(code or "")
    if not word:
        return None
    hits = [a for a in ctx.accounts if str(a.id) != own_id and a.type in ("bank", "savings")
            and word in f"{a.institution or ''} {a.name}".lower()]
    current = [a for a in hits if a.type == "bank"]
    if len(current) == 1:
        return current[0]
    return hits[0] if len(hits) == 1 else None


# ------------------------------------------------------------------ proposal
def _reset(r: ImportRow) -> None:
    r.status, r.action, r.type = "new", "import", "income" if r.credit_fils else "expense"
    r.category_id = r.counter_account_id = r.matched_transaction_id = None
    r.merchant = r.note = r.review_reason = r.paired_row_id = None
    r.needs_review = False
    r.reason = ""


def _propose_one(r: ImportRow, sec: ImportSection, ctx: MatchContext, section_by_last4: dict[str, ImportSection]) -> dict:
    """Classify one row; returns hints used by pairing (counter section, own-by-name)."""
    facts = C.classify_row(as_statement_row(r), sec.last4)
    holders = C.holder_names(sec.holder)
    incoming = r.credit_fils is not None and r.credit_fils > 0
    own_id = str(sec.account_id) if sec.account_id else None
    kind = "income" if incoming else "expense"
    hint: dict = {"counter_section": None, "own_by_name": False, "facts": facts}

    counter: Account | None = None
    transfer = False
    why = ""
    if facts.kind == C.CARD_PAYMENT:
        counter = ctx.account_by_last4(facts.counter_last4, own_id, ("credit_card", "loan"))
        transfer = counter is not None
        why = (f"payment to your card ..{facts.counter_last4}" if transfer else
               f"card ..{facts.counter_last4} is not an account in the app: recorded as a debt payment "
               "(add the card with its last 4 digits to record it as a transfer)")
    elif facts.kind == C.BNPL:
        hits = [a for a in ctx.accounts if facts.bnpl and facts.bnpl.lower() in f"{a.name} {a.institution or ''}".lower()
                and str(a.id) != own_id]
        counter = hits[0] if hits else None
        transfer = counter is not None
        why = f"{facts.bnpl} instalment" + ("" if transfer else f" (no {facts.bnpl} account in the app: recorded as a debt payment)")
    elif facts.kind in (C.ATM, C.CASH_DEPOSIT):
        cash = [a for a in ctx.accounts if a.type == "cash" and str(a.id) != own_id]
        counter = next((a for a in cash if a.currency == sec.currency), cash[0] if cash else None)
        transfer = counter is not None
        what = "cash withdrawal" if facts.kind == C.ATM else "cash deposit"
        why = f"{what}" + (f" (moves money {'to' if facts.kind == C.ATM else 'from'} {counter.name})" if counter else
                            " (no cash account in the app)")
    elif facts.kind in (C.ACCOUNT, C.PERSON, C.REMITTANCE) and not (facts.kind == C.REMITTANCE and facts.category_hint):
        other_sec = section_by_last4.get(facts.counter_last4 or "")
        if other_sec is not None and other_sec.index != sec.index:
            hint["counter_section"] = other_sec.index
            counter = ctx.account_by_id.get(str(other_sec.account_id)) if other_sec.account_id else None
            transfer = True
            why = f"transfer between your accounts (..{sec.last4} and ..{other_sec.last4})"
        else:
            counter = ctx.account_by_last4(facts.counter_last4, own_id)
            if counter is not None:
                transfer = True
                why = f"transfer between your accounts ({counter.name} ..{counter.last4})"
            elif C.same_person(facts.counter_name, holders) and facts.kind != C.REMITTANCE:
                transfer = True
                hint["own_by_name"] = True
                why = "transfer to/from an account in the holder's own name"
                counter = _guess_by_bank(facts.counter_bank, ctx, own_id)
                if counter is not None:
                    why += f" — probably {counter.name} (bank code {facts.counter_bank})"

    if facts.note:
        r.note = facts.note[:1000]
    if transfer:
        r.type = "transfer"
        r.counter_account_id = counter.id if counter else None
        if counter is not None:
            r.merchant = f"{'From' if incoming else 'To'} {counter.name}"
            r.status = "transfer"
        else:
            r.merchant = facts.label
            r.status = "review"
            r.needs_review, r.review_reason = True, "unknown_account"
            why += ": pick the other account (or create it) before importing"
        r.reason = why
        return hint

    r.type = kind  # type: ignore[assignment]
    rule = match_rule(ctx.rules, facts.match_text, kind)
    cat = ctx.cat_by_id.get(rule.category_id) if rule and rule.category_id else None
    name = facts.name
    if rule and rule.merchant:
        name = rule.merchant
    r.merchant = (name or facts.label)[:200]
    if cat is None:
        cat = ctx.category(facts.category_hint, kind)
        why = why or (f"category from the bank text ({facts.category_hint})" if cat else "")
    else:
        why = f"rule “{rule.pattern}” → {cat.name}" + (f"; {why}" if why else "")  # type: ignore[union-attr]
    if cat is None:
        cat = ctx.category("Other" if kind == "expense" else "Other income", kind)
        why = why or "no rule matched: uncategorised (Other)"
    r.category_id = cat.id if cat else None
    if name is None:  # the bank printed no merchant / payee name
        r.status = "review"
        r.needs_review, r.review_reason = True, "no_name"
        why = "no merchant or payee name on the statement" + (f"; {why}" if why else "")
    r.reason = why
    return hint


def _days(a: dt.date, b: dt.date) -> int:
    return abs((a - b).days)


def _pair_transfers(imp: StatementImport, hints: dict[str, dict], ctx: MatchContext) -> None:
    """Both legs of one own-account transfer in this upload -> keep the debit leg, link the credit leg."""
    secs = {s.index: s for s in imp.sections}
    rows = [r for r in imp.rows if not r.edited and r.type == "transfer" and r.status != "recorded"]
    outs = [r for r in rows if r.debit_fils]
    ins = [r for r in rows if r.credit_fils]
    cands = []
    for o in outs:
        for i in ins:
            if i.section_index == o.section_index or i.amount_fils != o.amount_fils or _days(i.date, o.date) > DATE_WINDOW:
                continue
            ho, hi = hints[o.id], hints[i.id]
            o_ok = ho["counter_section"] == i.section_index or (ho["own_by_name"] and hi["counter_section"] in (None, o.section_index))
            i_ok = hi["counter_section"] == o.section_index or (hi["own_by_name"] and ho["counter_section"] in (None, i.section_index))
            if not (o_ok and i_ok):
                continue
            same_ref = bool(o.ref and o.ref == i.ref)
            cands.append((not same_ref, _days(i.date, o.date), o.id, i.id, o, i))
    cands.sort(key=lambda c: c[:4])
    used: set[str] = set()
    for *_, o, i in cands:
        if o.id in used or i.id in used:
            continue
        used |= {o.id, i.id}
        so, si = secs[o.section_index], secs[i.section_index]
        acc_i = ctx.account_by_id.get(str(si.account_id)) if si.account_id else None
        o.counter_account_id = si.account_id
        o.paired_row_id, i.paired_row_id = i.id, o.id
        o.merchant = f"To {acc_i.name}" if acc_i else f"To ..{si.last4}"
        o.reason = f"transfer between your accounts (..{so.last4} → ..{si.last4}); the other leg is row {i.id}"
        if si.account_id is None:
            o.status, o.needs_review, o.review_reason = "review", True, "unknown_account"
            o.reason += ": map ..%s to an account first" % si.last4
        else:
            o.status, o.needs_review, o.review_reason = "transfer", False, None
        i.counter_account_id = so.account_id
        i.status, i.action, i.needs_review, i.review_reason = "transfer", "skip", False, None
        i.reason = f"credit leg of the transfer recorded from row {o.id} (..{so.last4} → ..{si.last4})"


def _match_recorded(imp: StatementImport, ctx: MatchContext, facts_by_id: dict[str, C.RowFacts]) -> None:
    secs = {s.index: s for s in imp.sections}
    claimed: set[str] = set()
    pending = []
    for r in imp.rows:
        if r.edited:
            if r.matched_transaction_id:
                claimed.add(str(r.matched_transaction_id))
            continue
        t = ctx.by_source_ref.get(r.source_ref)
        if t is not None:
            r.status, r.action, r.matched_transaction_id = "recorded", "skip", t.id
            r.needs_review, r.review_reason = False, None
            r.reason = "already imported (same statement row)"
            claimed.add(str(t.id))
            continue
        if r.source_ref in ctx.skipped_refs:
            r.status, r.action = "recorded", "skip"
            r.needs_review, r.review_reason = False, None
            r.reason = f"skipped when {ctx.skipped_refs[r.source_ref]} was imported"
            continue
        pending.append(r)
    cands = []
    for r in pending:
        sec = secs[r.section_index]
        if sec.account_id is None:
            continue
        acc = str(sec.account_id)
        prefix = source_ref_prefix(sec)
        text = _words(f"{facts_by_id[r.id].label} {r.merchant} {r.description}")
        for t in ctx.existing:
            if t.amount_fils != r.amount_fils or _days(t.date, r.date) > DATE_WINDOW:
                continue
            if t.source_ref and t.source_ref.startswith(prefix):
                continue  # imported from this account's statements: only the exact key may match
            if r.credit_fils:
                ok = (t.type == "income" and str(t.account_id) == acc) or (t.type == "transfer" and str(t.to_account_id) == acc)
            else:
                ok = (t.type == "expense" and str(t.account_id) == acc) or (t.type == "transfer" and str(t.account_id) == acc)
            if not ok:
                continue
            sim = len(text & _words(f"{t.merchant} {t.note}"))
            if t.type == "transfer" and r.counter_account_id is not None:
                other = t.to_account_id if r.debit_fils else t.account_id
                sim += 2 if str(other) == str(r.counter_account_id) else 0
            cands.append((-sim, _days(t.date, r.date), r.id, str(t.id), r, t))
    cands.sort(key=lambda c: c[:4])
    done: set[str] = set()
    for *_, r, t in cands:
        if r.id in done or str(t.id) in claimed:
            continue
        done.add(r.id)
        claimed.add(str(t.id))
        r.status, r.action, r.matched_transaction_id = "recorded", "skip", t.id
        r.needs_review, r.review_reason = False, None
        what = f"“{t.merchant}”" if t.merchant else t.type
        r.reason = f"already in the app: {what} on {t.date.isoformat()}"
    # a transfer leg counts as recorded when its partner is
    by_id = {r.id: r for r in imp.rows}
    for r in imp.rows:
        p = by_id.get(r.paired_row_id or "")
        if p is not None and not r.edited and p.status == "recorded" and r.status != "recorded":
            r.status, r.action, r.needs_review, r.review_reason = "recorded", "skip", False, None
            r.matched_transaction_id = p.matched_transaction_id
            r.reason = f"the other leg (row {p.id}) is already in the app"


def propose(imp: StatementImport, ctx: MatchContext) -> None:
    assign_source_refs(imp)
    secs = {s.index: s for s in imp.sections}
    section_by_last4 = {s.last4: s for s in imp.sections if s.last4}
    hints: dict[str, dict] = {}
    for r in imp.rows:
        if r.edited:
            hints[r.id] = {"counter_section": None, "own_by_name": False,
                           "facts": C.classify_row(as_statement_row(r), secs[r.section_index].last4)}
            continue
        _reset(r)
        hints[r.id] = _propose_one(r, secs[r.section_index], ctx, section_by_last4)
    _pair_transfers(imp, hints, ctx)
    _match_recorded(imp, ctx, {k: v["facts"] for k, v in hints.items()})


def counts(rows: list[ImportRow]) -> dict[str, int]:
    out = {"total": len(rows), "new": 0, "recorded": 0, "transfer": 0, "review": 0, "to_import": 0, "skipped": 0}
    for r in rows:
        out[r.status] += 1
        if r.action == "import" and r.status != "recorded":
            out["to_import"] += 1
        elif r.action == "skip" and r.status != "recorded" and not r.paired_row_id:
            out["skipped"] += 1
    return out
