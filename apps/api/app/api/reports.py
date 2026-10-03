from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_request_id
from app.db.session import get_db
from app.models.entities import ConsultationReport, User
from app.schemas.reports import ReportListResponse, ReportOut, ReportResponse

router = APIRouter(prefix="/v1/reports", tags=["reports"])


def _to_report_out(report: ConsultationReport) -> ReportOut:
    try:
        payload = json.loads(report.payload_json)
    except json.JSONDecodeError:
        payload = {}
    return ReportOut(
        id=report.id,
        case_id=report.case_id,
        session_id=report.session_id,
        report_kind=report.report_kind,
        status=report.status,
        risk_level=report.risk_level,
        lane=report.lane,
        model=report.model,
        payload=payload if isinstance(payload, dict) else {},
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.get("", response_model=ReportListResponse)
def list_reports(
    request: Request,
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportListResponse:
    reports = db.scalars(
        select(ConsultationReport)
        .where(ConsultationReport.user_id == user.id)
        .order_by(ConsultationReport.updated_at.desc())
        .limit(limit)
    ).all()
    return ReportListResponse(
        request_id=get_request_id(request),
        reports=[_to_report_out(report) for report in reports],
    )


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportResponse:
    report = db.scalar(
        select(ConsultationReport)
        .where(ConsultationReport.id == report_id)
        .where(ConsultationReport.user_id == user.id)
    )
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return ReportResponse(request_id=get_request_id(request), report=_to_report_out(report))
