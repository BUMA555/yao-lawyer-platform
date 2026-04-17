from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import ApiResponse


class BindReferralRequest(BaseModel):
    invite_code: str = Field(min_length=4, max_length=16)
    device_fingerprint: str = Field(default="", max_length=120)


class BindReferralResponse(ApiResponse):
    inviter_user_id: str
    invitee_user_id: str


class ClaimRewardRequest(BaseModel):
    max_claim_count: int = Field(default=10, ge=1, le=50)


class ClaimRewardResponse(ApiResponse):
    claimed_count: int
    granted_chat_credits: int

