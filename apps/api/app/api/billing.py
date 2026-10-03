from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_request_id, require_admin_token
from app.core.config import settings
from app.core.security import verify_payment_callback_signature
from app.db.session import get_db
from app.models.entities import Order, Plan, User
from app.schemas.billing import (
    CreateOrderRequest,
    CreateOrderResponse,
    EntitlementBalance,
    EntitlementResponse,
    OrderListResponse,
    OrderOut,
    PaymentCallbackRequest,
    PlanListResponse,
    PlanOut,
    PrepayRequest,
    PrepayResponse,
    RefundRequest,
    RefundResponse,
)
from app.services.metrics import log_event
from app.services.payment import (
    apply_wechat_transaction,
    build_mock_prepay_payload,
    build_wechat_prepay_payload,
    create_payment_attempt,
    decode_wechat_notification,
    mark_order_paid,
    mark_order_refunded,
    mock_payments_allowed,
    order_id_from_trade_no,
    reconcile_wechat_order,
)
from app.services.entitlements import entitlement_snapshot

router = APIRouter(tags=["billing"])


def _order_out(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        plan_code=order.plan_code,
        amount_cents=order.amount_cents,
        channel=order.channel,
        status=order.status,
        provider_order_id=order.provider_order_id,
        idempotency_key=order.idempotency_key,
        paid_at=order.paid_at,
        refunded_at=order.refunded_at,
        created_at=order.created_at,
    )


def _validate_callback(
    *,
    channel: str,
    payload: PaymentCallbackRequest,
    signature: str | None,
) -> None:
    if not signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing callback signature")

    secret = (
        settings.payment_callback_wechat_secret
        if channel == "wechat"
        else settings.payment_callback_douyin_secret
    )
    verify_payment_callback_signature(
        secret=secret,
        channel=channel,
        order_id=payload.order_id,
        provider_order_id=payload.provider_order_id,
        paid=payload.paid,
        amount_cents=payload.amount_cents,
        signature=signature,
    )


