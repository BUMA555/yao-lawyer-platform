from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_request_id, require_admin_token
from app.db.session import get_db
from app.models.entities import EntitlementLedger, Order, ServiceTask
from app.schemas.admin import (
    AdminEntitlementListResponse,
    AdminEntitlementOut,
    AdminMetricsResponse,
    AdminOrderListResponse,
    AdminOrderOut,
    AdminTicketListResponse,
    AdminTicketOut,
)
from app.services.metrics import collect_admin_metrics

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.get("/metrics", response_model=AdminMetricsResponse)
def admin_metrics(
    request: Request,
    _: str = Depends(require_admin_token),
    db: Session = Depends(get_db),
) -> AdminMetricsResponse:
    metrics = collect_admin_metrics(db)
    return AdminMetricsResponse(request_id=get_request_id(request), metrics=metrics)


@router.get("/orders", response_model=AdminOrderListResponse)
def admin_orders(
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
    _: str = Depends(require_admin_token),
    db: Session = Depends(get_db),
) -> AdminOrderListResponse:
    orders = db.scalars(select(Order).order_by(Order.created_at.desc()).limit(limit)).all()
    return AdminOrderListResponse(
        request_id=get_request_id(request),
        orders=[
            AdminOrderOut(
                id=order.id,
                user_id=order.user_id,
                plan_code=order.plan_code,
                amount_cents=order.amount_cents,
                channel=order.channel,
                status=order.status,
                provider_order_id=order.provider_order_id,
                idempotency_key=order.idempotency_key,
                created_at=order.created_at,
                paid_at=order.paid_at,
                refunded_at=order.refunded_at,
            )
            for order in orders
        ],
    )


@router.get("/tickets", response_model=AdminTicketListResponse)
def admin_tickets(
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
    _: str = Depends(require_admin_token),
    db: Session = Depends(get_db),
) -> AdminTicketListResponse:
    tasks = db.scalars(select(ServiceTask).order_by(ServiceTask.created_at.desc()).limit(limit)).all()
    return AdminTicketListResponse(
        request_id=get_request_id(request),
        tickets=[
            AdminTicketOut(
                id=task.id,
                user_id=task.user_id,
                case_id=task.case_id,
                session_id=task.session_id,
                task_type=task.task_type,
                status=task.status,
                priority=task.priority,
                title=task.title,
                description=task.description,
                assignee_ref=task.assignee_ref,
                due_at=task.due_at,
                created_at=task.created_at,
            )
            for task in tasks
        ],
    )


@router.get("/entitlements", response_model=AdminEntitlementListResponse)
def admin_entitlements(
    request: Request,
    limit: int = Query(default=200, ge=1, le=1000),
    _: str = Depends(require_admin_token),
    db: Session = Depends(get_db),
) -> AdminEntitlementListResponse:
    entries = db.scalars(
        select(EntitlementLedger).order_by(EntitlementLedger.created_at.desc()).limit(limit)
    ).all()
    return AdminEntitlementListResponse(
        request_id=get_request_id(request),
        entries=[
            AdminEntitlementOut(
                id=entry.id,
                user_id=entry.user_id,
                entitlement_type=entry.entitlement_type,
                delta=entry.delta,
                balance_after=entry.balance_after,
                reason=entry.reason,
                source_type=entry.source_type,
                source_id=entry.source_id,
                idempotency_key=entry.idempotency_key,
                metadata_json=entry.metadata_json,
                created_at=entry.created_at,
            )
            for entry in entries
        ],
    )
