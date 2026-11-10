"""Recurring bills / subscriptions / instalments and expected income (docs/spec.md, "Bills and income")."""

from __future__ import annotations

import datetime as dt
import secrets
from typing import Any

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query, status
from pydantic import ValidationError

from app.errors import validation_error
from app.models import Account, Bill, Category, Debt, IncomePart, IncomeStream, Transaction, User
from app.schemas.base import ListResponse
from app.schemas.bills import (
    BillCreate,
    BillLinkIn,
    BillOut,
    BillPatch,
    BillSkipIn,
    IncomePartOut,
    IncomeStreamCreate,
    IncomeStreamOut,
    IncomeStreamPatch,
    SuggestionsOut,
)
from app.security.deps import CurrentUser, get_current_user
from app.services.bills import bill_derived, build_month, build_overview, build_suggestions
from app.services.ids import get_owned, parse_path_id
from app.services.insights import get_today
from app.services.months import parse_month
from app.services.serializers import transaction_out
from app.schemas.transactions import TransactionOut

router = APIRouter(tags=["bills"])


def _s(v: Any) -> str | None:
    return str(v) if v is not None else None


async def _check_refs(data: dict[str, Any], household_id: PydanticObjectId) -> None:
    """accountId / categoryId / debtId / memberId must belong to the household (422 otherwise)."""
    checks = (("account_id", Account, "accountId"), ("category_id", Category, "categoryId"),
              ("debt_id", Debt, "debtId"), ("member_id", User, "memberId"))
    fields: dict[str, str] = {}
    for key, model, name in checks:
        raw = data.get(key)
        if raw is None:
            continue
        oid = PydanticObjectId(raw)
        if await model.find_one({"_id": oid, "household_id": household_id}) is None:  # type: ignore[attr-defined]
            fields[name] = f"{name[:-2]} not found"
        else:
            data[key] = oid
    if fields:
        raise validation_error(fields)


def bill_out(b: Bill, today: dt.date) -> BillOut:
    return BillOut(
        id=str(b.id),
        name=b.name,
        kind=b.kind,
        amount_fils=b.amount_fils,
        amount_mode=b.amount_mode,
        cadence=b.cadence,
        due_day_from=b.due_day_from,
        due_day_to=b.due_day_to,
        account_id=_s(b.account_id),
        category_id=_s(b.category_id),
        match_text=b.match_text,
        amount_tolerance_pct=b.amount_tolerance_pct,
        start_month=b.start_month,
        end_month=b.end_month,
        instalments_total=b.instalments_total,
        instalments_paid=b.instalments_paid,
        debt_id=_s(b.debt_id),
        purpose=b.purpose,
        active=b.active,
        notes=b.notes,
        skipped_months=b.skipped_months,
        archived=b.archived,
        created_at=b.created_at,
        updated_at=b.updated_at,
        **bill_derived(b, today),
    )


# ---------------------------------------------------------------- bills: computed views
# (declared before /bills/{bill_id} so the literal paths win)


@router.get("/bills/month/{month}")
async def bills_month(
    month: str, current: CurrentUser = Depends(get_current_user), today: dt.date = Depends(get_today)
) -> dict[str, Any]:
    """Checklist for a month: bills due and income expected, each with its status and matches."""
    report = await build_month(current.household_id, parse_month(month), today)
    return {**report, "today": today.isoformat()}


@router.get("/bills/overview")
async def bills_overview(
    current: CurrentUser = Depends(get_current_user), today: dt.date = Depends(get_today)
) -> dict[str, Any]:
    return await build_overview(current.household_id, today)


@router.get("/bills/suggestions", response_model=SuggestionsOut)
async def bills_suggestions(
    current: CurrentUser = Depends(get_current_user), today: dt.date = Depends(get_today)
) -> SuggestionsOut:
    items = await build_suggestions(current.household_id, today)
    return SuggestionsOut(items=items, total=len(items))


# ---------------------------------------------------------------- bills: CRUD


