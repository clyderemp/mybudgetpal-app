from beanie import PydanticObjectId

from app.models.base import TimestampedDocument


class Household(TimestampedDocument):
    """The household's own id is the tenant key (no separate household_id field)."""

    name: str
    base_currency: str = "AED"
    owner_id: PydanticObjectId

    class Settings:
        name = "households"
