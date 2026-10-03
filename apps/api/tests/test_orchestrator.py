from __future__ import annotations

import json

from app.core.config import settings
from app.services import orchestrator as orchestrator_module
from app.services.orchestrator import YaoOrchestrator


def test_responses_api_uses_private_structured_output(monkeypatch) -> None:
    report = {
        "summary": "先核对合同和付款链。",
        "judge_version": "需要先固定履约和付款证据。",
        "client_version": "先整理材料再决定是否起诉。",
        "team_version": "证据组先出目录。",
        "known_facts": ["存在合同尾款争议"],
        "inferences": [],
        "to_verify": ["付款期限"],
        "disputed_issues": ["是否逾期"],
        "evidence_gaps": ["对账记录"],
        "next_actions": ["固定原始聊天"],
        "not_recommended": ["不要先公开指控"],
        "urgent_flags": [],
    }
    captured: dict[str, object] = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"output_text": json.dumps(report, ensure_ascii=False)}

    class FakeClient:
        def __init__(self, **kwargs):
            captured["timeout"] = kwargs["timeout"]

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def post(self, url, **kwargs):
            captured["url"] = url
            captured["payload"] = kwargs["json"]
            return FakeResponse()

    monkeypatch.setattr(orchestrator_module.httpx, "Client", FakeClient)
    monkeypatch.setattr(settings, "openai_api_key", "test-openai-key")
    monkeypatch.setattr(settings, "openai_base_url", "https://example.test/v1")

    result = YaoOrchestrator().respond("合同尾款没有支付，先看证据。")

    assert result["status"] == "ok"
    assert result["summary"] == report["summary"]
    assert captured["url"] == "https://example.test/v1/responses"
    payload = captured["payload"]
    assert isinstance(payload, dict)
    assert payload["store"] is False
    assert payload["text"]["format"]["type"] == "json_schema"
    assert payload["text"]["format"]["strict"] is True
