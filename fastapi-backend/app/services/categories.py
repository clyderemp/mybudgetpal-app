from __future__ import annotations

from beanie import PydanticObjectId

from app.models import Category

DEBT_PAYMENT_CATEGORY = "Debt payment"

# (name, kind, group, lucide icon)
DEFAULT_CATEGORIES: list[tuple[str, str, str, str]] = [
    ("Salary", "income", "income", "briefcase"),
    ("Other income", "income", "income", "plus-circle"),
    ("Rent", "expense", "essentials", "home"),
    ("Utilities", "expense", "essentials", "zap"),
    ("Groceries", "expense", "essentials", "shopping-cart"),
    ("Transport", "expense", "essentials", "bus"),
    ("Fuel", "expense", "essentials", "fuel"),
    ("Telecom", "expense", "essentials", "smartphone"),
    ("Insurance", "expense", "essentials", "shield"),
    ("Dining", "expense", "lifestyle", "utensils"),
    ("Shopping", "expense", "lifestyle", "shopping-bag"),
    ("Entertainment", "expense", "lifestyle", "film"),
    ("Health", "expense", "essentials", "heart-pulse"),
    ("Education", "expense", "essentials", "graduation-cap"),
    ("Travel", "expense", "lifestyle", "plane"),
    ("Gifts", "expense", "lifestyle", "gift"),
    ("Subscriptions", "expense", "lifestyle", "repeat"),
    ("Fees", "expense", "other", "receipt"),
    (DEBT_PAYMENT_CATEGORY, "expense", "debt", "credit-card"),
    ("Other", "expense", "other", "circle"),
]


async def seed_default_categories(household_id: PydanticObjectId) -> None:
    docs = [
        Category(household_id=household_id, name=n, kind=k, group=g, icon=i)  # type: ignore[arg-type]
        for n, k, g, i in DEFAULT_CATEGORIES
    ]
    await Category.insert_many(docs)


async def get_or_create_debt_payment_category(household_id: PydanticObjectId) -> Category:
    cat = await Category.find_one(
        {"household_id": household_id, "name": DEBT_PAYMENT_CATEGORY, "kind": "expense", "archived": False}
    )
    if cat is None:
        cat = Category(
            household_id=household_id,
            name=DEBT_PAYMENT_CATEGORY,
            kind="expense",
            group="debt",
            icon="credit-card",
        )
        await cat.insert()
    return cat
