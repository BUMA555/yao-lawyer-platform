from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_request_id
from app.db.session import get_db
from app.models.entities import CaseSessionLink, ConsultCase, User, now_utc
from app.schemas.cases import CaseCreateRequest, CaseDetailResponse, CaseListResponse, CaseOut, CaseUpdateRequest

router = APIRouter(tags=["cases"])


def _build_case_out(db: Session, case: ConsultCase) -> CaseOut:
    linked_session_ids = db.scalars(
        select(CaseSessionLink.session_id).where(CaseSessionLink.case_id == case.id).order_by(CaseSessionLink.id.asc())
    ).all()
    return CaseOut(
        id=case.id,
        user_id=case.user_id,
        title=case.title,
        summary=case.summary,
        lane=case.lane,
        status=case.status,
        priority=case.priority,
        source=case.source,
        linked_session_ids=list(linked_session_ids),
        created_at=case.created_at,
        updated_at=case.updated_at,
        closed_at=case.closed_at,
    )


def _get_owned_case(db: Session, user: User, case_id: str) -> ConsultCase:
    case = db.scalar(select(ConsultCase).where(ConsultCase.id == case_id).where(ConsultCase.user_id == user.id))
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return case


@router.post("/v1/cases", response_model=CaseDetailResponse)
def create_case(
    payload: CaseCreateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CaseDetailResponse:
    case = ConsultCase(
        user_id=user.id,
        title=payload.title.strip(),
        summary=payload.summary.strip(),
        lane=payload.lane,
        priority=payload.priority,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return CaseDetailResponse(request_id=get_request_id(request), case=_build_case_out(db=db, case=case))


@router.patch("/v1/cases/{case_id}", response_model=CaseDetailResponse)
def update_case(
    case_id: str,
    payload: CaseUpdateRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CaseDetailResponse:
    case = _get_owned_case(db=db, user=user, case_id=case_id)

    if payload.title is not None:
        case.title = payload.title.strip()
    if payload.summary is not None:
        case.summary = payload.summary.strip()
    if payload.lane is not None:
        case.lane = payload.lane
    if payload.priority is not None:
        case.priority = payload.priority
    if payload.status is not None:
        case.status = payload.status
        if payload.status == "closed" and payload.closed_at is None and case.closed_at is None:
            case.closed_at = now_utc()
        if payload.status != "closed" and payload.closed_at is None:
            case.closed_at = None
    if payload.closed_at is not None:
        case.closed_at = payload.closed_at

    db.add(case)
    db.commit()
    db.refresh(case)
    return CaseDetailResponse(request_id=get_request_id(request), case=_build_case_out(db=db, case=case))


@router.get("/v1/cases", response_model=CaseListResponse)
def list_my_cases(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CaseListResponse:
    cases = db.scalars(select(ConsultCase).where(ConsultCase.user_id == user.id).order_by(ConsultCase.updated_at.desc())).all()
    return CaseListResponse(request_id=get_request_id(request), cases=[_build_case_out(db=db, case=case) for case in cases])


@router.get("/v1/cases/{case_id}", response_model=CaseDetailResponse)
def get_case_detail(
    case_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CaseDetailResponse:
    case = _get_owned_case(db=db, user=user, case_id=case_id)
    return CaseDetailResponse(request_id=get_request_id(request), case=_build_case_out(db=db, case=case))
