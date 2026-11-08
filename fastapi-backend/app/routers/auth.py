from __future__ import annotations

from datetime import timedelta

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse

from app.config import Settings
from app.errors import AppError, error_body
from app.models import Household, Invite, Session, User, as_utc, utcnow
from app.schemas.auth import (
    HouseholdOut,
    JoinIn,
    LoginIn,
    MeOut,
    RegisterIn,
    StatusOut,
    UserEnvelope,
)
from app.security.deps import CurrentUser, get_app_settings, get_current_user
from app.security.passwords import hash_password, needs_rehash, verify_password
from app.security.tokens import ACCESS_COOKIE, REFRESH_COOKIE, decode_access_token, hash_token
from app.services.auth_sessions import (
    clear_auth_cookies,
    create_session,
    issue_session,
    revoke_all_sessions,
    set_auth_cookies,
)
from app.services.categories import seed_default_categories
from app.services.serializers import user_out

router = APIRouter(prefix="/auth", tags=["auth"])


async def _registration_open(settings: Settings) -> bool:
    return settings.allow_registration or await User.find_one({}) is None


async def _ensure_email_free(email: str) -> None:
    if await User.find_one({"email": email}) is not None:
        raise AppError(409, "email_taken", "An account with this email already exists", {"email": "already registered"})


@router.get("/status", response_model=StatusOut)
async def auth_status(settings: Settings = Depends(get_app_settings)) -> StatusOut:
    return StatusOut(registration_open=await _registration_open(settings))


@router.post("/register", response_model=UserEnvelope, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterIn, request: Request, response: Response, settings: Settings = Depends(get_app_settings)
) -> UserEnvelope:
    if not await _registration_open(settings):
        raise AppError(403, "registration_closed", "Registration is closed")
    await _ensure_email_free(body.email)
    user_id = PydanticObjectId()
    household = Household(name=body.household_name, owner_id=user_id)
    await household.insert()
    user = User(
        id=user_id,
        household_id=household.id,  # type: ignore[arg-type]
        email=body.email,
        name=body.name,
        password_hash=hash_password(body.password),
        role="owner",
    )
    await user.insert()
    await seed_default_categories(household.id)  # type: ignore[arg-type]
    await issue_session(user, request, response, settings)
    return UserEnvelope(user=user_out(user))


@router.post("/join", response_model=UserEnvelope, status_code=status.HTTP_201_CREATED)
async def join(
    body: JoinIn, request: Request, response: Response, settings: Settings = Depends(get_app_settings)
) -> UserEnvelope:
    invalid = AppError(400, "invalid_invite", "Invite code is invalid or expired", {"inviteCode": "invalid or expired"})
    invite = await Invite.find_one({"code_hash": hash_token(body.invite_code), "used_by": None})
    if invite is None or as_utc(invite.expires_at) <= utcnow():
        raise invalid
    await _ensure_email_free(body.email)
    user = User(
        household_id=invite.household_id,
        email=body.email,
        name=body.name,
        password_hash=hash_password(body.password),
        role="member",
    )
    # Insert the user first (unique email index may still race -> 409), then atomically
    # claim the invite. A failed claim rolls the user back, so an invite is never burned
    # without a user being created.
    await user.insert()
    claimed = await Invite.get_motor_collection().update_one(
        {"_id": invite.id, "used_by": None},
        {"$set": {"used_by": user.id, "used_at": utcnow(), "updated_at": utcnow()}},
    )
    if claimed.modified_count != 1:
        await user.delete()
        raise invalid
    await issue_session(user, request, response, settings)
    return UserEnvelope(user=user_out(user))


@router.post("/login", response_model=UserEnvelope)
async def login(
    body: LoginIn, request: Request, response: Response, settings: Settings = Depends(get_app_settings)
) -> UserEnvelope:
    failures = request.app.state.login_failures
    if failures.is_locked(body.email):
        raise AppError(429, "too_many_attempts", "Too many failed sign-in attempts. Try again in a few minutes.")
    user = await User.find_one({"email": body.email})
    ok = verify_password(user.password_hash if user else None, body.password)
    if user is None or not ok:
        failures.record_failure(body.email)
        raise AppError(401, "invalid_credentials", "Invalid email or password")
    failures.reset(body.email)
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
        user.touch()
        await user.save()
    await issue_session(user, request, response, settings)
    return UserEnvelope(user=user_out(user))


