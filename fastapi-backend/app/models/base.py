from __future__ import annotations

from datetime import UTC, datetime

from beanie import Document, PydanticObjectId
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """Mongo returns naive UTC datetimes; normalise for comparisons."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class TimestampedDocument(Document):
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    def touch(self) -> None:
        self.updated_at = utcnow()


class HouseholdDocument(TimestampedDocument):
    household_id: PydanticObjectId
