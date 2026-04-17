from __future__ import annotations

from fastapi.testclient import TestClient


def login_user(client: TestClient, mobile: str, device: str) -> dict:
    send = client.post("/v1/auth/mobile/send-code", json={"mobile": mobile, "scene": "login"})
    code = send.json()["debug_code"]
    login = client.post(
        "/v1/auth/mobile/login",
        json={"mobile": mobile, "code": code, "device_fingerprint": device, "nickname": "tester"},
    )
    return login.json()


def test_billing_referral_and_metrics(client: TestClient) -> None:
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
    plan_code = plans.json()["plans"][0]["code"]

    create_order = client.post("/v1/orders/create", headers=invitee_headers, json={"plan_code": plan_code, "channel": "wechat"})
    assert create_order.status_code == 200
    order_id = create_order.json()["order_id"]

    prepay = client.post("/v1/pay/wechat/prepay", headers=invitee_headers, json={"order_id": order_id, "open_id": "mock_open_id"})
    assert prepay.status_code == 200

    callback = client.post("/v1/pay/wechat/callback", json={"order_id": order_id, "paid": True, "provider_order_id": "wx-order-1"})
    assert callback.status_code == 200
    assert callback.json()["status"] == "paid"

    claim = client.post("/v1/referral/reward/claim", headers=inviter_headers, json={"max_claim_count": 10})
    assert claim.status_code == 200
    assert claim.json()["claimed_count"] >= 1

    metrics = client.get("/v1/admin/metrics", headers=inviter_headers)
    assert metrics.status_code == 200
    assert metrics.json()["metrics"]["total_users"] >= 2
    assert metrics.json()["metrics"]["paid_orders"] >= 1

