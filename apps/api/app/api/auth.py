from __future__ import annotations

import re
import uuid
from hashlib import sha256

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_request_id
from app.core.config import settings
from app.core.security import generate_token
from app.db.session import get_db
from app.models.entities import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LoginUser,
    MeResponse,
    MeUserSnapshot,
    SendCodeRequest,
    SendCodeResponse,
    WechatLoginRequest,
)
from app.services.sms import issue_sms_code, verify_sms_code

router = APIRouter(prefix="/v1/auth", tags=["auth"])


def _normalize_mobile(value: str) -> str:
    return re.sub(r"\s+", "", value.strip())


def _user_mobile(user: User) -> str:
    return "" if user.login_provider == "wechat" else user.mobile


def _login_user(user: User) -> LoginUser:
    return LoginUser(
        id=user.id,
        mobile=_user_mobile(user),
        nickname=user.nickname,
        login_provider=user.login_provider,
        invite_code=user.invite_code,
        free_chat_quota=user.free_chat_quota,
        free_report_quota=user.free_report_quota,
        paid_chat_credits=user.paid_chat_credits,
        membership_expires_at=user.membership_expires_at,
    )


def _wechat_placeholder(openid: str) -> str:
    return f"wx_{sha256(openid.encode('utf-8')).hexdigest()[:16]}"


def _exchange_wechat_code(code: str) -> tuple[str, str | None]:
    if not settings.wechat_app_id or not settings.wechat_app_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WeChat login is not configured",
        )

    try:
        response = httpx.get(
            "https://api.weixin.qq.com/sns/jscode2session",
            params={
                "appid": settings.wechat_app_id,
                "secret": settings.wechat_app_secret,
                "js_code": code,
                "grant_type": "authorization_code",
            },
            timeout=settings.wechat_login_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="WeChat login service unavailable",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid WeChat login response")
    if payload.get("errcode"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="WeChat login code expired or invalid",
        )

    openid = str(payload.get("openid") or "").strip()
    if not openid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="WeChat openid missing")
    unionid = str(payload.get("unionid") or "").strip() or None
    return openid, unionid


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
        default_nickname = f"用户{mobile[-4:]}"
        user = User(
            mobile=mobile,
            nickname=payload.nickname or default_nickname,
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
    return LoginResponse(
        request_id=get_request_id(request),
        token=token,
        user=_login_user(user),
    )


@router.post("/wechat/login", response_model=LoginResponse)
def login_wechat(
    payload: WechatLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LoginResponse:
    openid, unionid = _exchange_wechat_code(payload.code.strip())
    user = db.scalar(select(User).where(User.wechat_openid == openid))

    if user is None:
        user = User(
            mobile=_wechat_placeholder(openid),
            nickname=payload.nickname.strip() or "微信用户",
            device_fingerprint=payload.device_fingerprint.strip(),
            wechat_openid=openid,
            wechat_unionid=unionid,
            login_provider="wechat",
            invite_code=uuid.uuid4().hex[:8].upper(),
            free_chat_quota=settings.free_chat_quota,
            free_report_quota=settings.free_report_quota,
        )
        db.add(user)
    else:
        if payload.nickname.strip():
            user.nickname = payload.nickname.strip()
        if payload.device_fingerprint.strip():
            user.device_fingerprint = payload.device_fingerprint.strip()
        if unionid and not user.wechat_unionid:
            user.wechat_unionid = unionid
        user.login_provider = "wechat"
        db.add(user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        user = db.scalar(select(User).where(User.wechat_openid == openid))
        if user is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Please retry WeChat login")
    if user.is_blacklisted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User blocked")
    db.refresh(user)
    return LoginResponse(
        request_id=get_request_id(request),
        token=generate_token(user.id),
        user=_login_user(user),
    )


@router.get("/me", response_model=MeResponse)
def get_me(
    request: Request,
    user: User = Depends(get_current_user),
) -> MeResponse:
    return MeResponse(
        request_id=get_request_id(request),
        user=MeUserSnapshot(
            id=user.id,
            mobile=_user_mobile(user),
            nickname=user.nickname,
            login_provider=user.login_provider,
            device_fingerprint=user.device_fingerprint,
            referred_by_user_id=user.referred_by_user_id,
            invite_code=user.invite_code,
            free_chat_quota=user.free_chat_quota,
            free_report_quota=user.free_report_quota,
            paid_chat_credits=user.paid_chat_credits,
            membership_expires_at=user.membership_expires_at,
            is_blacklisted=user.is_blacklisted,
            created_at=user.created_at,
            updated_at=user.updated_at,
        ),
    )
