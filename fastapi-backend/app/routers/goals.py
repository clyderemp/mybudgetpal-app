from __future__ import annotations

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query, status

from app.errors import validation_error
from app.models import Account, Goal
from app.schemas.base import ListResponse
from app.schemas.goals import GoalContributionIn, GoalCreate, GoalOut, GoalPatch
from app.security.deps import CurrentUser, get_current_user
from app.services.ids import get_owned
from app.services.serializers import goal_out

router = APIRouter(prefix="/goals", tags=["goals"])


async def _check_account(raw: str | None, household_id: PydanticObjectId) -> PydanticObjectId | None:
    if raw is None:
        return None
    oid = PydanticObjectId(raw)
    if await Account.find_one({"_id": oid, "household_id": household_id}) is None:
        raise validation_error({"accountId": "account not found"})
    return oid


@router.get("", response_model=ListResponse[GoalOut])
async def list_goals(
    include_archived: bool = Query(False, alias="includeArchived"),
    current: CurrentUser = Depends(get_current_user),
) -> ListResponse[GoalOut]:
    query: dict = {"household_id": current.household_id}
    if not include_archived:
        query["archived"] = False
    goals = await Goal.find(query).sort([("priority", 1), ("created_at", 1)]).to_list()
    return ListResponse[GoalOut](items=[goal_out(g) for g in goals], total=len(goals))


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(body: GoalCreate, current: CurrentUser = Depends(get_current_user)) -> GoalOut:
    data = body.model_dump()
    data["account_id"] = await _check_account(body.account_id, current.household_id)
    goal = Goal(household_id=current.household_id, **data)
    await goal.insert()
    return goal_out(goal)


@router.get("/{goal_id}", response_model=GoalOut)
async def get_goal(goal_id: str, current: CurrentUser = Depends(get_current_user)) -> GoalOut:
    return goal_out(await get_owned(Goal, goal_id, current.household_id, "Goal"))


@router.patch("/{goal_id}", response_model=GoalOut)
async def patch_goal(goal_id: str, body: GoalPatch, current: CurrentUser = Depends(get_current_user)) -> GoalOut:
    goal = await get_owned(Goal, goal_id, current.household_id, "Goal")
    for key, value in body.model_dump(exclude_unset=True).items():
        if key == "account_id":
            value = await _check_account(value, current.household_id)
        elif value is None and key != "target_date":
            continue
        setattr(goal, key, value)
    goal.touch()
    await goal.save()
    return goal_out(goal)


@router.post("/{goal_id}/archive", response_model=GoalOut)
async def archive_goal(goal_id: str, current: CurrentUser = Depends(get_current_user)) -> GoalOut:
    goal = await get_owned(Goal, goal_id, current.household_id, "Goal")
    goal.archived = True
    goal.touch()
    await goal.save()
    return goal_out(goal)


@router.post("/{goal_id}/contributions", response_model=GoalOut)
async def contribute(
    goal_id: str, body: GoalContributionIn, current: CurrentUser = Depends(get_current_user)
) -> GoalOut:
    """Adjust saved_fils by amountFils (negative = withdrawal), floored at 0."""
    if body.amount_fils == 0:
        raise validation_error({"amountFils": "must be non-zero"})
    goal = await get_owned(Goal, goal_id, current.household_id, "Goal")
    goal.saved_fils = max(0, goal.saved_fils + body.amount_fils)
    goal.touch()
    await goal.save()
    return goal_out(goal)
