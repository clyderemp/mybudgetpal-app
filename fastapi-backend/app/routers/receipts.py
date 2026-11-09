from __future__ import annotations

import datetime as dt
import logging

from fastapi import APIRouter, Depends

from app.config import Settings
from app.models import Account, Category
from app.schemas.receipts import ReceiptItemOut, ReceiptReadIn, ReceiptReadOut
from app.security.deps import CurrentUser, get_app_settings, get_current_user
from app.services.insights import get_today
from app.services.receipts import read_receipt

router = APIRouter(prefix="/receipts", tags=["receipts"])
log = logging.getLogger(__name__)


def _fils(value: float | None) -> int | None:
    return round(value * 100) if value is not None else None


@router.post("/read", response_model=ReceiptReadOut)
async def read(
    body: ReceiptReadIn,
    current: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_app_settings),
    today: dt.date = Depends(get_today),
) -> ReceiptReadOut:
    """Read OCR text of a receipt into fields that prefill a new expense. Saves nothing."""
    cats = await Category.find(
        {"household_id": current.household_id, "kind": "expense", "archived": False}
    ).to_list()
    by_name = {c.name: c for c in cats}
    reading = await read_receipt(settings, body.text, list(by_name), today, use_ai=body.ai)
    if reading.ai_error:
        log.warning("receipt AI unavailable: %s", reading.ai_error)

    account_id = None
    if reading.card_last4:
        match = await Account.find_one(
            {"household_id": current.household_id, "archived": False, "last4": reading.card_last4}
        )
        account_id = str(match.id) if match else None
    category = by_name.get(reading.category or "")
    return ReceiptReadOut(
        merchant=reading.merchant,
        amount_fils=_fils(reading.total),
        currency=reading.currency,
        date=reading.date,
        category_id=str(category.id) if category else None,
        account_id=account_id,
        card_last4=reading.card_last4,
        vat_fils=_fils(reading.vat),
        items=[ReceiptItemOut(name=i.name, amount_fils=_fils(i.amount)) for i in reading.items],
        source="ai" if reading.model else "text",
        ai_unavailable=bool(reading.ai_error),
    )
