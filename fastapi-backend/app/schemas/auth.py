from __future__ import annotations

from typing import Annotated

from pydantic import EmailStr, StringConstraints, field_validator

from app.schemas.base import ApiModel, InputModel, Name
from app.security.passwords import MIN_PASSWORD_LENGTH

Password = Annotated[str, StringConstraints(min_length=MIN_PASSWORD_LENGTH, max_length=256)]


class _EmailLower(InputModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()


class RegisterIn(_EmailLower):
    name: Name
    password: Password
    household_name: Name


class JoinIn(_EmailLower):
    name: Name
    password: Password
    invite_code: Annotated[str, StringConstraints(min_length=10, max_length=128)]


class LoginIn(InputModel):
    # Lenient on purpose: login only looks the address up, so accounts on reserved domains
    # (e.g. the seeded demo@mybudgetpal.app) can still sign in. Unknown -> generic 401.
    email: Annotated[str, StringConstraints(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+$")]
    password: Annotated[str, StringConstraints(min_length=1, max_length=256)]

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.lower()


class UserOut(ApiModel):
    id: str
    name: str
    email: str
    role: str


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
