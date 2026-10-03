from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status

from app.core.config import settings


def hash_sms_code(mobile: str, code: str) -> str:
    payload = f"{mobile}:{code}:{settings.jwt_secret}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def generate_sms_code() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


def generate_token(user_id: str) -> str:
    expires_at = datetime.now(UTC) + timedelta(hours=settings.jwt_expire_hours)
    body = f"{user_id}.{int(expires_at.timestamp())}"
    sig = hmac.new(
        settings.jwt_secret.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{body}.{sig}"


def verify_token(token: str) -> str:
    try:
        user_id, expires_ts, signature = token.split(".")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format") from exc

    body = f"{user_id}.{expires_ts}"
    expected = hmac.new(
        settings.jwt_secret.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token signature invalid")

    if int(expires_ts) < int(datetime.now(UTC).timestamp()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")

    return user_id


def sign_payment_callback(*, secret: str, channel: str, order_id: str, provider_order_id: str, paid: bool, amount_cents: int | None) -> str:
    body = "|".join(
        [
            channel,
            order_id.strip(),
            provider_order_id.strip(),
            "1" if paid else "0",
            "" if amount_cents is None else str(amount_cents),
        ]
    )
    return hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_payment_callback_signature(
    *,
    secret: str,
    channel: str,
    order_id: str,
    provider_order_id: str,
    paid: bool,
    amount_cents: int | None,
    signature: str,
) -> None:
    if not secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Callback secret not configured")
    expected = sign_payment_callback(
        secret=secret,
        channel=channel,
        order_id=order_id,
        provider_order_id=provider_order_id,
        paid=paid,
        amount_cents=amount_cents,
    )
    if not hmac.compare_digest(expected, signature.strip()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Callback signature invalid")
