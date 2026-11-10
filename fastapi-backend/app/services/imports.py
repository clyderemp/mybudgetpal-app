"""Staged statement imports: build from an upload, re-match, commit, roll back (DB glue)."""
from __future__ import annotations

import datetime as dt
import hashlib
from typing import Any

from beanie import PydanticObjectId

from app.errors import AppError, validation_error
from app.models import Account, Category, Transaction, utcnow
from app.models.imports import (
    AccountCheck,
    CommitResult,
    ImportReconciliation,
    ImportRow,
    ImportSection,
    MerchantRule,
    StatementImport,
)
from app.services.merchant_rules import compile_rules, ensure_default_rules
from app.services.statements import ParsedStatement
from app.services.statements.matching import MatchContext, auto_map_sections, propose

INSERT_CHUNK = 500


def build_import(parsed: ParsedStatement, data: bytes, filename: str, household_id: PydanticObjectId,
                 user_id: PydanticObjectId) -> StatementImport:
    sections, rows = [], []
    for i, s in enumerate(parsed.sections):
        rec = s.reconciliation
        sections.append(ImportSection(
            index=i, bank=s.bank, product=s.product, account_type=s.account_type, last4=s.last4,
            iban_last4=s.iban_last4, currency=s.currency, holder=s.holder, period_from=s.period_from,
            period_to=s.period_to, opening_fils=s.opening_fils, closing_fils=s.closing_fils,
            total_debit_fils=s.total_debit_fils, total_credit_fils=s.total_credit_fils,
            reconciliation=ImportReconciliation(ok=rec.ok, arithmetic_ok=rec.arithmetic_ok,
                                                running_balance_ok=rec.running_balance_ok,
                                                messages=rec.messages + s.notes),
        ))
        for j, r in enumerate(s.rows):
            if not (r.debit_fils or r.credit_fils):
                continue
            rows.append(ImportRow(
                id=f"{i}-{j}", section_index=i, date=r.date, description=r.description[:1000],
                debit_fils=r.debit_fils, credit_fils=r.credit_fils, balance_fils=r.balance_fils, ref=r.ref,
                card_last4=r.card_last4, counterparty_last4=r.counterparty_last4,
                original_amount=r.original_amount, original_currency=r.original_currency,
            ))
    return StatementImport(
        household_id=household_id, filename=filename[:200] or "statement", file_sha256=hashlib.sha256(data).hexdigest(),
        bank=parsed.bank, format=parsed.format, sections=sections, rows=rows, issues=parsed.issues[:50],
        created_by=user_id,
    )


async def load_context(imp: StatementImport) -> MatchContext:
    hid = imp.household_id
    await ensure_default_rules(hid)
    accounts = await Account.find({"household_id": hid, "archived": False}).to_list()
    categories = await Category.find({"household_id": hid, "archived": False}).to_list()
    rules = await MerchantRule.find({"household_id": hid, "archived": False}).to_list()
    ctx_rules = compile_rules(rules, {str(c.id): c.kind for c in categories})

    existing: list[Transaction] = []
    by_ref: dict[str, Transaction] = {}
    skipped: dict[str, str] = {}
    if imp.rows:
        acc_ids = list({s.account_id for s in imp.sections if s.account_id})
        lo = min(r.date for r in imp.rows) - dt.timedelta(days=5)
        hi = max(r.date for r in imp.rows) + dt.timedelta(days=5)
        if acc_ids:
            existing = await Transaction.find({
                "household_id": hid, "deleted_at": None,
                "date": {"$gte": dt.datetime.combine(lo, dt.time.min), "$lte": dt.datetime.combine(hi, dt.time.min)},
                "$or": [{"account_id": {"$in": acc_ids}}, {"to_account_id": {"$in": acc_ids}}],
            }).to_list()
        # keys are assigned by propose(); compute them up front for the lookup
        from app.services.statements.matching import assign_source_refs

        assign_source_refs(imp)
        refs = [r.source_ref for r in imp.rows]
        for t in await Transaction.find({"household_id": hid, "deleted_at": None, "source_ref": {"$in": refs}}).to_list():
            by_ref[t.source_ref or ""] = t
        prior = await StatementImport.find({"household_id": hid, "status": "committed", "_id": {"$ne": imp.id},
                                            "rows.source_ref": {"$in": refs}}).to_list()
        wanted = set(refs)
        for p in prior:
            for r in p.rows:
                if r.source_ref in wanted and r.action == "skip" and r.status != "recorded" and not r.paired_row_id:
                    skipped[r.source_ref] = p.filename
    return MatchContext(accounts=accounts, categories=categories, rules=ctx_rules, existing=existing,
                        by_source_ref=by_ref, skipped_refs=skipped)


