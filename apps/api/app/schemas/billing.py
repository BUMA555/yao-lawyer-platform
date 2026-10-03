from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ApiResponse


class PlanOut(BaseModel):
    code: str
    name: str
    description: str
    price_cents: int
    currency: str
    chat_credits: int
    membership_days: int


class PlanListResponse(ApiResponse):
    plans: list[PlanOut]


class CreateOrderRequest(BaseModel):
    plan_code: str = Field(min_length=2, max_length=40)
    channel: str = Field(default="wechat", pattern="^(wechat|douyin)$")
    idempotency_key: str | None = Field(default=None, max_length=160)


class CreateOrderResponse(ApiResponse):
    order_id: str
    plan_code: str
    amount_cents: int
    status: str
    channel: str
    idempotency_key: str | None = None


class OrderOut(BaseModel):
    id: str
    plan_code: str
    amount_cents: int
    channel: str
    status: str
    provider_order_id: str
    idempotency_key: str | None
    paid_at: datetime | None
    refunded_at: datetime | None
    created_at: datetime


class OrderListResponse(ApiResponse):
    orders: list[OrderOut]


class EntitlementBalance(BaseModel):
    entitlement_type: str
    balance: int
    free_balance: int
    paid_balance: int


class EntitlementResponse(ApiResponse):
    balances: list[EntitlementBalance]


class PrepayRequest(BaseModel):
    order_id: str
    open_id: str = Field(default="", max_length=120)
    client_ip: str = Field(default="", max_length=80)


class PrepayResponse(ApiResponse):
    order_id: str
    channel: str
    prepay_payload: dict


class PaymentCallbackRequest(BaseModel):
    order_id: str
    provider_order_id: str = Field(default="", max_length=80)
    paid: bool = True
    amount_cents: int = Field(ge=0)
    paid_at: datetime | None = None


class RefundRequest(BaseModel):
    reason: str = Field(default="user_request", max_length=200)


class RefundResponse(ApiResponse):
    order_id: str
    status: str
