from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import ReferralBind, ReferralReward, User


def can_bind_referral(db: Session, inviter: User, invitee: User, ip_address: str) -> tuple[bool, str]:
    if inviter.id == invitee.id:
        return False, "Cannot bind your own invite code"

    existing = db.scalar(select(ReferralBind).where(ReferralBind.invitee_user_id == invitee.id))
    if existing is not None:
        return False, "Invitee already bound"

    ip_count = db.scalar(
        select(func.count(ReferralBind.id))
        .where(ReferralBind.ip_address == ip_address)
        .where(ReferralBind.created_at >= datetime.now(UTC).replace(tzinfo=None, hour=0, minute=0, second=0, microsecond=0))
    )
    if ip_count and ip_count >= 15:
        return False, "IP daily bind limit reached"

    if inviter.device_fingerprint and inviter.device_fingerprint == invitee.device_fingerprint:
        return False, "Device fingerprint conflict"

    return True, "ok"


def claim_rewards(db: Session, user: User, max_claim_count: int) -> tuple[int, int]:
    rewards = db.scalars(
        select(ReferralReward)
        .where(ReferralReward.inviter_user_id == user.id)
        .where(ReferralReward.status == "pending")
        .order_by(ReferralReward.id.asc())
        .limit(max_claim_count)
    ).all()
    claimed = 0
    granted = 0
    for reward in rewards:
        reward.status = "claimed"
        reward.claimed_at = datetime.now(UTC).replace(tzinfo=None)
        claimed += 1
        granted += reward.reward_value
        db.add(reward)
    if granted > 0:
        user.paid_chat_credits += granted
        db.add(user)
    db.commit()
    return claimed, granted
