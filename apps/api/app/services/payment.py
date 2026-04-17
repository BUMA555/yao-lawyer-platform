from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Order, PaymentAttempt, Plan, ReferralBind, ReferralReward, User
from app.services.orchestrator import dump_payload


def build_mock_prepay_payload(channel: str, order_id: str, amount_cents: int) -> dict:
    expires = datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=15)
    nonce = secrets.token_hex(8)
    return {
        "channel": channel,
        "order_id": order_id,
        "nonce_str": nonce,
        "amount_cents": amount_cents,
        "expires_at": expires.isoformat(),
        "payment_url": f"https://mock-pay.local/{channel}/{order_id}?nonce={nonce}",
    }


def mark_order_paid(db: Session, order: Order, provider_order_id: str = "") -> Order:
    if order.status == "paid":
        return order

    plan = db.scalar(select(Plan).where(Plan.code == order.plan_code))
    user = db.scalar(select(User).where(User.id == order.user_id))
    if plan is None or user is None:
        raise ValueError("order dependency missing")

    order.status = "paid"
    order.provider_order_id = provider_order_id or order.provider_order_id
    order.paid_at = datetime.now(UTC).replace(tzinfo=None)
    user.paid_chat_credits += plan.chat_credits
    if plan.membership_days > 0:
        now = datetime.now(UTC).replace(tzinfo=None)
        base = user.membership_expires_at if user.membership_expires_at and user.membership_expires_at > now else now
        user.membership_expires_at = base + timedelta(days=plan.membership_days)
    db.add(order)
    db.add(user)

    _create_referral_reward_if_needed(db, user_id=user.id, order_id=order.id)
    db.commit()
    db.refresh(order)
    return order


def create_payment_attempt(db: Session, order: Order, channel: str, payload: dict) -> PaymentAttempt:
    attempt = PaymentAttempt(
        order_id=order.id,
        channel=channel,
        status="pending",
        request_payload=dump_payload({"order_id": order.id, "channel": channel}),
        response_payload=dump_payload(payload),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def mark_order_refunded(db: Session, order: Order) -> Order:
    if order.status == "refunded":
        return order
    order.status = "refunded"
    order.refunded_at = datetime.now(UTC).replace(tzinfo=None)
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def _create_referral_reward_if_needed(db: Session, user_id: str, order_id: str) -> None:
    bind = db.scalar(select(ReferralBind).where(ReferralBind.invitee_user_id == user_id))
    if bind is None:
        return
    existing = db.scalar(
        select(ReferralReward)
        .where(ReferralReward.invitee_user_id == user_id)
        .where(ReferralReward.order_id == order_id)
    )
    if existing is not None:
        return
    db.add(
        ReferralReward(
            inviter_user_id=bind.inviter_user_id,
            invitee_user_id=user_id,
            order_id=order_id,
            reward_type="credits",
            reward_value=15,
            status="pending",
        )
    )