@router.post("/refresh", response_model=UserEnvelope)
async def refresh(
    request: Request, response: Response, settings: Settings = Depends(get_app_settings)
) -> UserEnvelope:
    def fail(code: str, message: str) -> JSONResponse:
        resp = JSONResponse(status_code=401, content=error_body(code, message))
        clear_auth_cookies(resp, settings)
        return resp

    def race() -> JSONResponse:
        # Lost a concurrent refresh (e.g. two tabs). Cookies are NOT cleared: the winner's
        # response already set fresh ones in the shared jar; the client just retries.
        return JSONResponse(status_code=401, content=error_body("refresh_race", "Session was just refreshed"))

    def in_grace(s: Session) -> bool:
        if s.revoked_at is None or s.replaced_by is None:
            return False
        age = utcnow() - as_utc(s.revoked_at)
        same_ua = (s.user_agent or None) == ((request.headers.get("user-agent") or "")[:300] or None)
        return same_ua and age <= timedelta(seconds=settings.refresh_reuse_grace_seconds)

    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        return fail("unauthorized", "Not authenticated")  # type: ignore[return-value]
    session = await Session.find_one({"token_hash": hash_token(token)})
    if session is None:
        return fail("unauthorized", "Not authenticated")  # type: ignore[return-value]
    if session.replaced_by is not None:
        if in_grace(session):
            return race()  # type: ignore[return-value]
        # Rotated token presented again: assume theft, revoke every session of this user.
        await revoke_all_sessions(session.user_id)
        return fail("refresh_reused", "Session expired, please log in again")  # type: ignore[return-value]
    if session.revoked_at is not None or as_utc(session.expires_at) <= utcnow():
        return fail("unauthorized", "Session expired, please log in again")  # type: ignore[return-value]
    user = await User.get(session.user_id)
    if user is None:
        return fail("unauthorized", "Not authenticated")  # type: ignore[return-value]
    new_session, new_token = await create_session(user, request, settings)
    # Conditional update guards against concurrent double-rotation.
    res = await Session.get_motor_collection().update_one(
        {"_id": session.id, "revoked_at": None, "replaced_by": None},
        {"$set": {"revoked_at": utcnow(), "replaced_by": new_session.id, "updated_at": utcnow()}},
    )
    if res.modified_count != 1:
        await new_session.delete()
        current = await Session.get(session.id)  # type: ignore[arg-type]
        if current is not None and in_grace(current):
            return race()  # type: ignore[return-value]
        await revoke_all_sessions(session.user_id)
        return fail("refresh_reused", "Session expired, please log in again")  # type: ignore[return-value]
    set_auth_cookies(response, user, new_session, new_token, settings)
    return UserEnvelope(user=user_out(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, settings: Settings = Depends(get_app_settings)) -> Response:
    token = request.cookies.get(REFRESH_COOKIE)
    revoke = {"$set": {"revoked_at": utcnow(), "updated_at": utcnow()}}
    if token:
        await Session.find({"token_hash": hash_token(token), "revoked_at": None}).update(revoke)
    access = request.cookies.get(ACCESS_COOKIE)
    claims = decode_access_token(access, settings.jwt_secret) if access else None
    if claims is not None and PydanticObjectId.is_valid(claims.session_id):
        await Session.find(
            {"_id": PydanticObjectId(claims.session_id), "user_id": PydanticObjectId(claims.user_id), "revoked_at": None}
        ).update(revoke)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_auth_cookies(response, settings)
    return response


async def build_household_out(household_id: PydanticObjectId) -> HouseholdOut:
    household = await Household.get(household_id)
    if household is None:
        raise AppError(404, "not_found", "Household not found")
    members = await User.find({"household_id": household_id}).sort("+created_at").to_list()
    return HouseholdOut(
        id=str(household.id),
        name=household.name,
        base_currency=household.base_currency,
        members=[user_out(m) for m in members],
    )


@router.get("/me", response_model=MeOut)
async def me(current: CurrentUser = Depends(get_current_user)) -> MeOut:
    user = await User.get(current.user_id)
    assert user is not None
    return MeOut(user=user_out(user), household=await build_household_out(current.household_id))
