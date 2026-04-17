from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_request_id
from app.db.session import get_db
from app.models.entities import User
from app.schemas.admin import AdminMetricsResponse
from app.services.metrics import collect_admin_metrics

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.get("/metrics", response_model=AdminMetricsResponse)
def admin_metrics(
    request: Request,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AdminMetricsResponse:
    metrics = collect_admin_metrics(db)
    return AdminMetricsResponse(request_id=get_request_id(request), metrics=metrics)

