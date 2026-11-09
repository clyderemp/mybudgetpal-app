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
]


def make_client(settings: Settings) -> Any:
    if settings.uses_mongomock:
        from mongomock_motor import AsyncMongoMockClient

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
