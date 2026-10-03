from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def now_utc() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mobile: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nickname: Mapped[str] = mapped_column(String(60), default="")
    device_fingerprint: Mapped[str] = mapped_column(String(120), default="")
    wechat_openid: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True, index=True)
    wechat_unionid: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    login_provider: Mapped[str] = mapped_column(String(20), default="mobile")
    referred_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    invite_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    free_chat_quota: Mapped[int] = mapped_column(Integer, default=10)
    free_report_quota: Mapped[int] = mapped_column(Integer, default=1)
    paid_chat_credits: Mapped[int] = mapped_column(Integer, default=0)
    membership_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False)

    sessions: Mapped[list["ChatSession"]] = relationship("ChatSession", back_populates="user")
    consult_cases: Mapped[list["ConsultCase"]] = relationship("ConsultCase", back_populates="user")


class SmsCode(Base):
    __tablename__ = "sms_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mobile: Mapped[str] = mapped_column(String(20), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class ChatSession(Base, TimestampMixin):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    lane: Mapped[str] = mapped_column(String(40), default="civil-commercial")
    risk_level: Mapped[str] = mapped_column(String(20), default="R2")
    status: Mapped[str] = mapped_column(String(20), default="active")
    summary: Mapped[str] = mapped_column(Text, default="")

    user: Mapped["User"] = relationship("User", back_populates="sessions")
    messages: Mapped[list["ChatMessage"]] = relationship("ChatMessage", back_populates="session")
    case_links: Mapped[list["CaseSessionLink"]] = relationship("CaseSessionLink", back_populates="session")


class ConsultCase(Base, TimestampMixin):
    __tablename__ = "consult_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    summary: Mapped[str] = mapped_column(Text, default="")
    lane: Mapped[str] = mapped_column(String(40), default="civil-commercial")
    status: Mapped[str] = mapped_column(String(20), default="open")
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    source: Mapped[str] = mapped_column(String(20), default="chat")
    meta_json: Mapped[str] = mapped_column(Text, default="{}")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="consult_cases")
    session_links: Mapped[list["CaseSessionLink"]] = relationship("CaseSessionLink", back_populates="case")
    service_tasks: Mapped[list["ServiceTask"]] = relationship("ServiceTask", back_populates="case")


class CaseSessionLink(Base):
    __tablename__ = "case_session_links"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_case_session_once"),
        UniqueConstraint("case_id", "session_id", name="uq_case_session_pair"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("consult_cases.id"), index=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("chat_sessions.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    case: Mapped["ConsultCase"] = relationship("ConsultCase", back_populates="session_links")
    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="case_links")


class ServiceTask(Base, TimestampMixin):
    __tablename__ = "service_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("consult_cases.id"), index=True)
    session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("chat_sessions.id"), nullable=True, index=True)
    task_type: Mapped[str] = mapped_column(String(40), default="human_service")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    title: Mapped[str] = mapped_column(String(120), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    assignee_ref: Mapped[str] = mapped_column(String(80), default="")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    case: Mapped["ConsultCase"] = relationship("ConsultCase", back_populates="service_tasks")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("chat_sessions.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(80), default="")
    token_input: Mapped[int] = mapped_column(Integer, default=0)
    token_output: Mapped[int] = mapped_column(Integer, default=0)
    cost_micros: Mapped[int] = mapped_column(Integer, default=0)
    request_id: Mapped[str] = mapped_column(String(80), index=True, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")


class ConsultationReport(Base, TimestampMixin):
    __tablename__ = "consultation_reports"
    __table_args__ = (
        UniqueConstraint("session_id", "report_kind", name="uq_report_session_kind"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    case_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("consult_cases.id"), nullable=True, index=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("chat_sessions.id"), index=True)
    report_kind: Mapped[str] = mapped_column(String(30), default="triage")
    status: Mapped[str] = mapped_column(String(20), default="ready")
    risk_level: Mapped[str] = mapped_column(String(20), default="R2")
    lane: Mapped[str] = mapped_column(String(40), default="civil-commercial")
    model: Mapped[str] = mapped_column(String(80), default="")
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    source_request_id: Mapped[str] = mapped_column(String(80), index=True, default="")


class GeneratedDocument(Base, TimestampMixin):
    __tablename__ = "generated_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    case_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("consult_cases.id"), nullable=True, index=True)
    document_type: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    title: Mapped[str] = mapped_column(String(160), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    missing_fields_json: Mapped[str] = mapped_column(Text, default="[]")
    warnings_json: Mapped[str] = mapped_column(Text, default="[]")
    model: Mapped[str] = mapped_column(String(80), default="")
    source_request_id: Mapped[str] = mapped_column(String(80), index=True, default="")


class EntitlementLedger(Base):
    __tablename__ = "entitlement_ledger"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_entitlement_idempotency"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    entitlement_type: Mapped[str] = mapped_column(String(40), default="chat")
    delta: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int] = mapped_column(Integer, default=0)
    reason: Mapped[str] = mapped_column(String(80), default="")
    source_type: Mapped[str] = mapped_column(String(40), default="")
    source_id: Mapped[str] = mapped_column(String(80), default="")
    idempotency_key: Mapped[str] = mapped_column(String(160))
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Plan(Base, TimestampMixin):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(280), default="")
    price_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(8), default="CNY")
    chat_credits: Mapped[int] = mapped_column(Integer, default=0)
    membership_days: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class Order(Base, TimestampMixin):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_order_user_idempotency"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    plan_code: Mapped[str] = mapped_column(String(40), index=True)
    amount_cents: Mapped[int] = mapped_column(Integer)
    channel: Mapped[str] = mapped_column(String(20), default="wechat")
    idempotency_key: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="created")
    provider_order_id: Mapped[str] = mapped_column(String(80), default="")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PaymentAttempt(Base):
    __tablename__ = "payment_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    channel: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    request_payload: Mapped[str] = mapped_column(Text, default="")
    response_payload: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class ReferralBind(Base):
    __tablename__ = "referral_bindings"
    __table_args__ = (UniqueConstraint("invitee_user_id", name="uq_invitee_once"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inviter_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    invitee_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    ip_address: Mapped[str] = mapped_column(String(80), default="")
    device_fingerprint: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class ReferralReward(Base):
    __tablename__ = "referral_rewards"
    __table_args__ = (UniqueConstraint("invitee_user_id", "order_id", name="uq_referral_reward_order_once"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    inviter_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    invitee_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    reward_type: Mapped[str] = mapped_column(String(20), default="credits")
    reward_value: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EscalationTicket(Base, TimestampMixin):
    __tablename__ = "escalation_tickets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("chat_sessions.id"), index=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="open")
    priority: Mapped[str] = mapped_column(String(20), default="normal")
    contact_mobile: Mapped[str] = mapped_column(String(20), default="")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EventLog(Base):
    __tablename__ = "event_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[str] = mapped_column(String(80), index=True)
    user_id: Mapped[str] = mapped_column(String(36), default="", index=True)
    event_type: Mapped[str] = mapped_column(String(40), index=True)
    meta_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
