from __future__ import annotations

from typing import Any

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import Settings
from app.models import (
    Account,
    Budget,
    Category,
    Debt,
    Goal,
    Household,
    Invite,
    Plan,
    Session,
    StatementImport,
    MerchantRule,
    Transaction,
    User,
)

document_models: list[type] = [
    User,
    Household,
    Invite,
    Session,
    Account,
    Category,
    Transaction,
    Budget,
    Debt,
    Goal,
    Plan,
    StatementImport,
    MerchantRule,
]


def _mongomock_keep_partial_indexes() -> None:
    """mongomock's create_indexes() drops IndexModel options such as partialFilterExpression (its
    create_index keeps them), which turns the partial unique source_ref index into a plain unique one.
    Route create_indexes through create_index. Mock (local dev/tests) only."""
    from mongomock.collection import Collection

    if getattr(Collection, "_mbp_partial_patch", False):
        return

    def create_indexes(self, indexes, session=None):  # type: ignore[no-untyped-def]
        names = []
        for model in indexes:
            doc = dict(model.document)
            keys = list(doc.pop("key").items())
            names.append(self.create_index(keys, session=session, **doc))
        return names

    Collection.create_indexes = create_indexes  # type: ignore[method-assign]
    Collection._mbp_partial_patch = True  # type: ignore[attr-defined]


def make_client(settings: Settings) -> Any:
    if settings.uses_mongomock:
        from mongomock_motor import AsyncMongoMockClient

        _mongomock_keep_partial_indexes()

        return AsyncMongoMockClient()
    return AsyncIOMotorClient(
        settings.mongodb_uri,
        uuidRepresentation="standard",
        maxPoolSize=settings.mongodb_max_pool_size,
        minPoolSize=settings.mongodb_min_pool_size,
        retryReads=True,
        retryWrites=True,
    )


async def _drop_legacy_indexes(db: Any) -> None:
    """The non-unique (household_id, source_ref) index became a unique partial one with an explicit
    name; Mongo refuses two indexes on the same keys, so drop the old one before Beanie creates the new."""
    from app.models.transactions import LEGACY_SOURCE_REF_INDEX

    try:
        info = await db["transactions"].index_information()
        if LEGACY_SOURCE_REF_INDEX in info:
            await db["transactions"].drop_index(LEGACY_SOURCE_REF_INDEX)
    except Exception:  # pragma: no cover - missing collection / permissions: init_beanie will report
        pass


async def init_db(settings: Settings) -> Any:
    """Create the Mongo client and initialise Beanie. Returns the client."""
    client = make_client(settings)
    await _drop_legacy_indexes(client[settings.mongodb_db])
    await init_beanie(database=client[settings.mongodb_db], document_models=document_models)
    return client
