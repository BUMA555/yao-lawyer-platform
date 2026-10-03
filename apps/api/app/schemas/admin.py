from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ApiResponse


class AdminMetrics(BaseModel):
    total_users: int
    paid_users: int
    total_orders: int
    paid_orders: int
    total_revenue_cents: int
    open_tickets: int
    chat_sessions: int
    messages_today: int
    queued_tasks: int
    entitlement_entries: int


class AdminMetricsResponse(ApiResponse):
    metrics: AdminMetrics


class AdminOrderOut(BaseModel):
    id: str
    user_id: str
    plan_code: str
    amount_cents: int
    channel: str
    status: str
    provider_order_id: str
    idempotency_key: str | None
    created_at: datetime
    paid_at: datetime | None
    refunded_at: datetime | None


class AdminOrderListResponse(ApiResponse):
    orders: list[AdminOrderOut]


class AdminTicketOut(BaseModel):
    id: str
    user_id: str
    case_id: str
    session_id: str | None
    task_type: str
    status: str
    priority: str
    title: str
    description: str
    assignee_ref: str
    due_at: datetime | None
    created_at: datetime


class AdminTicketListResponse(ApiResponse):
    tickets: list[AdminTicketOut]


class AdminEntitlementOut(BaseModel):
    id: int
    user_id: str
    entitlement_type: str
    delta: int
    balance_after: int
    reason: str
    source_type: str
    source_id: str
    idempotency_key: str
    metadata_json: str
    created_at: datetime


class AdminEntitlementListResponse(ApiResponse):
    entries: list[AdminEntitlementOut]
