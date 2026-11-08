from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

ALGORITHM = "HS256"
ACCESS_COOKIE = "mbp_access"
REFRESH_COOKIE = "mbp_refresh"


@dataclass(frozen=True)
class AccessClaims:
    user_id: str
    household_id: str
    jti: str
    session_id: str


def create_access_token(
    user_id: str,
    household_id: str,
    secret: str,
    minutes: int,
    session_id: str,
    now: datetime | None = None,
) -> str:
    now = now or datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "hid": str(household_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
        "jti": uuid.uuid4().hex,
        # Session binding: access tokens die with their session (logout / reuse revocation).
        "sid": str(session_id),
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_access_token(token: str, secret: str) -> AccessClaims | None:
    try:
        data = jwt.decode(
            token,
            secret,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "hid", "exp", "iat", "jti", "sid"]},
        )
    except jwt.PyJWTError:
        return None
    return AccessClaims(
        user_id=data["sub"], household_id=data["hid"], jti=data["jti"], session_id=str(data["sid"])
    )


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_opaque_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)
