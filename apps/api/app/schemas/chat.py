from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import ApiResponse


class CreateSessionRequest(BaseModel):
    lane: str = Field(default="civil-commercial", max_length=40)
    summary: str = Field(default="", max_length=2000)


class CreateSessionResponse(ApiResponse):
    session_id: str
    lane: str
    risk_level: str


class ChatRespondRequest(BaseModel):
    session_id: str
    user_message: str = Field(min_length=1, max_length=8000)
    output_mode: str = Field(default="standard", max_length=20)


class ChatRespondPayload(BaseModel):
    status: str
    lane: str
    risk_level: str
    model: str
    judge_version: str
    client_version: str
    team_version: str
    next_actions: list[str]
    not_recommended: list[str]
    queued_ticket_id: str | None = None
    eta_seconds: int | None = None


class ChatRespondResponse(ApiResponse):
    data: ChatRespondPayload


class EscalateHumanRequest(BaseModel):
    session_id: str
    reason: str = Field(min_length=1, max_length=4000)
    contact_mobile: str = Field(min_length=6, max_length=20)
    priority: str = Field(default="normal", max_length=20)


class EscalateHumanResponse(ApiResponse):
    ticket_id: str
    status: str

