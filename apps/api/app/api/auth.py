from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_request_id
from app.core.config import settings
from app.core.security import generate_token
from app.db.session import get_db
from app.models.entities import User
from app.schemas.auth import LoginRequest, LoginResponse, LoginUser, SendCodeRequest, SendCodeResponse
from app.services.sms import issue_sms_code, verify_sms_code

router = APIRouter(prefix="/v1/auth", tags=["auth"])


def _normalize_mobile(value: str) -> str:
    return re.sub(r"\s+", "", value.strip())


@router.post("/mobile/send-code", response_model=SendCodeResponse)
def send_mobile_code(
    payload: SendCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> SendCodeResponse:
    mobile = _normalize_mobile(payload.mobile)
    if len(mobile) < 6:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid mobile number")

    code, expires_at = issue_sms_code(db=db, mobile=mobile)
    return SendCodeResponse(
        request_id=get_request_id(request),
        expires_at=expires_at,
        debug_code=code if settings.is_dev else None,
    )


@router.post("/mobile/login", response_model=LoginResponse)
def login_mobile(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LoginResponse:
    mobile = _normalize_mobile(payload.mobile)
    if not verify_sms_code(db=db, mobile=mobile, code=payload.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired code")

    user = db.scalar(select(User).where(User.mobile == mobile))
    if user is None:
        invite_code = uuid.uuid4().hex[:8].upper()
        user = User(
            mobile=mobile,
            nickname=payload.nickname or f"用户{mobile[-4:]}",
            device_fingerprint=payload.device_fingerprint.strip(),
            invite_code=invite_code,
            free_chat_quota=settings.free_chat_quota,
            free_report_quota=settings.free_report_quota,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if payload.device_fingerprint.strip():
            user.device_fingerprint = payload.device_fingerprint.strip()
            db.add(user)
            db.commit()
            db.refresh(user)

    token = generate_token(user.id)
    user_out = LoginUser(
        id=user.id,
        mobile=user.mobile,
        invite_code=user.invite_code,
        free_chat_quota=user.free_chat_quota,
        free_report_quota=user.free_report_quota,
        paid_chat_credits=user.paid_chat_credits,
        membership_expires_at=user.membership_expires_at,
    )
    return LoginResponse(
        request_id=get_request_id(request),
        token=token,
        user=user_out,
    )

