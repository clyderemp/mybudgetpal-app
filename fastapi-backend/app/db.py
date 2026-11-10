from __future__ import annotations

from typing import Any

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import Settings
from app.models import (
    Account,
    Bill,
    IncomeStream,
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
    Bill,
    IncomeStream,
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


async def init_db(settings: Settings) -> Any:
    """Create the Mongo client and initialise Beanie. Returns the client."""
    client = make_client(settings)
    await init_beanie(database=client[settings.mongodb_db], document_models=document_models)
    return client
