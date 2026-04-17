from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.entities import ChatMessage, ChatSession, EscalationTicket, EventLog, Order, User
from app.schemas.admin import AdminMetrics


def collect_admin_metrics(db: Session) -> AdminMetrics:
    total_users = db.scalar(select(func.count(User.id))) or 0
    paid_users = db.scalar(select(func.count(User.id)).where(User.paid_chat_credits > 0)) or 0
    total_orders = db.scalar(select(func.count(Order.id))) or 0
    paid_orders = db.scalar(select(func.count(Order.id)).where(Order.status == "paid")) or 0
    total_revenue = db.scalar(select(func.coalesce(func.sum(Order.amount_cents), 0)).where(Order.status == "paid")) or 0
    open_tickets = db.scalar(select(func.count(EscalationTicket.id)).where(EscalationTicket.status == "open")) or 0
    chat_sessions = db.scalar(select(func.count(ChatSession.id))) or 0

    start_day = datetime.now(UTC).replace(tzinfo=None, hour=0, minute=0, second=0, microsecond=0)
    messages_today = db.scalar(select(func.count(ChatMessage.id)).where(ChatMessage.created_at >= start_day)) or 0

    return AdminMetrics(
        total_users=int(total_users),
        paid_users=int(paid_users),
        total_orders=int(total_orders),
        paid_orders=int(paid_orders),
        total_revenue_cents=int(total_revenue),
        open_tickets=int(open_tickets),
        chat_sessions=int(chat_sessions),
        messages_today=int(messages_today),
    )


def log_event(db: Session, request_id: str, user_id: str, event_type: str, meta: dict) -> None:
    db.add(EventLog(request_id=request_id, user_id=user_id, event_type=event_type, meta_json=json.dumps(meta, ensure_ascii=False)))
    db.commit()
