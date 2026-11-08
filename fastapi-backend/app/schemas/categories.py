from datetime import datetime

from app.models.categories import CategoryGroup, CategoryKind
from app.schemas.base import ApiModel, Color, Icon, InputModel, Name


class CategoryCreate(InputModel):
    name: Name
    kind: CategoryKind
    group: CategoryGroup = "other"
    icon: Icon | None = None
    color: Color | None = None


class CategoryPatch(InputModel):
    name: Name | None = None
    kind: CategoryKind | None = None
    group: CategoryGroup | None = None
    icon: Icon | None = None
    color: Color | None = None


class CategoryOut(ApiModel):
    id: str
    name: str
    kind: str
    group: str
    icon: str | None
    color: str | None
    archived: bool
    created_at: datetime
    updated_at: datetime
