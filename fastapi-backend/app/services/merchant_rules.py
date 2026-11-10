"""Merchant rules: 'always categorise X as Y'. Defaults are seeded per household on first use."""
from __future__ import annotations

import re
from dataclasses import dataclass

from beanie import PydanticObjectId

from app.models import Category
from app.models.imports import MerchantRule
from app.services.categories import DEFAULT_CATEGORIES

# (pattern, canonical merchant or None to keep the printed name, category name)
DEFAULT_RULES: list[tuple[str, str | None, str]] = [
    ("DUBAI ELECTRICITY", "DEWA", "Utilities"),
    ("DEWA", "DEWA", "Utilities"),
    ("ETISALAT", "e& (Etisalat)", "Telecom"),
    ("e&", "e& (Etisalat)", "Telecom"),
    ("UNION COOP", "Union Coop", "Groceries"),
    ("CARREFOUR", "Carrefour", "Groceries"),
    ("LULU", "Lulu", "Groceries"),
    ("ENOC", "ENOC", "Fuel"),
    ("ADNOC", "ADNOC", "Fuel"),
    ("EMARAT", "Emarat", "Fuel"),
    ("EPPCO", "EPPCO", "Fuel"),
    ("EPCO", "EPPCO", "Fuel"),
    ("SPOTIFY", "Spotify", "Subscriptions"),
    ("OPENAI", "OpenAI ChatGPT", "Subscriptions"),
    ("CHATGPT", "OpenAI ChatGPT", "Subscriptions"),
    ("NETFLIX", "Netflix", "Subscriptions"),
    ("AMAZON PRIME", "Amazon Prime", "Subscriptions"),
    ("SALIK", "Salik", "Transport"),
    ("ROAD AND TRANSPORT", "RTA", "Transport"),
    ("RTA", "RTA", "Transport"),
    ("ZERO MAX", "Zero Max (car loan)", "Car payment"),
    ("ZEROMAX", "Zero Max (car loan)", "Car payment"),
    ("RMA TT REF", None, "Debt payment"),
    ("International remittance", None, "Debt payment"),
    ("SALARY", None, "Salary"),
]

# Categories a default rule may need that the household might not have (name -> kind, group, icon).
EXTRA_CATEGORY_META = {
    "Car payment": ("expense", "debt", "car"),
    "Subscriptions": ("expense", "lifestyle", "repeat"),
}


def _meta(name: str) -> tuple[str, str, str]:
    for n, k, g, i in DEFAULT_CATEGORIES:
        if n == name:
            return k, g, i
    return EXTRA_CATEGORY_META.get(name, ("expense", "other", "circle"))


async def find_category(household_id: PydanticObjectId, name: str, kind: str | None = None) -> Category | None:
    query: dict = {"household_id": household_id, "archived": False,
                   "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}
    if kind:
        query["kind"] = kind
    return await Category.find_one(query)


async def get_or_create_category(household_id: PydanticObjectId, name: str) -> Category:
    kind, group, icon = _meta(name)
    cat = await find_category(household_id, name, kind)
    if cat is None:
        cat = Category(household_id=household_id, name=name, kind=kind, group=group, icon=icon)  # type: ignore[arg-type]
        await cat.insert()
    return cat


async def ensure_default_rules(household_id: PydanticObjectId) -> None:
    """Seed the default rules once per household (archived rules count, so deleting all never re-seeds)."""
    if await MerchantRule.find_one({"household_id": household_id}) is not None:
        return
    cats: dict[str, Category] = {}
    docs = []
    for pattern, merchant, cat_name in DEFAULT_RULES:
        if cat_name not in cats:
            cats[cat_name] = await get_or_create_category(household_id, cat_name)
        docs.append(MerchantRule(household_id=household_id, pattern=pattern, merchant=merchant,
                                 category_id=cats[cat_name].id, source="default"))
    await MerchantRule.insert_many(docs)


@dataclass(frozen=True)
class CompiledRule:
    id: str
    pattern: str
    regex: re.Pattern[str]
    merchant: str | None
    category_id: str | None
    kind: str | None
    source: str


def compile_pattern(pattern: str) -> re.Pattern[str]:
    """Case-insensitive match of the whole pattern, not inside a longer word ('RTA' != 'PORTAL')."""
    return re.compile(r"(?<![A-Za-z0-9])" + re.escape(pattern.strip()) + r"(?![A-Za-z0-9])", re.I)


def compile_rules(rules: list[MerchantRule], kinds: dict[str, str]) -> list[CompiledRule]:
    """User rules first (newest first), then defaults; longer patterns before shorter ones."""
    out = [
        CompiledRule(str(r.id), r.pattern, compile_pattern(r.pattern), r.merchant,
                     str(r.category_id) if r.category_id else None,
                     kinds.get(str(r.category_id)) if r.category_id else None, r.source)
        for r in rules if not r.archived
    ]
    created = {str(r.id): r.created_at for r in rules}
    out.sort(key=lambda c: (c.source != "user", -created[c.id].timestamp() if c.source == "user" else 0,
                            -len(c.pattern)))
    return out


def match_rule(rules: list[CompiledRule], text: str, kind: str) -> CompiledRule | None:
    """First rule whose pattern appears in ``text`` and whose category suits ``kind`` (income/expense)."""
    for r in rules:
        if r.kind is not None and r.kind != kind:
            continue
        if r.regex.search(text):
            return r
    return None
