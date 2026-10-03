from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ApiResponse


class ReportOut(BaseModel):
    id: str
    case_id: str | None
    session_id: str
    report_kind: str
    status: str
    risk_level: str
    lane: str
    model: str
    payload: dict
    created_at: datetime
    updated_at: datetime


class ReportListResponse(ApiResponse):
    reports: list[ReportOut]


class ReportResponse(ApiResponse):
    report: ReportOut
