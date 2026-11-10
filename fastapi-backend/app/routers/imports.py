"""Bank statement import (staged: upload -> review -> commit -> optional rollback) and merchant rules."""
from __future__ import annotations

import asyncio
import logging

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.config import Settings
from app.errors import AppError, not_found, validation_error
from app.models import Account, Category, utcnow
from app.models.imports import MerchantRule, StatementImport
from app.schemas.base import ListResponse
from app.schemas.imports import (
    AccountCheckOut,
    CommitResultOut,
    ImportCounts,
    ImportOut,
    ImportPatch,
    ImportRowOut,
    ImportRowsPatch,
    ImportSectionOut,
    ImportSummaryOut,
    MerchantRuleCreate,
    MerchantRuleOut,
    MerchantRulePatch,
    ReconciliationOut,
)
from app.security.deps import CurrentUser, get_app_settings, get_current_user
from app.services import imports as svc
from app.services.ids import parse_path_id
from app.services.merchant_rules import ensure_default_rules
from app.services.serializers import member_names
from app.services.statements import StatementError, StatementTooComplex, parse_statement
from app.services.statements.matching import counts

router = APIRouter(tags=["imports"])
log = logging.getLogger(__name__)
ALLOWED_SUFFIXES = (".pdf", ".csv")


# ------------------------------------------------------------------ serialisation
def _s(v: object) -> str | None:
    return str(v) if v is not None else None


async def _summary(imp: StatementImport, names: dict[str, str], live_checks: bool = False) -> ImportSummaryOut:
    accounts = {str(a.id): a for a in await Account.find(
        {"household_id": imp.household_id, "_id": {"$in": [s.account_id for s in imp.sections if s.account_id]}}).to_list()}
    sections = []
    for s in imp.sections:
        rows = [r for r in imp.rows if r.section_index == s.index]
        acc = accounts.get(str(s.account_id)) if s.account_id else None
        sections.append(ImportSectionOut(
            index=s.index, bank=s.bank, product=s.product, account_type=s.account_type, last4=s.last4,
            currency=s.currency, period_from=s.period_from, period_to=s.period_to, opening_fils=s.opening_fils,
            closing_fils=s.closing_fils, total_debit_fils=s.total_debit_fils, total_credit_fils=s.total_credit_fils,
            row_count=len(rows), account_id=_s(s.account_id), account_name=acc.name if acc else None,
            suggested_account_name=f"{s.bank} {s.product}" + (f" ..{s.last4}" if s.last4 else ""),
            reconciliation=ReconciliationOut(**s.reconciliation.model_dump()),
            counts=ImportCounts(**counts(rows)),
        ))
    result = None
    if imp.commit_result is not None:
        checks = await svc.account_checks(imp) if live_checks and imp.status == "committed" else imp.commit_result.accounts
        result = CommitResultOut(
            created_count=imp.commit_result.created_count, skipped_count=imp.commit_result.skipped_count,
            accounts=[AccountCheckOut(**{**c.model_dump(), "account_id": str(c.account_id)}) for c in checks],
        )
    dates_from = [s.period_from for s in imp.sections if s.period_from]
    dates_to = [s.period_to for s in imp.sections if s.period_to]
    return ImportSummaryOut(
        id=str(imp.id), filename=imp.filename, bank=imp.bank, format=imp.format, status=imp.status,
        created_at=imp.created_at, created_by_name=names.get(str(imp.created_by)), committed_at=imp.committed_at,
        rolled_back_at=imp.rolled_back_at, period_from=min(dates_from) if dates_from else None,
        period_to=max(dates_to) if dates_to else None, sections=sections, counts=ImportCounts(**counts(imp.rows)),
        issues=imp.issues, commit_result=result,
    )


def _row_out(r) -> ImportRowOut:  # type: ignore[no-untyped-def]
    return ImportRowOut(
        id=r.id, section_index=r.section_index, date=r.date, description=r.description, debit_fils=r.debit_fils,
        credit_fils=r.credit_fils, balance_fils=r.balance_fils, amount_fils=r.amount_fils, direction=r.direction,
        ref=r.ref, card_last4=r.card_last4, counterparty_last4=r.counterparty_last4,
        original_amount=r.original_amount, original_currency=r.original_currency, source_ref=r.source_ref,
        status=r.status, action=r.action, type=r.type, category_id=_s(r.category_id), merchant=r.merchant,
        note=r.note, counter_account_id=_s(r.counter_account_id), needs_review=r.needs_review,
        review_reason=r.review_reason, matched_transaction_id=_s(r.matched_transaction_id or r.transaction_id),
        paired_row_id=r.paired_row_id, reason=r.reason, edited=r.edited,
    )