def _process_callback(
    *,
    channel: str,
    payload: PaymentCallbackRequest,
    request: Request,
    signature: str | None,
    db: Session,
) -> RefundResponse:
    _validate_callback(channel=channel, payload=payload, signature=signature)
    order = db.scalar(select(Order).where(Order.id == payload.order_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.channel != channel:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order channel mismatch")
    if payload.amount_cents != order.amount_cents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Callback amount mismatch")
    if payload.paid:
        try:
            mark_order_paid(db=db, order=order, provider_order_id=payload.provider_order_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    log_event(
        db=db,
        request_id=get_request_id(request),
        user_id=order.user_id,
        event_type=f"pay.{channel}.callback",
        meta={"order_id": order.id},
    )
    return RefundResponse(request_id=get_request_id(request), order_id=order.id, status=order.status)


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

    if payload.idempotency_key:
        existing = db.scalar(
            select(Order)
            .where(Order.user_id == user.id)
            .where(Order.idempotency_key == payload.idempotency_key)
        )
        if existing is not None:
            if existing.plan_code != plan.code or existing.channel != payload.channel:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Idempotency key is already used for another order",
                )
            return CreateOrderResponse(
                request_id=get_request_id(request),
                order_id=existing.id,
                plan_code=existing.plan_code,
                amount_cents=existing.amount_cents,
                status=existing.status,
                channel=existing.channel,
                idempotency_key=existing.idempotency_key,
            )

    order = Order(
        user_id=user.id,
        plan_code=plan.code,
        amount_cents=plan.price_cents,
        channel=payload.channel,
        idempotency_key=payload.idempotency_key,
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
        idempotency_key=order.idempotency_key,
    )


@router.get("/v1/orders", response_model=OrderListResponse)
def list_orders(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderListResponse:
    orders = db.scalars(
        select(Order)
        .where(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
        .limit(100)
    ).all()
    return OrderListResponse(
        request_id=get_request_id(request),
        orders=[_order_out(order) for order in orders],
    )


@router.get("/v1/entitlements", response_model=EntitlementResponse)
def get_entitlements(
    request: Request,
    user: User = Depends(get_current_user),
) -> EntitlementResponse:
    snapshot = entitlement_snapshot(user)
    return EntitlementResponse(
        request_id=get_request_id(request),
        balances=[
            EntitlementBalance(
                entitlement_type="chat",
                balance=snapshot["chat"],
                free_balance=snapshot["free_chat"],
                paid_balance=snapshot["paid_chat"],
            ),
            EntitlementBalance(
                entitlement_type="report",
                balance=snapshot["report"],
                free_balance=snapshot["report"],
                paid_balance=0,
            ),
        ],
    )


@router.post("/v1/orders/{order_id}/reconcile", response_model=RefundResponse)
def reconcile_order(
    order_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RefundResponse:
    order = db.scalar(select(Order).where(Order.id == order_id, Order.user_id == user.id))
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.channel != "wechat":
        raise HTTPException(status_code=400, detail="Order channel mismatch")
    if order.status == "created":
        reconcile_wechat_order(db, order)
    return RefundResponse(request_id=get_request_id(request), order_id=order.id, status=order.status)


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

    if order.channel != channel:
        raise HTTPException(status_code=400, detail="Order channel mismatch")
    if channel == "wechat":
        if mock_payments_allowed() and not settings.wechat_pay_enabled:
            prepay_payload = build_mock_prepay_payload(
                channel=channel,
                order_id=order.id,
                amount_cents=order.amount_cents,
            )
        else:
            prepay_payload = build_wechat_prepay_payload(
                order=order,
                user=user,
                description=f"姚律师-{order.plan_code}",
            )
    else:
        if not mock_payments_allowed():
            raise HTTPException(status_code=503, detail="Douyin payment is not configured")
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
    x_callback_signature: str | None = Header(default=None, alias="X-Callback-Signature"),
    db: Session = Depends(get_db),
) -> RefundResponse:
    if not mock_payments_allowed() or settings.wechat_pay_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test payment callback is disabled")
    return _process_callback(
        channel="wechat",
        payload=payload,
        request=request,
        signature=x_callback_signature,
        db=db,
    )


@router.post("/v1/pay/wechat/notify")
async def wechat_notify(
    request: Request,
    db: Session = Depends(get_db),
):
    body = await request.body()
    return await run_in_threadpool(_process_wechat_notify, dict(request.headers), body, db)


def _process_wechat_notify(headers: dict, body: bytes, db: Session):
    transaction = decode_wechat_notification(headers, body)
    out_trade_no = str(transaction.get("out_trade_no") or "")
    order_id = order_id_from_trade_no(out_trade_no)
    order = db.scalar(select(Order).where(Order.id == order_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    apply_wechat_transaction(db, order, transaction)
    return JSONResponse(content={"code": "SUCCESS", "message": "成功"})


@router.post("/v1/pay/douyin/callback", response_model=RefundResponse)
def douyin_callback(
    payload: PaymentCallbackRequest,
    request: Request,
    x_callback_signature: str | None = Header(default=None, alias="X-Callback-Signature"),
    db: Session = Depends(get_db),
) -> RefundResponse:
    if not mock_payments_allowed():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test payment callback is disabled")
    return _process_callback(
        channel="douyin",
        payload=payload,
        request=request,
        signature=x_callback_signature,
        db=db,
    )


@router.post("/v1/orders/{order_id}/refund", response_model=RefundResponse)
def refund_order(
    order_id: str,
    payload: RefundRequest,
    request: Request,
    admin_token: str = Depends(require_admin_token),
    db: Session = Depends(get_db),
) -> RefundResponse:
    order = db.scalar(select(Order).where(Order.id == order_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != "paid":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only paid orders can be refunded")
    if settings.wechat_pay_enabled or not settings.is_dev:
        raise HTTPException(status_code=503, detail="Live refunds require merchant processing; no money was refunded")
    try:
        mark_order_refunded(db=db, order=order)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    log_event(
        db=db,
        request_id=get_request_id(request),
        user_id=order.user_id,
        event_type="order.refund",
        meta={
            "order_id": order.id,
            "reason": payload.reason,
            "at": datetime.now(UTC).replace(tzinfo=None).isoformat(),
            "admin_token_present": bool(admin_token),
        },
    )
    return RefundResponse(request_id=get_request_id(request), order_id=order.id, status=order.status)
