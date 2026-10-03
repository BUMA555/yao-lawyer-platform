from __future__ import annotations

import secrets
import json
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Order, PaymentAttempt, Plan, ReferralBind, ReferralReward, User
from app.services.orchestrator import dump_payload
from app.services.entitlements import grant_entitlement, revoke_entitlement


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
        "mode": "mock",
    }


def mock_payments_allowed() -> bool:
    return settings.is_dev and settings.payment_mock_enabled


def _wechat_pay_client():
    if not settings.wechat_pay_enabled:
        raise HTTPException(status_code=503, detail="WeChat payment is not configured")
    required = [
        settings.wechat_app_id,
        settings.wechat_pay_mch_id,
        settings.wechat_pay_serial_no,
        settings.wechat_pay_api_v3_key,
        settings.wechat_pay_private_key or settings.wechat_pay_private_key_path,
    ]
    if not all(required) or len(settings.wechat_pay_api_v3_key.encode("utf-8")) != 32:
        raise HTTPException(status_code=503, detail="WeChat payment configuration incomplete")
    if not settings.wechat_pay_notify_url.startswith("https://"):
        raise HTTPException(status_code=503, detail="WeChat payment requires an HTTPS notify URL")
    if settings.wechat_pay_api_base_url != "https://api.mch.weixin.qq.com":
        raise HTTPException(status_code=503, detail="Unsupported WeChat payment API endpoint")
    try:
        from wechatpayv3 import WeChatPay, WeChatPayType

        private_key = settings.wechat_pay_private_key or Path(settings.wechat_pay_private_key_path).read_text(encoding="utf-8")
        private_key = private_key.replace("\\n", "\n")
        platform_cert_path = Path(settings.wechat_pay_platform_cert_path) if settings.wechat_pay_platform_cert_path else None
        cert_dir = (
            str(platform_cert_path.parent)
            if platform_cert_path and platform_cert_path.is_file()
            else str(platform_cert_path)
            if platform_cert_path
            else None
        )
        public_key = (
            Path(settings.wechat_pay_public_key_path).read_text(encoding="utf-8")
            if settings.wechat_pay_public_key_path else None
        )
        return WeChatPay(
            wechatpay_type=WeChatPayType.MINIPROG,
            mchid=settings.wechat_pay_mch_id,
            private_key=private_key,
            cert_serial_no=settings.wechat_pay_serial_no,
            appid=settings.wechat_app_id,
            apiv3_key=settings.wechat_pay_api_v3_key,
            notify_url=settings.wechat_pay_notify_url,
            cert_dir=cert_dir,
            public_key=public_key,
            public_key_id=settings.wechat_pay_public_key_id or None,
            timeout=(5, 15),
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail="WeChat payment credentials unavailable") from exc


def wechat_trade_no(order: Order) -> str:
    # The database UUID includes hyphens; the provider allows at most 32 characters.
    return uuid.UUID(order.id).hex


def order_id_from_trade_no(value: str) -> str:
    if len(value) != 32 or any(character not in "0123456789abcdefABCDEF" for character in value):
        raise HTTPException(status_code=400, detail="Invalid WeChat trade number")
    return str(uuid.UUID(hex=value))


def build_wechat_prepay_payload(order: Order, user: User, description: str) -> dict:
    client = _wechat_pay_client()
    if not user.wechat_openid:
        raise HTTPException(status_code=409, detail="Please log in with WeChat before paying")
    try:
        code, response = client.pay(
            description=description[:120],
            out_trade_no=wechat_trade_no(order),
            amount={"total": order.amount_cents, "currency": "CNY"},
            payer={"openid": user.wechat_openid},
        )
        payload = json.loads(response)
        if code not in range(200, 300) or not payload.get("prepay_id"):
            raise ValueError("Provider rejected prepay")
        timestamp = str(int(time.time()))
        nonce = secrets.token_hex(16)
        package = f"prepay_id={payload['prepay_id']}"
        return {
            "mode": "wechat",
            "timeStamp": timestamp,
            "nonceStr": nonce,
            "package": package,
            "signType": "RSA",
            "paySign": client.sign([settings.wechat_app_id, timestamp, nonce, package]),
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail="WeChat prepay unavailable; please retry") from exc


def decode_wechat_notification(headers: dict, body: bytes) -> dict:
    headers = {key.lower(): value for key, value in headers.items()}
    try:
        timestamp = int(headers.get("wechatpay-timestamp", ""))
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid WeChat notification timestamp") from exc
    if abs(time.time() - timestamp) > 300:
        raise HTTPException(status_code=401, detail="WeChat notification expired")
    client = _wechat_pay_client()
    headers.setdefault("wechatpay-signature-type", "WECHATPAY2-SHA256-RSA2048")
    try:
        notification = client.callback(headers, body)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid WeChat notification signature") from exc
    if not isinstance(notification, dict) or not isinstance(notification.get("resource"), dict):
        raise HTTPException(status_code=401, detail="Invalid WeChat notification signature")
    if notification.get("event_type") != "TRANSACTION.SUCCESS":
        raise HTTPException(status_code=400, detail="Unexpected WeChat payment event")
    return notification["resource"]


