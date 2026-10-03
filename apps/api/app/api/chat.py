from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_request_id
from app.db.session import get_db
from app.models.entities import (
    CaseSessionLink,
    ChatMessage,
    ChatSession,
    ConsultationReport,
    ConsultCase,
    EntitlementLedger,
    EscalationTicket,
    ServiceTask,
    User,
)
from app.schemas.chat import (
    ChatRespondPayload,
    ChatRespondRequest,
    ChatRespondResponse,
    CreateSessionRequest,
    CreateSessionResponse,
    EscalateHumanRequest,
    EscalateHumanResponse,
)
from app.services.metrics import log_event
from app.services.orchestrator import YaoOrchestrator, detect_lane, detect_risk_level
from app.services.entitlements import consume_chat_entitlement, entitlement_snapshot, has_chat_entitlement

router = APIRouter(prefix="/v1/chat", tags=["chat"])
orchestrator = YaoOrchestrator()


def _get_owned_case(db: Session, user: User, case_id: str) -> ConsultCase:
    case = db.scalar(select(ConsultCase).where(ConsultCase.id == case_id).where(ConsultCase.user_id == user.id))
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return case


def _get_linked_case(db: Session, session_id: str, user_id: str) -> ConsultCase | None:
    return db.scalar(
        select(ConsultCase)
        .join(CaseSessionLink, CaseSessionLink.case_id == ConsultCase.id)
        .where(CaseSessionLink.session_id == session_id)
        .where(ConsultCase.user_id == user_id)
    )


def _get_or_create_linked_case(db: Session, session: ChatSession, user: User, title: str, summary: str, lane: str) -> ConsultCase:
    linked_case = _get_linked_case(db=db, session_id=session.id, user_id=user.id)
    if linked_case is not None:
        if title and not linked_case.title.strip():
            linked_case.title = title[:120]
        if summary and not linked_case.summary.strip():
            linked_case.summary = summary[:4000]
        if lane:
            linked_case.lane = lane
        db.add(linked_case)
        return linked_case

    linked_case = ConsultCase(
        user_id=user.id,
        title=(title or session.summary or "Case consultation")[:120],
        summary=(summary or session.summary)[:4000],
        lane=lane or session.lane,
        priority="high" if session.risk_level == "R1" else "normal",
        source="chat",
    )
    db.add(linked_case)
    db.flush()
    db.add(CaseSessionLink(case_id=linked_case.id, session_id=session.id))
    return linked_case


def _ensure_service_task(
    db: Session,
    *,
    user: User,
    case: ConsultCase,
    session: ChatSession,
    task_type: str,
    status_value: str,
    priority: str,
    title: str,
    description: str,
    payload: dict[str, object],
) -> ServiceTask:
    existing = db.scalar(
        select(ServiceTask)
        .where(ServiceTask.case_id == case.id)
        .where(ServiceTask.session_id == session.id)
        .where(ServiceTask.task_type == task_type)
        .where(ServiceTask.status.in_(("pending", "queued", "open", "processing")))
        .order_by(ServiceTask.created_at.desc())
    )
    if existing is not None:
        existing.status = status_value
        existing.priority = priority
        existing.title = title[:120]
        existing.description = description[:4000]
        existing.payload_json = json.dumps(payload, ensure_ascii=False)
        db.add(existing)
        return existing

    task = ServiceTask(
        user_id=user.id,
        case_id=case.id,
        session_id=session.id,
        task_type=task_type,
        status=status_value,
        priority=priority,
        title=title[:120],
        description=description[:4000],
        payload_json=json.dumps(payload, ensure_ascii=False),
    )
    db.add(task)
    db.flush()
    return task


