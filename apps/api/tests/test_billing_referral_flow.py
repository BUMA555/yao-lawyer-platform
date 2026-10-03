from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.security import sign_payment_callback
from app.db.session import SessionLocal
from app.models.entities import EntitlementLedger


def login_user(client: TestClient, mobile: str, device: str) -> dict:
    send = client.post("/v1/auth/mobile/send-code", json={"mobile": mobile, "scene": "login"})
    code = send.json()["debug_code"]
    login = client.post(
        "/v1/auth/mobile/login",
        json={"mobile": mobile, "code": code, "device_fingerprint": device, "nickname": "tester"},
    )
    return login.json()


def build_callback_headers(channel: str, order_id: str, provider_order_id: str, paid: bool, amount_cents: int) -> dict[str, str]:
    secret = "wechat-callback-secret" if channel == "wechat" else "douyin-callback-secret"
    signature = sign_payment_callback(
        secret=secret,
        channel=channel,
        order_id=order_id,
        provider_order_id=provider_order_id,
        paid=paid,
        amount_cents=amount_cents,
    )
    return {"X-Callback-Signature": signature}


def test_billing_referral_and_admin_metrics(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    inviter = login_user(client, "13800002222", "device-A")
    invitee = login_user(client, "13800003333", "device-B")
    inviter_headers = {"Authorization": f"Bearer {inviter['token']}"}
    invitee_headers = {"Authorization": f"Bearer {invitee['token']}"}

    bind = client.post(
        "/v1/referral/bind",
        headers=invitee_headers,
        json={"invite_code": inviter["user"]["invite_code"], "device_fingerprint": "device-B"},
    )
    assert bind.status_code == 200

    plans = client.get("/v1/plans")
    assert plans.status_code == 200
    assert len(plans.json()["plans"]) >= 1
    plan = plans.json()["plans"][0]
    plan_code = plan["code"]

    create_order = client.post("/v1/orders/create", headers=invitee_headers, json={"plan_code": plan_code, "channel": "wechat"})
    assert create_order.status_code == 200
    order_id = create_order.json()["order_id"]

    prepay = client.post("/v1/pay/wechat/prepay", headers=invitee_headers, json={"order_id": order_id, "open_id": "mock_open_id"})
    assert prepay.status_code == 200

    callback_headers = build_callback_headers("wechat", order_id, "wx-order-1", True, plan["price_cents"])
    callback = client.post(
        "/v1/pay/wechat/callback",
        headers=callback_headers,
        json={"order_id": order_id, "paid": True, "provider_order_id": "wx-order-1", "amount_cents": plan["price_cents"]},
    )
    assert callback.status_code == 200
    assert callback.json()["status"] == "paid"

    claim = client.post("/v1/referral/reward/claim", headers=inviter_headers, json={"max_claim_count": 10})
    assert claim.status_code == 200
    assert claim.json()["claimed_count"] >= 1

    metrics = client.get("/v1/admin/metrics", headers=admin_headers)
    assert metrics.status_code == 200
    assert metrics.json()["metrics"]["total_users"] >= 2
    assert metrics.json()["metrics"]["paid_orders"] >= 1

    admin_orders = client.get("/v1/admin/orders", headers=admin_headers)
    admin_tickets = client.get("/v1/admin/tickets", headers=admin_headers)
    admin_entitlements = client.get("/v1/admin/entitlements", headers=admin_headers)
    assert admin_orders.status_code == 200
    assert admin_tickets.status_code == 200
    assert admin_entitlements.status_code == 200
    assert any(item["id"] == order_id for item in admin_orders.json()["orders"])
    assert admin_entitlements.json()["entries"]


def test_callback_requires_valid_signature(client: TestClient) -> None:
    invitee = login_user(client, "13800004444", "device-C")
    invitee_headers = {"Authorization": f"Bearer {invitee['token']}"}

    plans = client.get("/v1/plans")
    plan = plans.json()["plans"][0]
    create_order = client.post("/v1/orders/create", headers=invitee_headers, json={"plan_code": plan["code"], "channel": "wechat"})
    order_id = create_order.json()["order_id"]

    invalid = client.post(
        "/v1/pay/wechat/callback",
        headers={"X-Callback-Signature": "bad-signature"},
        json={"order_id": order_id, "paid": True, "provider_order_id": "wx-order-invalid", "amount_cents": plan["price_cents"]},
    )
    assert invalid.status_code == 401


def test_refund_rolls_back_entitlements_and_rewards(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    inviter = login_user(client, "13800005555", "device-D")
    invitee = login_user(client, "13800006666", "device-E")
    inviter_headers = {"Authorization": f"Bearer {inviter['token']}"}
    invitee_headers = {"Authorization": f"Bearer {invitee['token']}"}

    bind = client.post(
        "/v1/referral/bind",
        headers=invitee_headers,
        json={"invite_code": inviter["user"]["invite_code"], "device_fingerprint": "device-E"},
    )
    assert bind.status_code == 200

    plans = client.get("/v1/plans")
    plan = plans.json()["plans"][0]

    create_order = client.post("/v1/orders/create", headers=invitee_headers, json={"plan_code": plan["code"], "channel": "wechat"})
    order_id = create_order.json()["order_id"]
    prepay = client.post("/v1/pay/wechat/prepay", headers=invitee_headers, json={"order_id": order_id, "open_id": "mock_open_id"})
    assert prepay.status_code == 200

    callback_headers = build_callback_headers("wechat", order_id, "wx-order-2", True, plan["price_cents"])
    callback = client.post(
        "/v1/pay/wechat/callback",
        headers=callback_headers,
        json={"order_id": order_id, "paid": True, "provider_order_id": "wx-order-2", "amount_cents": plan["price_cents"]},
    )
    assert callback.status_code == 200

    claim = client.post("/v1/referral/reward/claim", headers=inviter_headers, json={"max_claim_count": 10})
    assert claim.status_code == 200

    refund = client.post(f"/v1/orders/{order_id}/refund", headers=admin_headers, json={"reason": "user_request"})
    assert refund.status_code == 200
    assert refund.json()["status"] == "refunded"

    metrics = client.get("/v1/admin/metrics", headers=admin_headers)
    assert metrics.status_code == 200

    inviter_me = client.get("/v1/auth/me", headers=inviter_headers)
    invitee_me = client.get("/v1/auth/me", headers=invitee_headers)
    assert inviter_me.status_code == 200
    assert invitee_me.status_code == 200
    assert inviter_me.json()["user"]["paid_chat_credits"] == 0
    assert invitee_me.json()["user"]["paid_chat_credits"] == 0


def test_admin_metrics_forbid_normal_user(client: TestClient) -> None:
    user = login_user(client, "13800007777", "device-F")
    user_headers = {"Authorization": f"Bearer {user['token']}"}
    metrics = client.get("/v1/admin/metrics", headers=user_headers)
    assert metrics.status_code == 403


def test_refund_forbid_normal_user(client: TestClient) -> None:
    invitee = login_user(client, "13800008888", "device-G")
    invitee_headers = {"Authorization": f"Bearer {invitee['token']}"}

    plans = client.get("/v1/plans")
    plan = plans.json()["plans"][0]
    create_order = client.post("/v1/orders/create", headers=invitee_headers, json={"plan_code": plan["code"], "channel": "wechat"})
    order_id = create_order.json()["order_id"]

    callback_headers = build_callback_headers("wechat", order_id, "wx-order-3", True, plan["price_cents"])
    callback = client.post(
        "/v1/pay/wechat/callback",
        headers=callback_headers,
        json={"order_id": order_id, "paid": True, "provider_order_id": "wx-order-3", "amount_cents": plan["price_cents"]},
    )
    assert callback.status_code == 200

    refund = client.post(f"/v1/orders/{order_id}/refund", headers=invitee_headers, json={"reason": "user_request"})
    assert refund.status_code == 403


def test_order_and_payment_callbacks_are_idempotent(client: TestClient) -> None:
    user = login_user(client, "13800009991", "device-idempotent")
    headers = {"Authorization": f"Bearer {user['token']}"}
    plan = client.get("/v1/plans").json()["plans"][0]
    create_payload = {
        "plan_code": plan["code"],
        "channel": "wechat",
        "idempotency_key": "order-test-idempotency-1",
    }

    first = client.post("/v1/orders/create", headers=headers, json=create_payload)
    second = client.post("/v1/orders/create", headers=headers, json=create_payload)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["order_id"] == second.json()["order_id"]

    order_id = first.json()["order_id"]
    callback_body = {
        "order_id": order_id,
        "paid": True,
        "provider_order_id": "wx-idempotent-1",
        "amount_cents": plan["price_cents"],
    }
    callback_headers = build_callback_headers("wechat", order_id, "wx-idempotent-1", True, plan["price_cents"])
    first_callback = client.post(
        "/v1/pay/wechat/callback",
        headers=callback_headers,
        json=callback_body,
    )
    second_callback = client.post(
        "/v1/pay/wechat/callback",
        headers=callback_headers,
        json=callback_body,
    )
    assert first_callback.status_code == 200
    assert second_callback.status_code == 200
    assert second_callback.json()["status"] == "paid"

    with SessionLocal() as db:
        entries = db.scalars(
            select(EntitlementLedger)
            .where(EntitlementLedger.source_id == order_id)
            .where(EntitlementLedger.reason == "order.paid")
        ).all()
        assert len(entries) == 1

    entitlements = client.get("/v1/entitlements", headers=headers)
    assert entitlements.status_code == 200
    assert entitlements.json()["balances"][0]["paid_balance"] == plan["chat_credits"]
