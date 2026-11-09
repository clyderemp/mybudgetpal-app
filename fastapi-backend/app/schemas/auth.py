from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BeforeValidator, EmailStr, StringConstraints, field_validator, model_validator

from app.schemas.base import ApiModel, InputModel, Name
from app.security.passwords import MIN_PASSWORD_LENGTH

Password = Annotated[str, StringConstraints(min_length=MIN_PASSWORD_LENGTH, max_length=256)]
# Lowercase sign-in name: letters, digits, dot, dash, underscore. No "@" so it never looks
# like an email (login decides username vs email on that character).
Username = Annotated[
    str,
    StringConstraints(min_length=3, max_length=32, pattern=r"^[a-z0-9][a-z0-9._-]*$"),
    BeforeValidator(lambda v: v.strip().lower() if isinstance(v, str) else v),
]

# DiceBear 9.x styles the frontend bundles (keep in sync with nextjs-frontend/src/lib/avatars.ts).
AVATAR_STYLES = (
    "notionists", "adventurer", "avataaars", "big-smile", "bottts", "fun-emoji",
    "lorelei", "micah", "open-peeps", "personas", "pixel-art", "thumbs",
)
DEFAULT_AVATAR_STYLE = "notionists"
AvatarStyle = Literal[
    "notionists", "adventurer", "avataaars", "big-smile", "bottts", "fun-emoji",
    "lorelei", "micah", "open-peeps", "personas", "pixel-art", "thumbs",
]
AvatarSeed = Annotated[str, StringConstraints(min_length=1, max_length=64)]


class _EmailLower(InputModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()


class RegisterIn(_EmailLower):
    name: Name
    username: Username | None = None
    password: Password
    household_name: Name


class JoinIn(_EmailLower):
    name: Name
    username: Username | None = None
    password: Password
    invite_code: Annotated[str, StringConstraints(min_length=10, max_length=128)]


class LoginIn(InputModel):
    """Sign in with a username or an email address (``username`` or legacy ``email`` key).

    Lenient on purpose: login only looks the value up, so accounts on reserved domains
    (e.g. the seeded demo@mybudgetpal.app) can still sign in. Unknown -> generic 401.
    """

    username: Annotated[str, StringConstraints(min_length=1, max_length=320)] | None = None
    email: Annotated[str, StringConstraints(min_length=1, max_length=320)] | None = None
    password: Annotated[str, StringConstraints(min_length=1, max_length=256)]

    @model_validator(mode="after")
    def _one_identifier(self) -> LoginIn:
        if not (self.username or self.email):
            raise ValueError("username is required")
        return self

    @property
    def identifier(self) -> str:
        return (self.username or self.email or "").strip().lower()


class PasswordChangeIn(InputModel):
    current_password: Annotated[str, StringConstraints(min_length=1, max_length=256)]
    new_password: Password


class ProfilePatch(InputModel):
    name: Name | None = None
    avatar_style: AvatarStyle | None = None
    avatar_seed: AvatarSeed | None = None


class UserOut(ApiModel):
    id: str
    name: str
    email: str
    username: str | None = None
    role: str
    avatar_style: str = DEFAULT_AVATAR_STYLE
    avatar_seed: str = ""


class UserEnvelope(ApiModel):
    user: UserOut


class HouseholdOut(ApiModel):
    id: str
    name: str
    base_currency: str
    members: list[UserOut]


class MeOut(ApiModel):
    user: UserOut
    household: HouseholdOut


class StatusOut(ApiModel):
    registration_open: bool