@router.get("/bills", response_model=ListResponse[BillOut])
async def list_bills(
    include_archived: bool = Query(False, alias="includeArchived"),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> ListResponse[BillOut]:
    query: dict[str, Any] = {"household_id": current.household_id}
    if not include_archived:
        query["archived"] = False
    bills = await Bill.find(query).sort([("due_day_from", 1), ("name", 1)]).to_list()
    return ListResponse[BillOut](items=[bill_out(b, today) for b in bills], total=len(bills))


@router.post("/bills", response_model=BillOut, status_code=status.HTTP_201_CREATED)
async def create_bill(
    body: BillCreate, current: CurrentUser = Depends(get_current_user), today: dt.date = Depends(get_today)
) -> BillOut:
    data = body.model_dump()
    await _check_refs(data, current.household_id)
    bill = Bill(household_id=current.household_id, **data)
    await bill.insert()
    return bill_out(bill, today)


@router.get("/bills/{bill_id}", response_model=BillOut)
async def get_bill(
    bill_id: str, current: CurrentUser = Depends(get_current_user), today: dt.date = Depends(get_today)
) -> BillOut:
    return bill_out(await get_owned(Bill, bill_id, current.household_id, "Bill"), today)


_NULLABLE = {"account_id", "category_id", "debt_id", "end_month", "instalments_total", "notes"}


@router.patch("/bills/{bill_id}", response_model=BillOut)
async def patch_bill(
    bill_id: str, body: BillPatch, current: CurrentUser = Depends(get_current_user), today: dt.date = Depends(get_today)
) -> BillOut:
    bill = await get_owned(Bill, bill_id, current.household_id, "Bill")
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k in _NULLABLE}
    current_values = {k: getattr(bill, k) for k in BillCreate.model_fields}
    for k in ("account_id", "category_id", "debt_id"):
        current_values[k] = _s(current_values[k])
    try:  # re-check cross-field rules against the merged result
        merged = BillCreate.model_validate({**current_values, **updates})
    except ValidationError as exc:
        fields = {".".join(str(p) for p in e["loc"]) or "_": e["msg"].removeprefix("Value error, ") for e in exc.errors()}
        raise validation_error(fields) from None
    data = merged.model_dump()
    await _check_refs(data, current.household_id)
    for k, v in data.items():
        setattr(bill, k, v)
    bill.touch()
    await bill.save()
    return bill_out(bill, today)


@router.post("/bills/{bill_id}/archive", response_model=BillOut)
async def archive_bill(
    bill_id: str, current: CurrentUser = Depends(get_current_user), today: dt.date = Depends(get_today)
) -> BillOut:
    bill = await get_owned(Bill, bill_id, current.household_id, "Bill")
    bill.archived = True
    bill.active = False
    bill.touch()
    await bill.save()
    return bill_out(bill, today)


@router.post("/bills/{bill_id}/skip", response_model=BillOut)
async def skip_bill(
    bill_id: str, body: BillSkipIn, current: CurrentUser = Depends(get_current_user), today: dt.date = Depends(get_today)
) -> BillOut:
    """Mark the bill as not due in ``month`` (or undo with ``skipped: false``)."""
    bill = await get_owned(Bill, bill_id, current.household_id, "Bill")
    months = set(bill.skipped_months)
    if body.skipped:
        months.add(body.month)
    else:
        months.discard(body.month)
    bill.skipped_months = sorted(months)
    bill.touch()
    await bill.save()
    return bill_out(bill, today)


async def _owned_txn(raw: str, household_id: PydanticObjectId) -> Transaction:
    oid = PydanticObjectId(raw)
    txn = await Transaction.find_one({"_id": oid, "household_id": household_id, "deleted_at": None})
    if txn is None:
        raise validation_error({"transactionId": "transaction not found"})
    return txn


@router.post("/bills/{bill_id}/links", response_model=TransactionOut)
async def link_transaction(
    bill_id: str, body: BillLinkIn, current: CurrentUser = Depends(get_current_user)
) -> TransactionOut:
    """Mark a transaction as paying this bill (replaces any other bill link)."""
    bill = await get_owned(Bill, bill_id, current.household_id, "Bill")
    txn = await _owned_txn(body.transaction_id, current.household_id)
    txn.bill_id = bill.id
    txn.touch()
    await txn.save()
    if str(txn.id) in bill.ignored_transaction_ids:
        bill.ignored_transaction_ids = [i for i in bill.ignored_transaction_ids if i != str(txn.id)]
        await bill.save()
    return transaction_out(txn)


