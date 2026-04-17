from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ApiResponse


class SendCodeRequest(BaseModel):
    mobile: str = Field(min_length=6, max_length=20)
    scene: str = Field(default="login", max_length=40)


class SendCodeResponse(ApiResponse):
    expires_at: datetime
    debug_code: str | None = None


class LoginRequest(BaseModel):
    mobile: str = Field(min_length=6, max_length=20)
    code: str = Field(min_length=4, max_length=10)
    device_fingerprint: str = Field(default="", max_length=120)
    nickname: str = Field(default="", max_length=60)


class LoginUser(BaseModel):
    id: str
    mobile: str
    invite_code: str
    free_chat_quota: int
    free_report_quota: int
    paid_chat_credits: int
    membership_expires_at: datetime | None


class LoginResponse(ApiResponse):
    token: str
    user: LoginUser

