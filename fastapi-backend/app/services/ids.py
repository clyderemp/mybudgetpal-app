from __future__ import annotations

from beanie import PydanticObjectId

from app.errors import not_found


def to_oid(value: str | PydanticObjectId) -> PydanticObjectId:
    if isinstance(value, PydanticObjectId):
        return value
    return PydanticObjectId(value)


def parse_path_id(value: str, what: str = "Resource") -> PydanticObjectId:
    """Invalid ids behave like unknown ids: 404."""
    if not PydanticObjectId.is_valid(value) or len(value) != 24:
        raise not_found(what)
    return PydanticObjectId(value)


async def get_owned[D](model: type[D], raw_id: str, household_id: PydanticObjectId, what: str) -> D:
    oid = parse_path_id(raw_id, what)
    doc = await model.find_one({"_id": oid, "household_id": household_id})  # type: ignore[attr-defined]
    if doc is None:
        raise not_found(what)
    return doc