async def _out(imp: StatementImport, current: CurrentUser) -> ImportOut:
    names = await member_names(current.household_id)
    summary = await _summary(imp, names, live_checks=True)
    return ImportOut(**summary.model_dump(), rows=[_row_out(r) for r in imp.rows])


async def _get(import_id: str, current: CurrentUser) -> StatementImport:
    oid = parse_path_id(import_id, "Import")
    imp = await StatementImport.find_one({"_id": oid, "household_id": current.household_id})
    if imp is None:
        raise not_found("Import")
    return imp


# ------------------------------------------------------------------ imports
@router.post("/imports", response_model=ImportOut, status_code=status.HTTP_201_CREATED)
async def upload(
    file: UploadFile = File(...),
    current: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_app_settings),
) -> ImportOut:
    """Parse a statement (PDF/CSV) into a draft import with a proposal for every row. Saves no transactions."""
    name = (file.filename or "statement").rsplit("/", 1)[-1][:200]
    if not name.lower().endswith(ALLOWED_SUFFIXES):
        raise AppError(422, "unsupported_file", "Upload a PDF statement or a CSV export")
    limit = settings.import_max_bytes
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise AppError(413, "file_too_large", f"The file is larger than {limit // (1024 * 1024)} MB")
    if not data:
        raise AppError(422, "unsupported_file", "The file is empty")
    try:
        parsed = await run_in_threadpool(parse_statement, data, name)
    except StatementTooComplex as exc:
        raise AppError(422, "statement_too_complex", f"This statement is too large or complex to read: {exc}") from exc
    except StatementError as exc:
        raise AppError(422, "unreadable_statement", f"Couldn't read this statement: {exc}") from exc
    if not parsed.sections:
        raise AppError(422, "unreadable_statement", "No accounts were found in this statement")
    imp = svc.build_import(parsed, data, name, current.household_id, current.user_id)
    await svc.rematch(imp, map_accounts=True)
    await imp.insert()
    return await _out(imp, current)


@router.get("/imports", response_model=ListResponse[ImportSummaryOut])
async def list_imports(current: CurrentUser = Depends(get_current_user)) -> ListResponse[ImportSummaryOut]:
    imps, names = await asyncio.gather(
        StatementImport.find({"household_id": current.household_id}).sort("-created_at").limit(100).to_list(),
        member_names(current.household_id),
    )
    items = [await _summary(i, names) for i in imps]
    return ListResponse[ImportSummaryOut](items=items, total=len(items))


@router.get("/imports/{import_id}", response_model=ImportOut)
async def get_import(import_id: str, current: CurrentUser = Depends(get_current_user)) -> ImportOut:
    return await _out(await _get(import_id, current), current)


@router.patch("/imports/{import_id}", response_model=ImportOut)
async def patch_import(import_id: str, body: ImportPatch, current: CurrentUser = Depends(get_current_user)) -> ImportOut:
    imp = await _get(import_id, current)
    svc.require_draft(imp)
    if body.sections:
        ids = {s.account_id for s in body.sections if s.account_id}
        owned = {str(a.id) for a in await Account.find(
            {"household_id": current.household_id, "_id": {"$in": [PydanticObjectId(i) for i in ids]}}).to_list()}
        by_index = {s.index: s for s in imp.sections}
        fields = {}
        for s in body.sections:
            if s.index not in by_index:
                fields[f"sections.{s.index}"] = "section not found"
            elif s.account_id and s.account_id not in owned:
                fields[f"sections.{s.index}"] = "account not found"
        if fields:
            raise validation_error(fields)
        for s in body.sections:
            by_index[s.index].account_id = PydanticObjectId(s.account_id) if s.account_id else None
    await svc.rematch(imp)
    await svc.save_draft(imp)
    return await _out(imp, current)


