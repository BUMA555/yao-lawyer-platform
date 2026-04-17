from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

os.environ["APP_ENV"] = "test"
os.environ["DEBUG"] = "true"
os.environ["DATABASE_URL"] = "sqlite:///./data/test_yao.db"
os.environ["JWT_SECRET"] = "test-secret"

from app.db.init_data import seed_plans
from app.db.session import Base, SessionLocal, engine
from app.main import create_app


@pytest.fixture(scope="session", autouse=True)
def prepare_db() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_plans(db)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    app = create_app()
    with TestClient(app) as c:
        yield c


def _login(client: TestClient, mobile: str, device: str = "test-device") -> dict:
    send = client.post("/v1/auth/mobile/send-code", json={"mobile": mobile, "scene": "login"})
    assert send.status_code == 200
    code = send.json()["debug_code"]
    login = client.post(
        "/v1/auth/mobile/login",
        json={"mobile": mobile, "code": code, "device_fingerprint": device, "nickname": "tester"},
    )
    assert login.status_code == 200
    return login.json()


@pytest.fixture()
def auth_user(client: TestClient) -> dict:
    return _login(client, "13800001111")


@pytest.fixture()
def auth_headers(auth_user: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_user['token']}"}


@pytest.fixture()
def login_user():
    return _login

