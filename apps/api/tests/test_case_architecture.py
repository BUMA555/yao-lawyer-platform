from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.entities import ServiceTask


def test_auth_me_snapshot(client: TestClient, auth_headers: dict[str, str], auth_user: dict) -> None:
    me_resp = client.get("/v1/auth/me", headers=auth_headers)
    assert me_resp.status_code == 200
    me_data = me_resp.json()["user"]

    assert me_data["id"] == auth_user["user"]["id"]
    assert me_data["mobile"] == auth_user["user"]["mobile"]
    assert me_data["invite_code"] == auth_user["user"]["invite_code"]
    assert "created_at" in me_data
    assert "updated_at" in me_data


def test_case_crud_happy_path(client: TestClient, auth_headers: dict[str, str]) -> None:
    create_resp = client.post(
        "/v1/cases",
        headers=auth_headers,
        json={"title": "合同欠款纠纷", "summary": "对方拖欠货款", "lane": "civil-commercial", "priority": "high"},
    )
    assert create_resp.status_code == 200
    create_data = create_resp.json()["case"]
    case_id = create_data["id"]
    assert create_data["title"] == "合同欠款纠纷"
    assert create_data["status"] == "open"

    update_resp = client.patch(
        f"/v1/cases/{case_id}",
        headers=auth_headers,
        json={"summary": "已发律师函，等待回款", "status": "in_progress"},
    )
    assert update_resp.status_code == 200
    update_data = update_resp.json()["case"]
    assert update_data["summary"] == "已发律师函，等待回款"
    assert update_data["status"] == "in_progress"

    list_resp = client.get("/v1/cases", headers=auth_headers)
    assert list_resp.status_code == 200
    list_data = list_resp.json()["cases"]
    assert any(case["id"] == case_id for case in list_data)

    detail_resp = client.get(f"/v1/cases/{case_id}", headers=auth_headers)
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()["case"]
    assert detail_data["id"] == case_id

    session_resp = client.post(
        "/v1/chat/session",
        headers=auth_headers,
        json={"lane": "civil-commercial", "summary": "关联到案件", "case_id": case_id},
    )
    assert session_resp.status_code == 200
    session_id = session_resp.json()["session_id"]

    detail_after_bind_resp = client.get(f"/v1/cases/{case_id}", headers=auth_headers)
    assert detail_after_bind_resp.status_code == 200
    linked_session_ids = detail_after_bind_resp.json()["case"]["linked_session_ids"]
    assert session_id in linked_session_ids


def test_queued_response_persists_service_task(client: TestClient, auth_headers: dict[str, str]) -> None:
    create_resp = client.post(
        "/v1/cases",
        headers=auth_headers,
        json={"title": "高风险核验案件", "summary": "疑似诈骗", "lane": "fraud-boundary", "priority": "high"},
    )
    assert create_resp.status_code == 200
    case_id = create_resp.json()["case"]["id"]

    session_resp = client.post(
        "/v1/chat/session",
        headers=auth_headers,
        json={"lane": "fraud-boundary", "summary": "需要高风险核验", "case_id": case_id},
    )
    assert session_resp.status_code == 200
    session_id = session_resp.json()["session_id"]

    queued_resp = client.post(
        "/v1/chat/respond",
        headers=auth_headers,
        json={"session_id": session_id, "user_message": "对方涉嫌诈骗，还在转移资产", "output_mode": "standard"},
    )
    assert queued_resp.status_code == 200
    payload = queued_resp.json()["data"]
    assert payload["status"] == "queued"
    assert payload["queued_ticket_id"]

    with SessionLocal() as db:
        task = db.scalar(select(ServiceTask).where(ServiceTask.id == payload["queued_ticket_id"]))
        assert task is not None
        assert task.case_id == case_id
        assert task.session_id == session_id
        assert task.status == "queued"

    reports = client.get("/v1/reports", headers=auth_headers)
    assert reports.status_code == 200
    assert reports.json()["reports"]
    assert reports.json()["reports"][0]["case_id"] == case_id

    report_id = reports.json()["reports"][0]["id"]
    report = client.get(f"/v1/reports/{report_id}", headers=auth_headers)
    assert report.status_code == 200
    assert report.json()["report"]["id"] == report_id
