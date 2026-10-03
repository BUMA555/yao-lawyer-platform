from __future__ import annotations

import json
import re
import uuid
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings

YAO_SYSTEM_PROMPT = """
你是“姚律师”办案操作系统，服务中国大陆消费者的民商事、劳动、公司控制和刑民边界咨询。
先给结论，再给理由和动作；把已知事实、推定事实、待核验事实分开。
只基于用户提供的信息判断，不编造事实、法条、案例或证据，不承诺必胜，不把普通违约和还款困难恶意刑事化。
每个高风险问题都要标明程序窗口、证据缺口和最先要做的止损动作。
输出必须是符合给定 JSON Schema 的中文对象，数组没有内容时返回空数组。
""".strip()

REPORT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "judge_version": {"type": "string"},
        "client_version": {"type": "string"},
        "team_version": {"type": "string"},
        "known_facts": {"type": "array", "items": {"type": "string"}},
        "inferences": {"type": "array", "items": {"type": "string"}},
        "to_verify": {"type": "array", "items": {"type": "string"}},
        "disputed_issues": {"type": "array", "items": {"type": "string"}},
        "evidence_gaps": {"type": "array", "items": {"type": "string"}},
        "next_actions": {"type": "array", "items": {"type": "string"}},
        "not_recommended": {"type": "array", "items": {"type": "string"}},
        "urgent_flags": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "summary",
        "judge_version",
        "client_version",
        "team_version",
        "known_facts",
        "inferences",
        "to_verify",
        "disputed_issues",
        "evidence_gaps",
        "next_actions",
        "not_recommended",
        "urgent_flags",
    ],
}

HIGH_RISK_PATTERNS = [
    r"诈骗",
    r"职务侵占",
    r"刑事",
    r"拘留",
    r"搜查",
    r"冻结",
    r"查封",
    r"开庭",
    r"上诉",
    r"执行",
    r"转移资产",
]


def detect_risk_level(text: str) -> str:
    lowered = text.lower()
    for pattern in HIGH_RISK_PATTERNS:
        if re.search(pattern, lowered):
            return "R1"
    if len(text) > 1200:
        return "R2"
    return "R3"


def detect_lane(text: str) -> str:
    lane_rules = {
        "company-control": ["公章", "网银", "股东", "控制权", "法人", "后台权限"],
        "labor": ["仲裁", "加班费", "社保", "劳动合同", "辞退", "拖工资"],
        "fraud-boundary": ["诈骗", "借款", "非法集资", "职务侵占"],
        "civil-commercial": ["合同", "违约", "货款", "欠款", "担保", "执行"],
    }
    for lane, terms in lane_rules.items():
        if any(term in text for term in terms):
            return lane
    return "civil-commercial"


class OrchestratorResult(dict):
    pass


