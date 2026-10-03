from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.entities import ConsultationReport, EntitlementLedger


def test_auth_chat_and_escalation(client: TestClient, auth_headers: dict[str, str]) -> None:
    session_resp = client.post("/v1/chat/session", headers=auth_headers, json={"lane": "civil-commercial", "summary": "合同争议"})
    assert session_resp.status_code == 200
    session_data = session_resp.json()
    assert session_data["session_id"]
    assert session_data["request_id"]

    chat_resp = client.post(
        "/v1/chat/respond",
        headers=auth_headers,
        json={"session_id": session_data["session_id"], "user_message": "对方欠货款不还，怎么保全？", "output_mode": "standard"},
    )
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()["data"]
    assert chat_data["lane"] in {"civil-commercial", "company-control", "labor", "fraud-boundary"}
    assert isinstance(chat_data["next_actions"], list)
    assert len(chat_data["next_actions"]) >= 1
    assert chat_data["summary"]
    assert isinstance(chat_data["known_facts"], list)
    assert isinstance(chat_data["evidence_gaps"], list)
    assert chat_data["report_id"]
    assert chat_data["entitlement_remaining"] >= 0

    escalate_resp = client.post(
        "/v1/chat/escalate-human",
        headers=auth_headers,
        json={"session_id": session_data["session_id"], "reason": "需要真人律师接管", "contact_mobile": "13800001111", "priority": "high"},
    )
    assert escalate_resp.status_code == 200
    escalate_data = escalate_resp.json()
    assert escalate_data["ticket_id"]
    assert escalate_data["status"] == "open"


def test_chat_idempotency_does_not_double_consume(client: TestClient, auth_headers: dict[str, str]) -> None:
    session_resp = client.post(
        "/v1/chat/session",
        headers=auth_headers,
        json={"lane": "civil-commercial", "summary": "幂等咨询"},
    )
    session_id = session_resp.json()["session_id"]
    body = {
        "session_id": session_id,
        "user_message": "合同尾款一直没有支付，先看证据和保全路径。",
        "output_mode": "standard",
        "idempotency_key": "chat-test-idempotency-1",
    }

    first = client.post("/v1/chat/respond", headers=auth_headers, json=body)
    second = client.post("/v1/chat/respond", headers=auth_headers, json=body)
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["data"]["entitlement_remaining"] == first.json()["data"]["entitlement_remaining"]

    with SessionLocal() as db:
        ledgers = db.scalars(
            select(EntitlementLedger)
            .where(EntitlementLedger.idempotency_key == "chat-test-idempotency-1")
        ).all()
        reports = db.scalars(select(ConsultationReport).where(ConsultationReport.session_id == session_id)).all()
        assert len(ledgers) == 1
        assert len(reports) == 1