def _persist_report(
    db: Session,
    *,
    user: User,
    case: ConsultCase | None,
    session: ChatSession,
    result: dict[str, object],
    request_id: str,
) -> ConsultationReport:
    report = db.scalar(
        select(ConsultationReport)
        .where(ConsultationReport.session_id == session.id)
        .where(ConsultationReport.report_kind == "triage")
    )
    payload_json = json.dumps(result, ensure_ascii=False)
    if report is None:
        report = ConsultationReport(
            user_id=user.id,
            case_id=case.id if case is not None else None,
            session_id=session.id,
            report_kind="triage",
            status=str(result["status"]),
            risk_level=str(result["risk_level"]),
            lane=str(result["lane"]),
            model=str(result["model"]),
            payload_json=payload_json,
            source_request_id=request_id,
        )
    else:
        report.case_id = case.id if case is not None else report.case_id
        report.status = str(result["status"])
        report.risk_level = str(result["risk_level"])
        report.lane = str(result["lane"])
        report.model = str(result["model"])
        report.payload_json = payload_json
        report.source_request_id = request_id
    db.add(report)
    db.flush()
    return report


def _response_from_result(
    *,
    request_id: str,
    result: dict[str, object],
    entitlement_remaining: int,
    report_id: str | None,
) -> ChatRespondResponse:
    return ChatRespondResponse(
        request_id=request_id,
        data=ChatRespondPayload(
            status=str(result["status"]),
            lane=str(result["lane"]),
            risk_level=str(result["risk_level"]),
            model=str(result["model"]),
            summary=str(result.get("summary", "")),
            judge_version=str(result["judge_version"]),
            client_version=str(result["client_version"]),
            team_version=str(result["team_version"]),
            known_facts=list(result.get("known_facts", [])),
            inferences=list(result.get("inferences", [])),
            to_verify=list(result.get("to_verify", [])),
            disputed_issues=list(result.get("disputed_issues", [])),
            evidence_gaps=list(result["evidence_gaps"]),
            next_actions=list(result["next_actions"]),
            not_recommended=list(result["not_recommended"]),
            urgent_flags=list(result.get("urgent_flags", [])),
            entitlement_remaining=entitlement_remaining,
            report_id=report_id,
            queued_ticket_id=result.get("queued_ticket_id"),
            eta_seconds=result.get("eta_seconds"),
        ),
    )


