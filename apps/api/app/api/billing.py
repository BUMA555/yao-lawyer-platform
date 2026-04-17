from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_request_id
from app.db.session import get_db
from app.models.entities import Order, Plan, User
from app.schemas.billing import (
    CreateOrderRequest,
    CreateOrderResponse,
    PaymentCallbackRequest,
    PlanListResponse,
    PlanOut,
    PrepayRequest,
    PrepayResponse,
    RefundRequest,
    RefundResponse,
)
from app.services.metrics import log_event
from app.services.payment import build_mock_prepay_payload, create_payment_attempt, mark_order_paid, mark_order_refunded

router = APIRouter(tags=["billing"])


@router.get("/v1/plans", response_model=PlanListResponse)
def get_plans(
    request: Request,
    db: Session = Depends(get_db),
) -> PlanListResponse:
    plans = db.scalars(select(Plan).where(Plan.enabled.is_(True)).order_by(Plan.price_cents.asc())).all()
    return PlanListResponse(
        request_id=get_request_id(request),
        plans=[
            PlanOut(
                code=p.code,
                name=p.name,
                description=p.description,
                price_cents=p.price_cents,
                currency=p.currency,
                chat_credits=p.chat_credits,
                membership_days=p.membership_days,
            )
            for p in plans
        ],
    )


@router.post("/v1/orders/create", response_model=CreateOrderResponse)
def create_order(
    payload: CreateOrderRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreateOrderResponse:
    plan = db.scalar(select(Plan).where(Plan.code == payload.plan_code).where(Plan.enabled.is_(True)))
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    order = Order(
        user_id=user.id,
        plan_code=plan.code,
        amount_cents=plan.price_cents,
        channel=payload.channel,
        status="created",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    log_event(
        db=db,
        request_id=get_request_id(request),
        user_id=user.id,
        event_type="order.create",
        meta={"order_id": order.id, "plan_code": plan.code, "channel": payload.channel},
    )
    return CreateOrderResponse(
        request_id=get_request_id(request),
        order_id=order.id,
        plan_code=order.plan_code,
        amount_cents=order.amount_cents,
        status=order.status,
        channel=order.channel,
    )


def _prepay(
    channel: str,
    payload: PrepayRequest,
    request: Request,
    user: User,
    db: Session,
) -> PrepayResponse:
    order = db.scalar(select(Order).where(Order.id == payload.order_id).where(Order.user_id == user.id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != "created":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order not payable")

    prepay_payload = build_mock_prepay_payload(channel=channel, order_id=order.id, amount_cents=order.amount_cents)
    create_payment_attempt(db=db, order=order, channel=channel, payload=prepay_payload)
    log_event(
        db=db,
        request_id=get_request_id(request),
        user_id=user.id,
        event_type=f"pay.{channel}.prepay",
        meta={"order_id": order.id},
    )
    return PrepayResponse(
        request_id=get_request_id(request),
        order_id=order.id,
        channel=channel,
        prepay_payload=prepay_payload,
    )


@router.post("/v1/pay/wechat/prepay", response_model=PrepayResponse)
def wechat_prepay(
    payload: PrepayRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PrepayResponse:
    return _prepay(channel="wechat", payload=payload, request=request, user=user, db=db)


@router.post("/v1/pay/douyin/prepay", response_model=PrepayResponse)
def douyin_prepay(
    payload: PrepayRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PrepayResponse:
    return _prepay(channel="douyin", payload=payload, request=request, user=user, db=db)


@router.post("/v1/pay/wechat/callback", response_model=RefundResponse)
def wechat_callback(
    payload: PaymentCallbackRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> RefundResponse:
    order = db.scalar(select(Order).where(Order.id == payload.order_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if payload.paid:
        mark_order_paid(db=db, order=order, provider_order_id=payload.provider_order_id)
    log_event(db=db, request_id=get_request_id(request), user_id=order.user_id, event_type="pay.wechat.callback", meta={"order_id": order.id})
    return RefundResponse(request_id=get_request_id(request), order_id=order.id, status=order.status)


@router.post("/v1/pay/douyin/callback", response_model=RefundResponse)
def douyin_callback(
    payload: PaymentCallbackRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> RefundResponse:
    order = db.scalar(select(Order).where(Order.id == payload.order_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if payload.paid:
        mark_order_paid(db=db, order=order, provider_order_id=payload.provider_order_id)
    log_event(db=db, request_id=get_request_id(request), user_id=order.user_id, event_type="pay.douyin.callback", meta={"order_id": order.id})
    return RefundResponse(request_id=get_request_id(request), order_id=order.id, status=order.status)


@router.post("/v1/orders/{order_id}/refund", response_model=RefundResponse)
def refund_order(
    order_id: str,
    payload: RefundRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RefundResponse:
    order = db.scalar(select(Order).where(Order.id == order_id).where(Order.user_id == user.id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != "paid":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only paid orders can be refunded")
    mark_order_refunded(db=db, order=order)
    log_event(
        db=db,
        request_id=get_request_id(request),
        user_id=user.id,
        event_type="order.refund",
        meta={"order_id": order.id, "reason": payload.reason, "at": datetime.now(UTC).replace(tzinfo=None).isoformat()},
    )
    return RefundResponse(request_id=get_request_id(request), order_id=order.id, status=order.status)
