from __future__ import annotations

import json
import time
from copy import deepcopy

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api import auth, documents
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import EntitlementLedger, GeneratedDocument, Order, User
from app.services import payment
from app.services.documents import _template_document_draft


def _exchange_response(payload: object) -> httpx.Response:
    return httpx.Response(
        200,
        json=payload,
        request=httpx.Request("GET", "https://api.weixin.qq.com/sns/jscode2session"),
    )


def test_wechat_login_requires_server_credentials(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "wechat_app_secret", "")
    response = client.post("/v1/auth/wechat/login", json={"code": "test-code"})
    assert response.status_code == 503
    assert "token" not in response.json()


def test_wechat_login_reuses_account_and_never_exposes_session_key(
    client: TestClient, monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", "wx-login-test")
    monkeypatch.setattr(settings, "wechat_app_secret", "server-secret-test")
    calls = []

    def exchange(url, **kwargs):
        calls.append((url, kwargs["params"]))
        return _exchange_response({
            "openid": "openid-login-test",
            "unionid": "unionid-login-test",
            "session_key": "private-session-key",
        })

    monkeypatch.setattr(auth.httpx, "get", exchange)
    first = client.post("/v1/auth/wechat/login", json={"code": "first-code", "nickname": "tester"})
    second = client.post("/v1/auth/wechat/login", json={"code": "second-code"})
    assert first.status_code == second.status_code == 200
    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert first.json()["user"]["mobile"] == ""
    assert first.json()["user"]["login_provider"] == "wechat"
    assert "session_key" not in first.text
    assert "private-session-key" not in first.text
    assert "server-secret-test" not in first.text
    assert calls[0][1]["appid"] == "wx-login-test"
    assert calls[0][1]["grant_type"] == "authorization_code"

    headers = {"Authorization": f"Bearer {first.json()['token']}"}
    snapshot = client.get("/v1/auth/me", headers=headers)
    assert snapshot.status_code == 200
    assert snapshot.json()["user"]["mobile"] == ""


@pytest.mark.parametrize(
    ("payload", "expected_status"),
    [({"errcode": 40029, "errmsg": "invalid code"}, 401), ({}, 401), ([], 502)],
)
def test_wechat_login_rejects_invalid_provider_responses(
    client: TestClient, monkeypatch, payload, expected_status: int,
) -> None:
    monkeypatch.setattr(settings, "wechat_app_id", "wx-login-test")
    monkeypatch.setattr(settings, "wechat_app_secret", "server-secret-test")
    monkeypatch.setattr(auth.httpx, "get", lambda *args, **kwargs: _exchange_response(payload))
    response = client.post("/v1/auth/wechat/login", json={"code": "invalid-code"})
    assert response.status_code == expected_status
    assert "token" not in response.json()


@pytest.fixture()
def wechat_order(client: TestClient, login_user, monkeypatch):
    login = login_user(client, "13800260001", "wechat-payment-test")
    headers = {"Authorization": f"Bearer {login['token']}"}
    monkeypatch.setattr(settings, "wechat_app_id", "wx-payment-test")
    monkeypatch.setattr(settings, "wechat_pay_mch_id", "merchant-test")
    with SessionLocal() as db:
        user = db.get(User, login["user"]["id"])
        user.wechat_openid = "openid-payment-test"
        db.commit()
    plan = client.get("/v1/plans").json()["plans"][0]
    response = client.post(
        "/v1/orders/create",
        headers=headers,
        json={"plan_code": plan["code"], "channel": "wechat"},
    )
    assert response.status_code == 200
    order_id = response.json()["order_id"]
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        transaction = {
            "appid": settings.wechat_app_id,
            "mchid": settings.wechat_pay_mch_id,
            "out_trade_no": payment.wechat_trade_no(order),
            "amount": {"total": order.amount_cents, "currency": "CNY"},
            "payer": {"openid": "openid-payment-test"},
            "trade_state": "SUCCESS",
            "transaction_id": "wx-transaction-" + order_id,
        }
    return order_id, headers, transaction, plan


@pytest.mark.parametrize(
    ("field", "bad_value"),
    [
        ("appid", "other-app"),
        ("mchid", "other-merchant"),
        ("out_trade_no", "0" * 32),
        ("amount", {"total": 1, "currency": "CNY"}),
        ("amount", {"total": True, "currency": "CNY"}),
        ("amount", {"total": 999999, "currency": "USD"}),
        ("payer", {"openid": "someone-else"}),
        ("trade_state", "NOTPAY"),
        ("transaction_id", ""),
    ],
)
def test_wechat_transaction_mismatch_never_grants_credits(
    wechat_order, field: str, bad_value,
) -> None:
    order_id, _, transaction, _ = wechat_order
    transaction = deepcopy(transaction)
    transaction[field] = bad_value
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        before = db.get(User, order.user_id).paid_chat_credits
        with pytest.raises(HTTPException):
            payment.apply_wechat_transaction(db, order, transaction)
        db.refresh(order)
        assert order.status == "created"
        assert db.get(User, order.user_id).paid_chat_credits == before


def test_wechat_reconcile_is_owned_and_idempotent(
    client: TestClient, login_user, wechat_order, monkeypatch,
) -> None:
    order_id, headers, transaction, plan = wechat_order

    class Provider:
        def query(self, **kwargs):
            assert kwargs["out_trade_no"] == transaction["out_trade_no"]
            return 200, json.dumps(transaction)

    monkeypatch.setattr(payment, "_wechat_pay_client", lambda: Provider())
    other = login_user(client, "13800260002", "other-order-owner")
    other_headers = {"Authorization": f"Bearer {other['token']}"}
    denied = client.post(f"/v1/orders/{order_id}/reconcile", headers=other_headers, json={})
    assert denied.status_code == 404
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        before = db.get(User, order.user_id).paid_chat_credits
    first = client.post(f"/v1/orders/{order_id}/reconcile", headers=headers, json={})
    second = client.post(f"/v1/orders/{order_id}/reconcile", headers=headers, json={})
    assert first.status_code == second.status_code == 200
    assert first.json()["status"] == second.json()["status"] == "paid"
    snapshot = client.get("/v1/auth/me", headers=headers).json()["user"]
    assert snapshot["paid_chat_credits"] == before + plan["chat_credits"]
    with SessionLocal() as db:
        entries = db.scalars(
            select(EntitlementLedger)
            .where(EntitlementLedger.source_id == order_id)
            .where(EntitlementLedger.reason == "order.paid")
        ).all()
        assert len(entries) == 1


def test_pending_wechat_query_does_not_grant(wechat_order, monkeypatch) -> None:
    order_id, _, transaction, _ = wechat_order
    transaction["trade_state"] = "NOTPAY"

    class Provider:
        def query(self, **kwargs):
            return 200, json.dumps(transaction)

    monkeypatch.setattr(payment, "_wechat_pay_client", lambda: Provider())
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        before = db.get(User, order.user_id).paid_chat_credits
        assert payment.reconcile_wechat_order(db, order).status == "created"
        assert db.get(User, order.user_id).paid_chat_credits == before


def test_wechat_notification_checks_timestamp_and_signature(monkeypatch) -> None:
    class Provider:
        def callback(self, headers, body):
            assert "wechatpay-timestamp" in headers
            return None

    monkeypatch.setattr(payment, "_wechat_pay_client", lambda: Provider())
    with pytest.raises(HTTPException) as expired:
        payment.decode_wechat_notification({"Wechatpay-Timestamp": "1"}, b"{}")
    assert expired.value.status_code == 401
    with pytest.raises(HTTPException) as invalid:
        payment.decode_wechat_notification({"Wechatpay-Timestamp": str(int(time.time()))}, b"{}")
    assert invalid.value.status_code == 401


def test_production_disables_mock_callback_and_fake_refund(
    client: TestClient, wechat_order, monkeypatch, admin_headers,
) -> None:
    order_id, headers, transaction, _ = wechat_order
    with SessionLocal() as db:
        payment.apply_wechat_transaction(db, db.get(Order, order_id), transaction)
    monkeypatch.setattr(settings, "app_env", "prod")
    monkeypatch.setattr(settings, "payment_mock_enabled", True)
    callback = client.post(
        "/v1/pay/wechat/callback",
        json={"order_id": order_id, "paid": True, "provider_order_id": "fake", "amount_cents": 1},
    )
    assert callback.status_code == 404
    refund = client.post(f"/v1/orders/{order_id}/refund", headers=admin_headers, json={})
    assert refund.status_code == 503
    assert next(item for item in client.get("/v1/orders", headers=headers).json()["orders"] if item["id"] == order_id)["status"] == "paid"


def test_document_retry_is_idempotent_and_other_user_cannot_read(
    client: TestClient, login_user, monkeypatch,
) -> None:
    monkeypatch.setattr(documents, "generate_document_draft", _template_document_draft)
    login = login_user(client, "13800260101", "document-test")
    headers = {"Authorization": f"Bearer {login['token']}"}
    body = {
        "document_type": "execution_application",
        "title": "test-case",
        "facts": "Test facts for a document, not a real person's dispute.",
        "amount": "100",
        "idempotency_key": "document-retry-test",
    }
    before = client.get("/v1/auth/me", headers=headers).json()["user"]
    first = client.post("/v1/documents/generate", headers=headers, json=body)
    second = client.post("/v1/documents/generate", headers=headers, json=body)
    assert first.status_code == second.status_code == 200
    assert first.json()["document"]["id"] == second.json()["document"]["id"]
    assert second.json()["document"]["entitlement_remaining"] == first.json()["document"]["entitlement_remaining"]
    conflict = client.post("/v1/documents/generate", headers=headers, json={**body, "amount": "200"})
    assert conflict.status_code == 409
    changed = client.post(
        "/v1/documents/generate", headers=headers,
        json={**body, "amount": "200", "idempotency_key": "document-edited-test"},
    )
    assert changed.status_code == 200
    assert changed.json()["document"]["id"] != first.json()["document"]["id"]
    after = client.get("/v1/auth/me", headers=headers).json()["user"]
    assert after["free_chat_quota"] + after["paid_chat_credits"] == before["free_chat_quota"] + before["paid_chat_credits"] - 2
    history = client.get("/v1/documents", headers=headers).json()["documents"]
    assert {item["id"] for item in history} == {first.json()["document"]["id"], changed.json()["document"]["id"]}
    other = login_user(client, "13800260102", "document-other")
    assert client.get(
        "/v1/documents", headers={"Authorization": f"Bearer {other['token']}"},
    ).json()["documents"] == []


def test_document_provider_failure_does_not_consume_quota(
    client: TestClient, login_user, monkeypatch,
) -> None:
    def fail(payload):
        raise HTTPException(status_code=503, detail="AI service unavailable")

    monkeypatch.setattr(documents, "generate_document_draft", fail)
    login = login_user(client, "13800260103", "document-provider-failure")
    headers = {"Authorization": f"Bearer {login['token']}"}
    before = client.get("/v1/auth/me", headers=headers).json()["user"]
    response = client.post(
        "/v1/documents/generate", headers=headers,
        json={"document_type": "civil_complaint", "facts": "Test facts, without any actual person's information."},
    )
    assert response.status_code == 503
    after = client.get("/v1/auth/me", headers=headers).json()["user"]
    assert after["free_chat_quota"] == before["free_chat_quota"]
    assert after["paid_chat_credits"] == before["paid_chat_credits"]
    with SessionLocal() as db:
        assert db.scalar(select(GeneratedDocument).where(GeneratedDocument.user_id == login["user"]["id"])) is None