@router.delete("/bills/{bill_id}/links/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_transaction(
    bill_id: str, transaction_id: str, current: CurrentUser = Depends(get_current_user)
) -> None:
    """Undo a match: clears the link and stops rules matching this transaction to the bill again."""
    bill = await get_owned(Bill, bill_id, current.household_id, "Bill")
    tid = parse_path_id(transaction_id, "Transaction")
    txn = await Transaction.find_one({"_id": tid, "household_id": current.household_id})
    if txn is not None and txn.bill_id == bill.id:
        txn.bill_id = None
        txn.touch()
        await txn.save()
    if str(tid) not in bill.ignored_transaction_ids:
        bill.ignored_transaction_ids = [*bill.ignored_transaction_ids, str(tid)][-200:]
        await bill.save()


# ---------------------------------------------------------------- expected income


def _part_id() -> str:
    return secrets.token_hex(4)


def stream_out(s: IncomeStream) -> IncomeStreamOut:
    return IncomeStreamOut(
        id=str(s.id),
        name=s.name,
        member_id=_s(s.member_id),
        account_id=_s(s.account_id),
        parts=[IncomePartOut(**p.model_dump()) for p in s.parts],
        active=s.active,
        notes=s.notes,
        archived=s.archived,
        monthly_fils=sum(p.amount_fils for p in s.parts),
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


def _parts(raw: list[dict[str, Any]]) -> list[IncomePart]:
    seen: set[str] = set()
    out = []
    for p in raw:
        pid = p.get("id") or _part_id()
        while pid in seen:
            pid = _part_id()
        seen.add(pid)
        out.append(IncomePart(**{**p, "id": pid}))
    return out


@router.get("/income-streams", response_model=ListResponse[IncomeStreamOut])
async def list_streams(
    include_archived: bool = Query(False, alias="includeArchived"), current: CurrentUser = Depends(get_current_user)
) -> ListResponse[IncomeStreamOut]:
    query: dict[str, Any] = {"household_id": current.household_id}
    if not include_archived:
        query["archived"] = False
    streams = await IncomeStream.find(query).sort("+created_at").to_list()
    return ListResponse[IncomeStreamOut](items=[stream_out(s) for s in streams], total=len(streams))


@router.post("/income-streams", response_model=IncomeStreamOut, status_code=status.HTTP_201_CREATED)
async def create_stream(body: IncomeStreamCreate, current: CurrentUser = Depends(get_current_user)) -> IncomeStreamOut:
    data = body.model_dump()
    await _check_refs(data, current.household_id)
    data["parts"] = _parts(data["parts"])
    stream = IncomeStream(household_id=current.household_id, **data)
    await stream.insert()
    return stream_out(stream)


@router.patch("/income-streams/{stream_id}", response_model=IncomeStreamOut)
async def patch_stream(
    stream_id: str, body: IncomeStreamPatch, current: CurrentUser = Depends(get_current_user)
) -> IncomeStreamOut:
    stream = await get_owned(IncomeStream, stream_id, current.household_id, "Income stream")
    updates = body.model_dump(exclude_unset=True)
    refs = {k: updates[k] for k in ("account_id", "member_id") if updates.get(k) is not None}
    await _check_refs(refs, current.household_id)
    for key, value in updates.items():
        if key in ("account_id", "member_id"):
            setattr(stream, key, refs.get(key))
        elif key == "parts":
            if value is not None:
                stream.parts = _parts(value)
        elif value is not None or key == "notes":
            setattr(stream, key, value)
    stream.touch()
    await stream.save()
    return stream_out(stream)


@router.post("/income-streams/{stream_id}/archive", response_model=IncomeStreamOut)
async def archive_stream(stream_id: str, current: CurrentUser = Depends(get_current_user)) -> IncomeStreamOut:
    stream = await get_owned(IncomeStream, stream_id, current.household_id, "Income stream")
    stream.archived = True
    stream.active = False
    stream.touch()
    await stream.save()
    return stream_out(stream)