async def rematch(imp: StatementImport, map_accounts: bool = False) -> None:
    ctx = await load_context(imp)
    if map_accounts:
        auto_map_sections(imp, ctx.accounts)
        ctx = await load_context(imp)  # candidates depend on the mapped accounts
    propose(imp, ctx)


def require_draft(imp: StatementImport) -> None:
    if imp.status != "draft":
        raise AppError(409, "import_not_draft", f"This import is {imp.status.replace('_', ' ')}; it can't be changed")


async def apply_row_edits(imp: StatementImport, edits: list[dict[str, Any]], household_id: PydanticObjectId) -> None:
    rows = {r.id: r for r in imp.rows}
    cat_ids = {e["category_id"] for e in edits if e.get("category_id")}
    acc_ids = {e["counter_account_id"] for e in edits if e.get("counter_account_id")}
    cats = {str(c.id): c for c in await Category.find(
        {"household_id": household_id, "_id": {"$in": [PydanticObjectId(x) for x in cat_ids]}}).to_list()} if cat_ids else {}
    accs = {str(a.id) for a in await Account.find(
        {"household_id": household_id, "_id": {"$in": [PydanticObjectId(x) for x in acc_ids]}}).to_list()} if acc_ids else set()
    fields: dict[str, str] = {}
    for e in edits:
        r = rows.get(e["id"])
        if r is None:
            fields[f"rows.{e['id']}"] = "row not found"
            continue
        if "type" in e and e["type"]:
            r.type = e["type"]
            if r.type == "transfer":
                r.category_id = None
            else:
                r.counter_account_id = None
        if e.get("category_id"):
            cat = cats.get(e["category_id"])
            if cat is None:
                fields[f"rows.{r.id}.categoryId"] = "category not found"
                continue
            r.category_id = cat.id
            if r.type == "transfer":
                r.type = cat.kind  # type: ignore[assignment]
                r.counter_account_id = None
        if "counter_account_id" in e:
            if e["counter_account_id"] and e["counter_account_id"] not in accs:
                fields[f"rows.{r.id}.counterAccountId"] = "account not found"
                continue
            r.counter_account_id = PydanticObjectId(e["counter_account_id"]) if e["counter_account_id"] else None
            if r.counter_account_id is not None:
                r.type = "transfer"
                r.category_id = None
                if r.review_reason == "unknown_account":
                    r.needs_review, r.review_reason = False, None
        if "merchant" in e:
            r.merchant = e["merchant"] or None
            if r.merchant and r.review_reason == "no_name":
                r.needs_review, r.review_reason = False, None
        if "note" in e:
            r.note = e["note"] or None
        if e.get("needs_review") is not None:
            r.needs_review = bool(e["needs_review"])
            r.review_reason = r.review_reason if r.needs_review else None
        if e.get("action"):
            r.action = e["action"]
        r.edited = True
        if r.status == "review" and not r.needs_review:
            r.status = "transfer" if r.type == "transfer" else "new"
    if fields:
        raise validation_error(fields)


# ------------------------------------------------------------------ commit / rollback
async def balances_as_of(household_id: PydanticObjectId, account_ids: list[PydanticObjectId],
                         as_of: dt.date | None) -> dict[str, int]:
    match: dict[str, Any] = {"household_id": household_id, "deleted_at": None,
                             "$or": [{"account_id": {"$in": account_ids}}, {"to_account_id": {"$in": account_ids}}]}
    if as_of is not None:
        match["date"] = {"$lte": dt.datetime.combine(as_of, dt.time.min)}
    pipeline = [{"$match": match},
                {"$group": {"_id": {"a": "$account_id", "t": "$to_account_id", "y": "$type"}, "s": {"$sum": "$amount_fils"}}}]
    out: dict[str, int] = {}
    for row in await Transaction.get_motor_collection().aggregate(pipeline).to_list(None):
        key, total = row["_id"], int(row["s"])
        a, t, y = str(key.get("a")), key.get("t"), key.get("y")
        if y == "income":
            out[a] = out.get(a, 0) + total
        elif y == "expense":
            out[a] = out.get(a, 0) - total
        elif y == "transfer":
            out[a] = out.get(a, 0) - total
            if t is not None:
                out[str(t)] = out.get(str(t), 0) + total
    return out


async def account_checks(imp: StatementImport) -> list[AccountCheck]:
    secs = [s for s in imp.sections if s.account_id]
    if not secs:
        return []
    accounts = {str(a.id): a for a in await Account.find(
        {"household_id": imp.household_id, "_id": {"$in": [s.account_id for s in secs]}}).to_list()}
    now = await balances_as_of(imp.household_id, [s.account_id for s in secs], None)  # type: ignore[misc]
    checks = []
    for s in secs:
        acc = accounts.get(str(s.account_id))
        if acc is None:
            continue
        at = await balances_as_of(imp.household_id, [acc.id], s.period_to)  # type: ignore[list-item]
        app_bal = acc.opening_balance_fils + at.get(str(acc.id), 0)
        checks.append(AccountCheck(
            section_index=s.index, account_id=acc.id, account_name=acc.name, period_to=s.period_to,  # type: ignore[arg-type]
            statement_closing_fils=s.closing_fils, app_balance_fils=app_bal,
            difference_fils=(app_bal - s.closing_fils) if s.closing_fils is not None else None,
            current_balance_fils=acc.opening_balance_fils + now.get(str(acc.id), 0),
        ))
    return checks


