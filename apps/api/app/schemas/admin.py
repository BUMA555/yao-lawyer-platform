from __future__ import annotations

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


class AdminMetricsResponse(ApiResponse):
    metrics: AdminMetrics