@router.patch("/imports/{import_id}/rows", response_model=ImportOut)
async def patch_rows(import_id: str, body: ImportRowsPatch, current: CurrentUser = Depends(get_current_user)) -> ImportOut:
    imp = await _get(import_id, current)
    svc.require_draft(imp)
    edits = [e.model_dump(exclude_unset=True) for e in body.rows]
    await svc.apply_row_edits(imp, edits, current.household_id)
    await svc.save_draft(imp)
    return await _out(imp, current)


@router.post("/imports/{import_id}/commit", response_model=ImportOut)
async def commit_import(import_id: str, current: CurrentUser = Depends(get_current_user)) -> ImportOut:
    imp = await _get(import_id, current)
    svc.require_draft(imp)
    await svc.rematch(imp)  # pick up anything recorded since the review started (idempotency)
    imp = await svc.commit(imp, current.user_id)
    return await _out(imp, current)


@router.post("/imports/{import_id}/rollback", response_model=ImportOut)
async def rollback_import(import_id: str, current: CurrentUser = Depends(get_current_user)) -> ImportOut:
    imp = await svc.rollback(await _get(import_id, current))
    return await _out(imp, current)


# ------------------------------------------------------------------ merchant rules
async def _rule_out(rules: list[MerchantRule], household_id: PydanticObjectId) -> list[MerchantRuleOut]:
    cats = {str(c.id): c for c in await Category.find({"household_id": household_id}).to_list()}
    out = []
    for r in rules:
        c = cats.get(str(r.category_id)) if r.category_id else None
        out.append(MerchantRuleOut(
            id=str(r.id), pattern=r.pattern, merchant=r.merchant, category_id=_s(r.category_id),
            category_name=c.name if c else None, kind=c.kind if c else None, source=r.source, archived=r.archived,
            created_at=r.created_at, updated_at=r.updated_at,
        ))
    return out


async def _category(household_id: PydanticObjectId, category_id: str) -> Category:
    cat = await Category.find_one({"_id": PydanticObjectId(category_id), "household_id": household_id})
    if cat is None:
        raise validation_error({"categoryId": "category not found"})
    return cat


async def _rule(rule_id: str, current: CurrentUser) -> MerchantRule:
    rule = await MerchantRule.find_one({"_id": parse_path_id(rule_id, "Rule"), "household_id": current.household_id,
                                        "archived": False})
    if rule is None:
        raise not_found("Rule")
    return rule


@router.get("/merchant-rules", response_model=ListResponse[MerchantRuleOut])
async def list_rules(current: CurrentUser = Depends(get_current_user)) -> ListResponse[MerchantRuleOut]:
    await ensure_default_rules(current.household_id)
    rules = await MerchantRule.find({"household_id": current.household_id, "archived": False}).sort(
        [("source", -1), ("created_at", -1)]).to_list()
    items = await _rule_out(rules, current.household_id)
    return ListResponse[MerchantRuleOut](items=items, total=len(items))


@router.post("/merchant-rules", response_model=MerchantRuleOut, status_code=status.HTTP_201_CREATED)
async def create_rule(body: MerchantRuleCreate, current: CurrentUser = Depends(get_current_user)) -> MerchantRuleOut:
    await ensure_default_rules(current.household_id)
    cat = await _category(current.household_id, body.category_id)
    rule = MerchantRule(household_id=current.household_id, pattern=body.pattern, merchant=body.merchant or None,
                        category_id=cat.id, source="user")
    await rule.insert()
    return (await _rule_out([rule], current.household_id))[0]


@router.patch("/merchant-rules/{rule_id}", response_model=MerchantRuleOut)
async def patch_rule(rule_id: str, body: MerchantRulePatch, current: CurrentUser = Depends(get_current_user)) -> MerchantRuleOut:
    rule = await _rule(rule_id, current)
    data = body.model_dump(exclude_unset=True)
    if data.get("pattern"):
        rule.pattern = data["pattern"]
    if data.get("category_id"):
        rule.category_id = (await _category(current.household_id, data["category_id"])).id
    if "merchant" in data:
        rule.merchant = data["merchant"] or None
    rule.source = "user"
    rule.touch()
    await rule.save()
    return (await _rule_out([rule], current.household_id))[0]


@router.delete("/merchant-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(rule_id: str, current: CurrentUser = Depends(get_current_user)) -> Response:
    rule = await _rule(rule_id, current)
    rule.archived = True
    rule.updated_at = utcnow()
    await rule.save()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