def _validate_commit(imp: StatementImport, cats: dict[str, Category], accounts: dict[str, Account]) -> list[ImportRow]:
    secs = {s.index: s for s in imp.sections}
    todo = [r for r in imp.rows if r.action == "import" and r.status != "recorded"]
    fields: dict[str, str] = {}
    for r in todo:
        sec = secs[r.section_index]
        if sec.account_id is None or str(sec.account_id) not in accounts:
            fields[f"sections.{sec.index}"] = f"choose the app account for ..{sec.last4 or '?'} (or skip its rows)"
            continue
        if r.type == "transfer":
            if r.counter_account_id is None or str(r.counter_account_id) not in accounts:
                fields[f"rows.{r.id}"] = "choose the other account for this transfer (or skip it)"
            elif str(r.counter_account_id) == str(sec.account_id):
                fields[f"rows.{r.id}"] = "a transfer needs two different accounts"
        else:
            cat = cats.get(str(r.category_id)) if r.category_id else None
            if cat is None:
                fields[f"rows.{r.id}"] = "choose a category"
            elif cat.kind != r.type:
                fields[f"rows.{r.id}"] = f"category is for {cat.kind}, not {r.type}"
    if fields:
        raise validation_error(fields, "Some rows need attention before importing")
    return todo


async def commit(imp: StatementImport, user_id: PydanticObjectId) -> StatementImport:
    require_draft(imp)
    hid = imp.household_id
    cats = {str(c.id): c for c in await Category.find({"household_id": hid}).to_list()}
    accounts = {str(a.id): a for a in await Account.find({"household_id": hid}).to_list()}
    todo = _validate_commit(imp, cats, accounts)
    secs = {s.index: s for s in imp.sections}
    existing = {t.source_ref for t in await Transaction.find(
        {"household_id": hid, "deleted_at": None, "source_ref": {"$in": [r.source_ref for r in todo]}}).to_list()}
    batch = str(imp.id)
    docs: list[tuple[ImportRow, Transaction]] = []
    skipped = 0
    for r in todo:
        if r.source_ref in existing:  # idempotent: never insert the same statement row twice
            r.status, r.action = "recorded", "skip"
            skipped += 1
            continue
        own = secs[r.section_index].account_id
        if r.type == "transfer":
            src, dst = (own, r.counter_account_id) if r.debit_fils else (r.counter_account_id, own)
        else:
            src, dst = own, None
        note = r.note
        if r.original_currency and r.original_amount and r.original_amount not in (note or ""):
            note = f"{note + ' · ' if note else ''}{r.original_amount} {r.original_currency}"
        docs.append((r, Transaction(
            household_id=hid, account_id=src, date=r.date, amount_fils=r.amount_fils, type=r.type,  # type: ignore[arg-type]
            category_id=r.category_id if r.type != "transfer" else None, to_account_id=dst,
            merchant=(r.merchant or None), note=(note[:1000] if note else None), created_by=user_id, source="import",
            needs_review=r.needs_review, review_reason=r.review_reason if r.needs_review else None,
            source_ref=r.source_ref, import_batch=batch,
        )))
    for i in range(0, len(docs), INSERT_CHUNK):
        chunk = [t for _, t in docs[i:i + INSERT_CHUNK]]
        res = await Transaction.insert_many(chunk)
        for (row, _), oid in zip(docs[i:i + INSERT_CHUNK], res.inserted_ids):
            row.transaction_id = PydanticObjectId(oid)
    imp.status = "committed"
    imp.committed_at = utcnow()
    imp.committed_by = user_id
    imp.commit_result = CommitResult(created_count=len(docs), skipped_count=len(imp.rows) - len(docs))
    imp.commit_result.accounts = await account_checks(imp)
    imp.touch()
    await imp.save()
    return imp


async def rollback(imp: StatementImport) -> StatementImport:
    if imp.status == "rolled_back":
        raise AppError(409, "import_not_committed", "This import was already rolled back")
    if imp.status == "committed":
        now = utcnow()
        await Transaction.get_motor_collection().update_many(
            {"household_id": imp.household_id, "import_batch": str(imp.id), "deleted_at": None},
            {"$set": {"deleted_at": now, "updated_at": now}},
        )
    imp.status = "rolled_back"
    imp.rolled_back_at = utcnow()
    imp.touch()
    await imp.save()
    return imp
