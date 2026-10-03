from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ApiResponse


DocumentType = Literal[
    "civil_complaint",
    "execution_application",
    "civil_answer",
    "civil_appeal",
    "labor_arbitration",
    "evidence_catalog",
]


class GenerateDocumentRequest(BaseModel):
    document_type: DocumentType
    case_id: str | None = Field(default=None, max_length=36)
    title: str = Field(default="", max_length=160)
    parties: str = Field(default="", max_length=3000)
    court: str = Field(default="", max_length=200)
    amount: str = Field(default="", max_length=120)
    facts: str = Field(min_length=12, max_length=10000)
    evidence: str = Field(default="", max_length=6000)
    claims: str = Field(default="", max_length=4000)
    idempotency_key: str | None = Field(default=None, max_length=160)


class GeneratedDocumentPayload(BaseModel):
    id: str
    document_type: str
    status: str
    title: str
    content: str
    missing_fields: list[str]
    warnings: list[str]
    model: str
    entitlement_remaining: int
    created_at: datetime


class GenerateDocumentResponse(ApiResponse):
    document: GeneratedDocumentPayload


class DocumentListResponse(ApiResponse):
    documents: list[GeneratedDocumentPayload]