def apply_wechat_transaction(db: Session, order: Order, transaction: dict) -> Order:
    user = db.scalar(select(User).where(User.id == order.user_id))
    amount = transaction.get("amount")
    payer = transaction.get("payer")
    if (
        order.channel != "wechat"
        or transaction.get("appid") != settings.wechat_app_id
        or transaction.get("mchid") != settings.wechat_pay_mch_id
        or transaction.get("out_trade_no") != wechat_trade_no(order)
        or not isinstance(amount, dict)
        or type(amount.get("total")) is not int
        or amount.get("total") != order.amount_cents
        or amount.get("currency") != "CNY"
        or user is None
        or not isinstance(payer, dict)
        or not user.wechat_openid
        or payer.get("openid") != user.wechat_openid
    ):
        raise HTTPException(status_code=400, detail="WeChat transaction does not match order")
    if transaction.get("trade_state") != "SUCCESS" or not transaction.get("transaction_id"):
        raise HTTPException(status_code=400, detail="WeChat transaction is not paid")
    if order.status == "paid" and order.provider_order_id != transaction["transaction_id"]:
        raise HTTPException(status_code=409, detail="WeChat transaction ID conflict")
    try:
        return mark_order_paid(db, order, str(transaction["transaction_id"]))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


def reconcile_wechat_order(db: Session, order: Order) -> Order:
    client = _wechat_pay_client()
    try:
        code, response = client.query(out_trade_no=wechat_trade_no(order))
        transaction = json.loads(response)
        if code not in range(200, 300) or not isinstance(transaction, dict):
            raise ValueError("Provider query failed")
    except Exception as exc:
        raise HTTPException(status_code=502, detail="WeChat order query unavailable") from exc
    if transaction.get("trade_state") == "SUCCESS":
        return apply_wechat_transaction(db, order, transaction)
    return order


def mark_order_paid(db: Session, order: Order, provider_order_id: str = "") -> Order:
    order = db.scalar(
        select(Order).where(Order.id == order.id).with_for_update().execution_options(populate_existing=True)
    )
    if order is None:
        raise ValueError("Order not found")
    if order.status == "paid":
        return order
    if order.status == "refunded":
        raise ValueError("Refunded orders cannot be marked paid again")

    plan = db.scalar(select(Plan).where(Plan.code == order.plan_code))
    user = db.scalar(
        select(User).where(User.id == order.user_id).with_for_update().execution_options(populate_existing=True)
    )
    if plan is None or user is None:
        raise ValueError("order dependency missing")

    order.status = "paid"
    order.provider_order_id = provider_order_id or order.provider_order_id
    order.paid_at = datetime.now(UTC).replace(tzinfo=None)
    grant_entitlement(
        db,
        user=user,
        amount=plan.chat_credits,
        idempotency_key=f"order:{order.id}:grant:chat",
        reason="order.paid",
        source_type="order",
        source_id=order.id,
        metadata={"plan_code": plan.code},
    )
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
    if order.status != "paid":
        raise ValueError("Only paid orders can be refunded")

    plan = db.scalar(select(Plan).where(Plan.code == order.plan_code))
    user = db.scalar(select(User).where(User.id == order.user_id))
    if plan is None or user is None:
        raise ValueError("order dependency missing")

    if order.paid_at is not None:
        later_paid_order = db.scalar(
            select(Order)
            .where(Order.user_id == order.user_id)
            .where(Order.status == "paid")
            .where(Order.paid_at.is_not(None))
            .where(Order.paid_at > order.paid_at)
            .limit(1)
        )
        if later_paid_order is not None:
            raise ValueError("Refund requires manual review because newer paid orders already exist")

    if user.paid_chat_credits < plan.chat_credits:
        raise ValueError("Refund requires manual review because granted chat credits were already consumed")

    rewards = db.scalars(select(ReferralReward).where(ReferralReward.order_id == order.id)).all()
    for reward in rewards:
        inviter = db.scalar(select(User).where(User.id == reward.inviter_user_id))
        if reward.status == "claimed":
            if inviter is None or inviter.paid_chat_credits < reward.reward_value:
                raise ValueError("Refund requires manual review because referral rewards were already consumed")
            revoke_entitlement(
                db,
                user=inviter,
                amount=reward.reward_value,
                idempotency_key=f"referral:{reward.id}:revoke:chat",
                reason="referral.reward.reversed",
                source_type="referral_reward",
                source_id=str(reward.id),
                metadata={"order_id": order.id},
            )
            reward.status = "reversed"
        else:
            reward.status = "cancelled"
        db.add(reward)

    revoke_entitlement(
        db,
        user=user,
        amount=plan.chat_credits,
        idempotency_key=f"order:{order.id}:refund:chat",
        reason="order.refund",
        source_type="order",
        source_id=order.id,
        metadata={"plan_code": plan.code},
    )
    if plan.membership_days > 0 and user.membership_expires_at is not None:
        user.membership_expires_at = user.membership_expires_at - timedelta(days=plan.membership_days)
        now = datetime.now(UTC).replace(tzinfo=None)
        if user.membership_expires_at <= now:
            user.membership_expires_at = None

    order.status = "refunded"
    order.refunded_at = datetime.now(UTC).replace(tzinfo=None)
    db.add(order)
    db.add(user)
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
