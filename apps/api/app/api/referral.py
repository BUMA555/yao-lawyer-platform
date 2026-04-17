from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_request_id
from app.db.session import get_db
from app.models.entities import ReferralBind, User
from app.schemas.referral import BindReferralRequest, BindReferralResponse, ClaimRewardRequest, ClaimRewardResponse
from app.services.metrics import log_event
from app.services.referral import can_bind_referral, claim_rewards

router = APIRouter(prefix="/v1/referral", tags=["referral"])


@router.post("/bind", response_model=BindReferralResponse)
def bind_referral(
    payload: BindReferralRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BindReferralResponse:
    inviter = db.scalar(select(User).where(User.invite_code == payload.invite_code.upper()))
    if inviter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite code invalid")

    ip_address = request.client.host if request.client else ""
    ok, reason = can_bind_referral(db=db, inviter=inviter, invitee=user, ip_address=ip_address)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)

    bind = ReferralBind(
        inviter_user_id=inviter.id,
        invitee_user_id=user.id,
        ip_address=ip_address,
        device_fingerprint=payload.device_fingerprint or user.device_fingerprint,
    )
    user.referred_by_user_id = inviter.id
    db.add(bind)
    db.add(user)
    db.commit()

    log_event(
        db=db,
        request_id=get_request_id(request),
        user_id=user.id,
        event_type="referral.bind",
        meta={"inviter_user_id": inviter.id},
    )
    return BindReferralResponse(
        request_id=get_request_id(request),
        inviter_user_id=inviter.id,
        invitee_user_id=user.id,
    )


@router.post("/reward/claim", response_model=ClaimRewardResponse)
def claim_referral_reward(
    payload: ClaimRewardRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClaimRewardResponse:
    claimed_count, granted_credits = claim_rewards(db=db, user=user, max_claim_count=payload.max_claim_count)
    log_event(
        db=db,
        request_id=get_request_id(request),
        user_id=user.id,
        event_type="referral.reward.claim",
        meta={"claimed_count": claimed_count, "granted_credits": granted_credits},
    )
    return ClaimRewardResponse(
        request_id=get_request_id(request),
        claimed_count=claimed_count,
        granted_chat_credits=granted_credits,
    )

