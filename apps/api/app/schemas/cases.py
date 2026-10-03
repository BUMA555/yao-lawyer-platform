from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ApiResponse


class CaseCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    summary: str = Field(default="", max_length=4000)
    lane: str = Field(default="civil-commercial", max_length=40)
    priority: str = Field(default="normal", max_length=20)


class CaseUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    summary: str | None = Field(default=None, max_length=4000)
    lane: str | None = Field(default=None, max_length=40)
    status: str | None = Field(default=None, max_length=20)
    priority: str | None = Field(default=None, max_length=20)
    closed_at: datetime | None = None


class CaseOut(BaseModel):
    id: str
    user_id: str
    title: str
    summary: str
    lane: str
    status: str
    priority: str
    source: str
    linked_session_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None


class CaseDetailResponse(ApiResponse):
    case: CaseOut


class CaseListResponse(ApiResponse):
    cases: list[CaseOut]
