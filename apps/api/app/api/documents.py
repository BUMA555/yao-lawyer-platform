from __future__ import annotations

import json
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_request_id
from app.db.session import get_db
from app.models.entities import ConsultCase, EntitlementLedger, GeneratedDocument, User
from app.schemas.documents import (
    DocumentListResponse,
    GenerateDocumentRequest,
    GenerateDocumentResponse,
    GeneratedDocumentPayload,
)
from app.services.documents import generate_document_draft
from app.services.entitlements import consume_chat_entitlement, entitlement_snapshot, has_chat_entitlement

router = APIRouter(prefix="/v1/documents", tags=["documents"])


def _document_payload(document: GeneratedDocument, user: User) -> GeneratedDocumentPayload:
    try:
        missing_fields = json.loads(document.missing_fields_json)
        warnings = json.loads(document.warnings_json)
    except json.JSONDecodeError:
        missing_fields = []
        warnings = []
    return GeneratedDocumentPayload(
        id=document.id,
        document_type=document.document_type,
        status=document.status,
        title=document.title,
        content=document.content,
        missing_fields=missing_fields if isinstance(missing_fields, list) else [],
        warnings=warnings if isinstance(warnings, list) else [],
        model=document.model,
        entitlement_remaining=entitlement_snapshot(user)["chat"],
        created_at=document.created_at,
    )


@router.post("/generate", response_model=GenerateDocumentResponse)
def generate_document(
    payload: GenerateDocumentRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GenerateDocumentResponse:
    if payload.case_id:
        case = db.scalar(select(ConsultCase).where(ConsultCase.id == payload.case_id).where(ConsultCase.user_id == user.id))
        if case is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    input_data = payload.model_dump(exclude={"idempotency_key"})
    fingerprint = sha256(json.dumps(input_data, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
    raw_key = (payload.idempotency_key or get_request_id(request)).strip() or get_request_id(request)
    idempotency_key = "document:" + sha256(raw_key.encode("utf-8")).hexdigest()
    existing_ledger = db.scalar(
        select(EntitlementLedger)
        .where(EntitlementLedger.user_id == user.id)
        .where(EntitlementLedger.idempotency_key == idempotency_key)
        .where(EntitlementLedger.source_type == "document")
    )
    if existing_ledger is not None and existing_ledger.source_id:
        metadata = json.loads(existing_ledger.metadata_json)
        if metadata.get("request_fingerprint") != fingerprint:
            raise HTTPException(status_code=409, detail="Idempotency key belongs to different document input")
        existing_document = db.scalar(
            select(GeneratedDocument)
            .where(GeneratedDocument.id == existing_ledger.source_id)
            .where(GeneratedDocument.user_id == user.id)
        )
        if existing_document is not None:
            return GenerateDocumentResponse(
                request_id=get_request_id(request),
                document=_document_payload(existing_document, user),
            )

    if not has_chat_entitlement(user):
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="No quota left; please purchase a plan")

    draft = generate_document_draft(payload.model_dump())
    document = GeneratedDocument(
        user_id=user.id,
        case_id=payload.case_id,
        document_type=payload.document_type,
        status="draft",
        title=str(draft["title"]),
        content=str(draft["content"]),
        missing_fields_json=json.dumps(draft["missing_fields"], ensure_ascii=False),
        warnings_json=json.dumps(draft["warnings"], ensure_ascii=False),
        model=str(draft["model"]),
        source_request_id=get_request_id(request),
    )
    db.add(document)
    db.flush()

    try:
        consume_chat_entitlement(
            db=db,
            user=user,
            idempotency_key=idempotency_key,
            reason="document.generate",
            source_type="document",
            source_id=document.id,
            metadata={"document_type": payload.document_type, "request_fingerprint": fingerprint},
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc)) from exc

    db.commit()
    db.refresh(document)
    return GenerateDocumentResponse(
        request_id=get_request_id(request),
        document=_document_payload(document, user),
    )


@router.get("", response_model=DocumentListResponse)
def list_documents(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentListResponse:
    documents = db.scalars(
        select(GeneratedDocument)
        .where(GeneratedDocument.user_id == user.id)
        .order_by(GeneratedDocument.created_at.desc())
        .limit(50)
    ).all()
    return DocumentListResponse(
        request_id=get_request_id(request),
        documents=[_document_payload(document, user) for document in documents],
    )
