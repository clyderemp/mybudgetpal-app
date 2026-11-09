from __future__ import annotations

from typing import Annotated, Literal

from pydantic import StringConstraints

from app.schemas.base import ApiModel, InputModel


class ReceiptReadIn(InputModel):
    # Text from the browser's OCR. The image itself never reaches the server.
    text: Annotated[str, StringConstraints(min_length=1, max_length=8000)]
    # False = local parser only (instant). The app fills the form with that first, then asks again
    # with ai=True and refines the fields the user hasn't changed.
    ai: bool = True


class ReceiptItemOut(ApiModel):
    name: str
    amount_fils: int | None = None


class ReceiptReadOut(ApiModel):
    merchant: str | None = None
    amount_fils: int | None = None
    currency: str | None = None
    date: str | None = None
    category_id: str | None = None
    account_id: str | None = None
    card_last4: str | None = None
    vat_fils: int | None = None
    items: list[ReceiptItemOut] = []
    source: Literal["ai", "text"]
    # Set when an AI read was attempted and every model failed (the local parser was used).
    ai_unavailable: bool = False
