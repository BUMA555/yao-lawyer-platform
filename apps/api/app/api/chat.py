from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_request_id
from app.db.session import get_db
from app.models.entities import ChatMessage, ChatSession, EscalationTicket, User
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

router = APIRouter(prefix="/v1/chat", tags=["chat"])
orchestrator = YaoOrchestrator()


@router.post("/session", response_model=CreateSessionResponse)
def create_chat_session(
    payload: CreateSessionRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreateSessionResponse:
    lane = payload.lane or "civil-commercial"
    risk_level = "R2"
    session = ChatSession(user_id=user.id, lane=lane, risk_level=risk_level, summary=payload.summary)
    db.add(session)
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
            request_id=get_request_id(request),
        )
    )

    result = orchestrator.respond(user_message=payload.user_message, output_mode=payload.output_mode)

    if result["status"] == "ok":
        if user.paid_chat_credits > 0:
            user.paid_chat_credits -= 1
        elif user.free_chat_quota > 0:
            user.free_chat_quota -= 1
        else:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="No chat quota left")
        db.add(user)

    assistant_text = (
        f"法官版：{result['judge_version']}\n"
        f"客户版：{result['client_version']}\n"
        f"团队版：{result['team_version']}\n"
        f"下一步：{'; '.join(result['next_actions'])}"
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
            request_id=get_request_id(request),
        )
    )
    db.commit()

    resp_payload = ChatRespondPayload(
        status=result["status"],
        lane=result["lane"],
        risk_level=result["risk_level"],
        model=result["model"],
        judge_version=result["judge_version"],
        client_version=result["client_version"],
        team_version=result["team_version"],
        next_actions=result["next_actions"],
        not_recommended=result["not_recommended"],
        queued_ticket_id=result.get("queued_ticket_id"),
        eta_seconds=result.get("eta_seconds"),
    )
    log_event(
        db=db,
        request_id=get_request_id(request),
        user_id=user.id,
        event_type="chat.respond",
        meta={"lane": lane, "risk_level": risk_level, "status": result["status"]},
    )
    return ChatRespondResponse(request_id=get_request_id(request), data=resp_payload)


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

    ticket = EscalationTicket(
        user_id=user.id,
        session_id=session.id,
        reason=payload.reason,
        priority=payload.priority,
        contact_mobile=payload.contact_mobile,
        status="open",
    )
    db.add(ticket)
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

