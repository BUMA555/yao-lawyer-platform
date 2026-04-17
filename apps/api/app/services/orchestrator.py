from __future__ import annotations

import json
import re
import uuid

import httpx

from app.core.config import settings

YAO_SYSTEM_PROMPT = """
你是“姚律师”办案操作系统。
- 始终输出：法官版核心路径、客户版解释、团队版执行动作。
- 明确区分：已知、推定、待核验。
- 必须给出：1-3条下一步动作，1-2条不该做动作。
- 禁止编造事实、诱导伪证、恶意刑事化。
- 如信息不足，先问关键缺口，不下满结论。
""".strip()

HIGH_RISK_PATTERNS = [
    r"诈骗",
    r"职务侵占",
    r"刑事",
    r"拘留",
    r"搜查",
    r"冻结",
    r"开庭",
    r"上诉",
    r"执行",
    r"查封",
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
        "company-control": ["公章", "网银", "股东", "控制权", "法人"],
        "labor": ["仲裁", "加班费", "社保", "劳动合同", "辞退"],
        "fraud-boundary": ["诈骗", "借款", "非法集资", "职务侵占"],
        "civil-commercial": ["合同", "违约", "货款", "欠款", "担保"],
    }
    for lane, terms in lane_rules.items():
        if any(term in text for term in terms):
            return lane
    return "civil-commercial"


class OrchestratorResult(dict):
    pass


class YaoOrchestrator:
    def __init__(self) -> None:
        self.base_url = settings.ai_gateway_base_url.rstrip("/")
        self.api_key = settings.ai_gateway_api_key

    def respond(self, user_message: str, output_mode: str = "standard") -> OrchestratorResult:
        lane = detect_lane(user_message)
        risk_level = detect_risk_level(user_message)
        model = settings.ai_model_high if risk_level in {"R0", "R1"} else settings.ai_model_low

        if self.base_url and self.api_key:
            upstream = self._call_upstream(user_message=user_message, model=model)
            if upstream is not None:
                return OrchestratorResult(
                    status="ok",
                    lane=lane,
                    risk_level=risk_level,
                    model=model,
                    judge_version=upstream,
                    client_version=self._client_rewrite(upstream),
                    team_version=self._team_rewrite(upstream),
                    next_actions=self._next_actions(lane, risk_level),
                    not_recommended=self._not_recommended(risk_level),
                )

        if risk_level in {"R0", "R1"} and output_mode != "short":
            return OrchestratorResult(
                status="queued",
                lane=lane,
                risk_level=risk_level,
                model=model,
                judge_version="当前高风险请求进入优先核验队列，避免误判。",
                client_version="我先帮你稳住关键节点，系统正在做更高强度核验。",
                team_version="创建紧急核验任务，优先完成事实链/证据链/程序节点校准。",
                next_actions=self._next_actions(lane, risk_level),
                not_recommended=self._not_recommended(risk_level),
                queued_ticket_id=f"queue_{uuid.uuid4().hex[:12]}",
                eta_seconds=settings.queue_eta_seconds,
            )

        template = self._fallback_template(user_message=user_message, lane=lane, risk_level=risk_level)
        return OrchestratorResult(
            status="ok",
            lane=lane,
            risk_level=risk_level,
            model=model,
            judge_version=template["judge_version"],
            client_version=template["client_version"],
            team_version=template["team_version"],
            next_actions=template["next_actions"],
            not_recommended=template["not_recommended"],
        )

    def _call_upstream(self, user_message: str, model: str) -> str | None:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": YAO_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.2,
        }
        try:
            with httpx.Client(timeout=settings.ai_gateway_timeout_seconds) as client:
                resp = client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=payload,
                )
                if resp.status_code >= 400:
                    return None
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
        except (httpx.HTTPError, KeyError, ValueError, TypeError):
            return None

    @staticmethod
    def _client_rewrite(judge_version: str) -> str:
        return f"我先给你结论化表达：{judge_version[:220]}"

    @staticmethod
    def _team_rewrite(judge_version: str) -> str:
        return f"团队执行要点：{judge_version[:220]}"

    @staticmethod
    def _next_actions(lane: str, risk_level: str) -> list[str]:
        actions = [
            "补齐最关键3项证据并固定原始载体",
            "明确当前程序节点与最晚截止时间",
            "形成主位/备位/底线三层方案",
        ]
        if lane == "company-control":
            actions[0] = "优先控制公章/网银/税控/后台权限并留痕"
        if risk_level in {"R0", "R1"}:
            actions.insert(0, "48小时内完成风险止血动作并建立证据保全清单")
        return actions[:4]

    @staticmethod
    def _not_recommended(risk_level: str) -> list[str]:
        items = [
            "事实未核前公开定性对方犯罪",
            "在未固定证据前先打舆论战",
            "程序节点不清就仓促提交文书",
        ]
        if risk_level in {"R0", "R1"}:
            items.append("自行删除聊天/财务/后台日志等关键数据")
        return items

    @staticmethod
    def _fallback_template(user_message: str, lane: str, risk_level: str) -> dict[str, object]:
        summary = user_message.strip().replace("\n", " ")
        if len(summary) > 120:
            summary = f"{summary[:120]}..."
        return {
            "judge_version": f"赛道={lane} 风险={risk_level}。先围绕“可裁判争点-证据链-程序节点”组织论证。核心事实：{summary}",
            "client_version": "你现在最需要的是先稳住证据和程序，而不是先争输赢口号。",
            "team_version": "团队分工建议：证据组、程序组、文书组并行推进，每4小时同步一次。",
            "next_actions": [
                "先列出已知/推定/待核验三栏",
                "确认72小时内所有程序节点",
                "输出法官版一页纸裁判路径",
            ],
            "not_recommended": [
                "凭情绪给案件定性",
                "在证据缺口未补齐前贸然报案或起诉",
            ],
        }


def dump_payload(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False)

