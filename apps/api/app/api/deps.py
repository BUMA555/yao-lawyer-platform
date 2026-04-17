from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import InMemoryRateLimiter
from app.core.security import verify_token
from app.db.session import get_db
from app.models.entities import User

rate_limiter = InMemoryRateLimiter(
    window_seconds=settings.rate_limit_window_seconds,
    max_requests=settings.rate_limit_requests_per_window,
)


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "")


def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.replace("Bearer ", "", 1).strip()
    user_id = verify_token(token)
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.is_blacklisted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User blocked")
    _enforce_rate_limit(request=request, user=user)
    return user


def _enforce_rate_limit(request: Request, user: User) -> None:
    key = f"user:{user.id}"
    if not rate_limiter.allow(key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")

