from __future__ import annotations

from fastapi.testclient import TestClient


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

    escalate_resp = client.post(
        "/v1/chat/escalate-human",
        headers=auth_headers,
        json={"session_id": session_data["session_id"], "reason": "需要真人律师接管", "contact_mobile": "13800001111", "priority": "high"},
    )
    assert escalate_resp.status_code == 200
    escalate_data = escalate_resp.json()
    assert escalate_data["ticket_id"]
    assert escalate_data["status"] == "open"

