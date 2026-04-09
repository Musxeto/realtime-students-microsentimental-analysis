from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
from hashlib import pbkdf2_hmac
from hmac import compare_digest
import secrets

from fastapi import HTTPException, status
from jose import JWTError, jwt

from .config import settings


PASSWORD_ITERATIONS = 210_000


def hash_password(password: str, salt: str | None = None) -> str:
    salt_value = salt or secrets.token_hex(16)
    digest = pbkdf2_hmac("sha256", password.encode("utf-8"), salt_value.encode("utf-8"), PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt_value}${base64.urlsafe_b64encode(digest).decode('ascii')}"


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        scheme, iterations, salt, encoded = hashed_password.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        digest = pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations))
        return compare_digest(base64.urlsafe_b64encode(digest).decode("ascii"), encoded)
    except ValueError:
        return False


def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
        "iat": int(now.timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