class YaoOrchestrator:
    def __init__(self) -> None:
        self.gateway_base_url = settings.ai_gateway_base_url.rstrip("/")
        self.gateway_api_key = settings.ai_gateway_api_key
        self.openai_base_url = settings.openai_base_url.rstrip("/")
        self.openai_api_key = settings.openai_api_key

    def respond(self, user_message: str, output_mode: str = "standard") -> OrchestratorResult:
        lane = detect_lane(user_message)
        risk_level = detect_risk_level(user_message)
        model = settings.ai_model_analysis if output_mode == "report" else (
            settings.ai_model_high if risk_level in {"R0", "R1"} else settings.ai_model_low
        )

        upstream = self._call_responses_api(user_message=user_message, model=model)
        if upstream is None and self.gateway_base_url and self.gateway_api_key:
            upstream = self._call_legacy_gateway(user_message=user_message, model=model)

        if upstream is not None:
            normalized = self._normalize_report(upstream, user_message, lane, risk_level)
            return OrchestratorResult(
                status="ok",
                lane=lane,
                risk_level=risk_level,
                model=model,
                **normalized,
            )

        if risk_level in {"R0", "R1"} and output_mode != "short":
            return OrchestratorResult(
                status="queued",
                lane=lane,
                risk_level=risk_level,
                model=model,
                **self._queued_report(lane=lane, risk_level=risk_level),
                queued_ticket_id=f"queue_{uuid.uuid4().hex[:12]}",
                eta_seconds=settings.queue_eta_seconds,
            )

        if not settings.is_dev:
            raise HTTPException(status_code=503, detail="AI service unavailable; quota was not charged")
        return OrchestratorResult(
            status="ok",
            lane=lane,
            risk_level=risk_level,
            model="template-preview",
            **self._fallback_template(user_message=user_message, lane=lane, risk_level=risk_level),
        )

    def _call_responses_api(
        self, user_message: str, model: str, *,
        system_prompt: str = YAO_SYSTEM_PROMPT,
        schema: dict[str, Any] = REPORT_SCHEMA,
        schema_name: str = "yao_lawyer_report",
    ) -> dict[str, Any] | None:
        if not self.openai_api_key:
            return None

        payload: dict[str, Any] = {
            "model": model,
            "store": False,
            "input": [
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": system_prompt}],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": user_message}],
                },
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "description": "结构化法律咨询分析报告",
                    "strict": True,
                    "schema": schema,
                }
            },
            "max_output_tokens": settings.ai_max_output_tokens,
        }
        if settings.ai_reasoning_effort:
            payload["reasoning"] = {"effort": settings.ai_reasoning_effort}

        try:
            with httpx.Client(timeout=settings.ai_gateway_timeout_seconds) as client:
                resp = client.post(
                    f"{self.openai_base_url}/responses",
                    headers={
                        "Authorization": f"Bearer {self.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if resp.status_code >= 400:
                    return None
                return self._parse_upstream_payload(resp.json())
        except (httpx.HTTPError, ValueError, TypeError):
            return None

    def _call_legacy_gateway(
        self, user_message: str, model: str, *,
        system_prompt: str = YAO_SYSTEM_PROMPT,
        schema: dict[str, Any] = REPORT_SCHEMA,
        schema_name: str = "yao_lawyer_report",
    ) -> dict[str, Any] | None:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.2,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                },
            },
        }
        try:
            with httpx.Client(timeout=settings.ai_gateway_timeout_seconds) as client:
                resp = client.post(
                    f"{self.gateway_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.gateway_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if resp.status_code >= 400:
                    return None
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return self._parse_text(content)
        except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError):
            return None

    @classmethod
    def _parse_upstream_payload(cls, data: dict[str, Any]) -> dict[str, Any] | None:
        output_text = data.get("output_text")
        if isinstance(output_text, str) and output_text.strip():
            return cls._parse_text(output_text)

        output = data.get("output")
        if isinstance(output, list):
            for item in output:
                if not isinstance(item, dict):
                    continue
                for content in item.get("content", []):
                    if not isinstance(content, dict):
                        continue
                    text = content.get("text")
                    if isinstance(text, str) and text.strip():
                        parsed = cls._parse_text(text)
                        if parsed is not None:
                            return parsed
        return None

    @staticmethod
    def _parse_text(value: Any) -> dict[str, Any] | None:
        if isinstance(value, dict):
            return value
        if not isinstance(value, str):
            return None
        cleaned = value.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    @classmethod
    def _normalize_report(
        cls,
        payload: dict[str, Any],
        user_message: str,
        lane: str,
        risk_level: str,
    ) -> dict[str, Any]:
        fallback = cls._fallback_template(user_message=user_message, lane=lane, risk_level=risk_level)
        normalized: dict[str, Any] = {}
        for key, fallback_value in fallback.items():
            value = payload.get(key, fallback_value)
            if isinstance(fallback_value, list):
                normalized[key] = [str(item) for item in value] if isinstance(value, list) else fallback_value
            else:
                normalized[key] = str(value) if value is not None else fallback_value
        normalized["summary"] = normalized["summary"][:4000]
        return normalized

    @staticmethod
    def _queued_report(lane: str, risk_level: str) -> dict[str, Any]:
        return {
            "summary": "当前问题触及高风险程序节点，先进入人工核验，避免系统在事实不足时给出过重结论。",
            "judge_version": "先固定程序节点、财产或证据变化，再由人工复核裁判路径。",
            "client_version": "这不是拒答，而是先把可能影响结果的关键事实核准。",
            "team_version": f"创建高风险复核任务，赛道={lane}，风险={risk_level}，优先核对事实链、证据链和程序期限。",
            "known_facts": [],
            "inferences": [],
            "to_verify": ["是否存在正在发生的资产、证据或程序窗口变化"],
            "disputed_issues": [],
            "evidence_gaps": ["原始材料、时间线和当前程序状态"],
            "next_actions": [
                "48小时内固定原始证据和相关页面截图",
                "确认法院、仲裁机构或侦查机关的当前程序节点",
                "暂缓不可逆的公开定性和对抗动作",
            ],
            "not_recommended": ["未核实前公开指控犯罪", "删除或改写原始聊天、财务和后台记录"],
            "urgent_flags": ["高风险请求待人工复核"],
        }

    @staticmethod
    def _fallback_template(user_message: str, lane: str, risk_level: str) -> dict[str, Any]:
        summary = user_message.strip().replace("\n", " ")
        if len(summary) > 180:
            summary = f"{summary[:180]}..."
        return {
            "summary": f"当前按{lane}处理，风险级别为{risk_level}。先围绕可裁判争点、证据链和程序节点组织论证。",
            "judge_version": f"核心事实：{summary}。现阶段应把请求拆成可裁判争点，并逐项对应证明材料。",
            "client_version": "你现在最需要的是先稳住证据和程序，再决定起诉、保全、谈判或人工复核。",
            "team_version": "团队执行：证据组整理原始材料，程序组确认期限，文书组形成主位和备位路径。",
            "known_facts": [summary] if summary else [],
            "inferences": ["目前只能做方向性判断，不能替代对原始材料的核验。"],
            "to_verify": ["完整时间线", "对方身份和责任主体", "当前程序节点"],
            "disputed_issues": ["责任基础", "损失或金额计算", "证据是否达到可裁判程度"],
            "evidence_gaps": ["原始合同、转账、聊天或程序文书", "能直接证明关键争点的材料"],
            "next_actions": [
                "列出已知、推定、待核验三栏",
                "确认72小时内的程序节点",
                "输出法官版一页纸裁判路径",
            ],
            "not_recommended": ["事实未核前给案件定性", "证据缺口未补齐前仓促提交不可逆文书"],
            "urgent_flags": ["如存在即将开庭、执行或财产变化，应优先人工复核"],
        }


def dump_payload(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False)
