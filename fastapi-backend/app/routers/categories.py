from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from app.models import Category
from app.schemas.base import ListResponse
from app.schemas.categories import CategoryCreate, CategoryOut, CategoryPatch
from app.security.deps import CurrentUser, get_current_user
from app.services.ids import get_owned
from app.services.serializers import category_out

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=ListResponse[CategoryOut])
async def list_categories(
    include_archived: bool = Query(False, alias="includeArchived"),
    current: CurrentUser = Depends(get_current_user),
) -> ListResponse[CategoryOut]:
    query: dict = {"household_id": current.household_id}
    if not include_archived:
        query["archived"] = False
    cats = await Category.find(query).sort("+created_at").to_list()
    items = [category_out(c) for c in cats]
    return ListResponse[CategoryOut](items=items, total=len(items))


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryCreate, current: CurrentUser = Depends(get_current_user)) -> CategoryOut:
    cat = Category(household_id=current.household_id, **body.model_dump())
    await cat.insert()
    return category_out(cat)


@router.patch("/{category_id}", response_model=CategoryOut)
async def patch_category(
    category_id: str, body: CategoryPatch, current: CurrentUser = Depends(get_current_user)
) -> CategoryOut:
    cat = await get_owned(Category, category_id, current.household_id, "Category")
    for key, value in body.model_dump(exclude_unset=True).items():
        if key in ("name", "kind", "group") and value is None:
            continue
        setattr(cat, key, value)
    cat.touch()
    await cat.save()
    return category_out(cat)


@router.post("/{category_id}/archive", response_model=CategoryOut)
async def archive_category(category_id: str, current: CurrentUser = Depends(get_current_user)) -> CategoryOut:
    cat = await get_owned(Category, category_id, current.household_id, "Category")
    cat.archived = True
    cat.touch()
    await cat.save()
    return category_out(cat)