@router.post("/session", response_model=CreateSessionResponse)
def create_chat_session(
    payload: CreateSessionRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreateSessionResponse:
    lane = payload.lane or "civil-commercial"
    linked_case: ConsultCase | None = None
    if payload.case_id:
        linked_case = _get_owned_case(db=db, user=user, case_id=payload.case_id)

    session = ChatSession(user_id=user.id, lane=lane, risk_level="R2", summary=payload.summary)
    db.add(session)
    db.flush()

    if linked_case is not None:
        db.add(CaseSessionLink(case_id=linked_case.id, session_id=session.id))

    db.commit()
    db.refresh(session)
    return CreateSessionResponse(
        request_id=get_request_id(request),
        session_id=session.id,
        lane=session.lane,
        risk_level=session.risk_level,
    )


@router.post("/respond", response_model=ChatRespondResponse)
def chat_respond(
    payload: ChatRespondRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatRespondResponse:
    session = db.scalar(select(ChatSession).where(ChatSession.id == payload.session_id).where(ChatSession.user_id == user.id))
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    request_id = get_request_id(request)
    idempotency_key = (payload.idempotency_key or request_id).strip() or request_id
    existing_ledger = db.scalar(
        select(EntitlementLedger)
        .where(EntitlementLedger.user_id == user.id)
        .where(EntitlementLedger.idempotency_key == idempotency_key)
        .where(EntitlementLedger.source_type == "chat")
    )
    if existing_ledger is not None:
        if existing_ledger.source_id and existing_ledger.source_id != session.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Idempotency key belongs to another session")
        existing_report = db.scalar(
            select(ConsultationReport)
            .where(ConsultationReport.session_id == session.id)
            .where(ConsultationReport.report_kind == "triage")
        )
        if existing_report is not None:
            try:
                existing_result = json.loads(existing_report.payload_json)
            except json.JSONDecodeError:
                existing_result = {}
            if isinstance(existing_result, dict) and existing_result.get("status"):
                return _response_from_result(
                    request_id=request_id,
                    result=existing_result,
                    entitlement_remaining=entitlement_snapshot(user)["chat"],
                    report_id=existing_report.id,
                )

    if not has_chat_entitlement(user):
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="No chat quota left")

    lane = detect_lane(payload.user_message)
    risk_level = detect_risk_level(payload.user_message)
    session.lane = lane
    session.risk_level = risk_level
    db.add(session)

    db.add(
        ChatMessage(
            session_id=session.id,
            role="user",
            content=payload.user_message,
            model="",
            request_id=request_id,
        )
    )

    result = orchestrator.respond(user_message=payload.user_message, output_mode=payload.output_mode)
    service_task: ServiceTask | None = None

    if result["status"] == "ok":
        try:
            consume_chat_entitlement(
                db=db,
                user=user,
                idempotency_key=idempotency_key,
                source_type="chat",
                source_id=session.id,
                metadata={"lane": lane, "risk_level": risk_level},
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc)) from exc
        session.status = "active"
        db.add(user)
    else:
        session.status = "queued"
        linked_case = _get_or_create_linked_case(
            db=db,
            session=session,
            user=user,
            title=session.summary or payload.user_message[:40],
            summary=payload.user_message,
            lane=lane,
        )
        service_task = _ensure_service_task(
            db=db,
            user=user,
            case=linked_case,
            session=session,
            task_type="human_review",
            status_value="queued",
            priority="high" if risk_level == "R1" else "normal",
            title="High-risk review",
            description=(payload.user_message[:400] or session.summary)[:4000],
            payload={
                "source": "chat.respond",
                "lane": lane,
                "risk_level": risk_level,
                "eta_seconds": result.get("eta_seconds"),
            },
        )
        result["queued_ticket_id"] = service_task.id

    linked_case = _get_linked_case(db=db, session_id=session.id, user_id=user.id)
    if linked_case is None:
        linked_case = _get_or_create_linked_case(
            db=db,
            session=session,
            user=user,
            title=session.summary or payload.user_message[:40],
            summary=payload.user_message,
            lane=lane,
        )
    report = _persist_report(
        db=db,
        user=user,
        case=linked_case,
        session=session,
        result=result,
        request_id=request_id,
    )

    assistant_text = (
        f"当前判断：{result.get('summary', '')}\n"
        f"法官版：{result['judge_version']}\n"
        f"客户版：{result['client_version']}\n"
        f"团队版：{result['team_version']}\n"
        f"下一步：{'；'.join(result['next_actions'])}"
    )
    db.add(
        ChatMessage(
            session_id=session.id,
            role="assistant",
            content=assistant_text,
            model=result["model"],
            token_input=0,
            token_output=0,
            cost_micros=0,
            request_id=request_id,
        )
    )
    db.commit()

    log_event(
        db=db,
        request_id=request_id,
        user_id=user.id,
        event_type="chat.respond",
        meta={"lane": lane, "risk_level": risk_level, "status": result["status"]},
    )
    return _response_from_result(
        request_id=request_id,
        result=result,
        entitlement_remaining=entitlement_snapshot(user)["chat"],
        report_id=report.id,
    )


@router.post("/escalate-human", response_model=EscalateHumanResponse)
def escalate_human(
    payload: EscalateHumanRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EscalateHumanResponse:
    session = db.scalar(select(ChatSession).where(ChatSession.id == payload.session_id).where(ChatSession.user_id == user.id))
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    linked_case = _get_or_create_linked_case(
        db=db,
        session=session,
        user=user,
        title=session.summary or "Manual review case",
        summary=payload.reason,
        lane=session.lane,
    )

    ticket = EscalationTicket(
        user_id=user.id,
        session_id=session.id,
        reason=payload.reason,
        priority=payload.priority,
        contact_mobile=payload.contact_mobile,
        status="open",
    )
    db.add(ticket)
    db.flush()

    _ensure_service_task(
        db=db,
        user=user,
        case=linked_case,
        session=session,
        task_type="human_review",
        status_value="open",
        priority=payload.priority,
        title="Manual review",
        description=payload.reason,
        payload={
            "source": "chat.escalate",
            "ticket_id": ticket.id,
            "contact_mobile": payload.contact_mobile,
        },
    )

    db.commit()
    db.refresh(ticket)

    log_event(
        db=db,
        request_id=get_request_id(request),
        user_id=user.id,
        event_type="chat.escalate",
        meta={"ticket_id": ticket.id, "priority": payload.priority},
    )
    return EscalateHumanResponse(request_id=get_request_id(request), ticket_id=ticket.id, status=ticket.status)
