from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import EntitlementLedger, User


def _ledger_for_key(db: Session, user_id: str, idempotency_key: str) -> EntitlementLedger | None:
    return db.scalar(
        select(EntitlementLedger)
        .where(EntitlementLedger.user_id == user_id)
        .where(EntitlementLedger.idempotency_key == idempotency_key)
    )


def _balance(user: User, entitlement_type: str = "chat") -> int:
    if entitlement_type != "chat":
        return 0
    return max(user.free_chat_quota, 0) + max(user.paid_chat_credits, 0)


def apply_entitlement_delta(
    db: Session,
    *,
    user: User,
    delta: int,
    idempotency_key: str,
    reason: str,
    source_type: str = "",
    source_id: str = "",
    entitlement_type: str = "chat",
    metadata: dict[str, Any] | None = None,
) -> EntitlementLedger:
    """Apply one auditable balance change and make retries harmless."""
    if not idempotency_key.strip():
        raise ValueError("idempotency_key is required")

    existing = _ledger_for_key(db, user.id, idempotency_key)
    if existing is not None:
        return existing

    if entitlement_type != "chat":
        raise ValueError(f"Unsupported entitlement type: {entitlement_type}")

    next_paid = user.paid_chat_credits + delta
    if next_paid < 0:
        raise ValueError("Insufficient paid chat credits")

    user.paid_chat_credits = next_paid
    ledger = EntitlementLedger(
        user_id=user.id,
        entitlement_type=entitlement_type,
        delta=delta,
        balance_after=_balance(user, entitlement_type),
        reason=reason[:80],
        source_type=source_type[:40],
        source_id=source_id[:80],
        idempotency_key=idempotency_key[:160],
        metadata_json=json.dumps(metadata or {}, ensure_ascii=False),
    )
    db.add(user)
    db.add(ledger)
    db.flush()
    return ledger


def grant_entitlement(
    db: Session,
    *,
    user: User,
    amount: int,
    idempotency_key: str,
    reason: str,
    source_type: str = "",
    source_id: str = "",
    metadata: dict[str, Any] | None = None,
) -> EntitlementLedger:
    if amount <= 0:
        raise ValueError("Entitlement amount must be positive")
    return apply_entitlement_delta(
        db,
        user=user,
        delta=amount,
        idempotency_key=idempotency_key,
        reason=reason,
        source_type=source_type,
        source_id=source_id,
        metadata=metadata,
    )


def revoke_entitlement(
    db: Session,
    *,
    user: User,
    amount: int,
    idempotency_key: str,
    reason: str,
    source_type: str = "",
    source_id: str = "",
    metadata: dict[str, Any] | None = None,
) -> EntitlementLedger:
    if amount <= 0:
        raise ValueError("Entitlement amount must be positive")
    return apply_entitlement_delta(
        db,
        user=user,
        delta=-amount,
        idempotency_key=idempotency_key,
        reason=reason,
        source_type=source_type,
        source_id=source_id,
        metadata=metadata,
    )


def consume_chat_entitlement(
    db: Session,
    *,
    user: User,
    idempotency_key: str,
    reason: str = "chat.consume",
    source_type: str = "chat",
    source_id: str = "",
    metadata: dict[str, Any] | None = None,
) -> EntitlementLedger:
    existing = _ledger_for_key(db, user.id, idempotency_key)
    if existing is not None:
        return existing

    bucket = ""
    if user.paid_chat_credits > 0:
        user.paid_chat_credits -= 1
        bucket = "paid"
    elif user.free_chat_quota > 0:
        user.free_chat_quota -= 1
        bucket = "free"
    else:
        raise ValueError("No chat quota left")

    ledger = EntitlementLedger(
        user_id=user.id,
        entitlement_type="chat",
        delta=-1,
        balance_after=_balance(user),
        reason=reason[:80],
        source_type=source_type[:40],
        source_id=source_id[:80],
        idempotency_key=idempotency_key[:160],
        metadata_json=json.dumps({**(metadata or {}), "bucket": bucket}, ensure_ascii=False),
    )
    db.add(user)
    db.add(ledger)
    db.flush()
    return ledger


def has_chat_entitlement(user: User) -> bool:
    return user.paid_chat_credits > 0 or user.free_chat_quota > 0


def entitlement_snapshot(user: User) -> dict[str, int]:
    return {
        "chat": max(user.free_chat_quota, 0) + max(user.paid_chat_credits, 0),
        "free_chat": max(user.free_chat_quota, 0),
        "paid_chat": max(user.paid_chat_credits, 0),
        "report": max(user.free_report_quota, 0),
    }
