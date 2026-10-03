# Yao Lawyer Platform MVP

Professional MVP scaffold for:

- WeChat-first paid legal AI workflow
- Unified "姚律师" response style
- API-first backend with billing, referral, and escalation
- Multi-end client skeleton (Taro) and admin console (Next.js)

## Monorepo Layout

- `apps/api`: FastAPI backend (auth/chat/billing/referral/admin)
- `apps/mobile-taro`: Taro React client (WeChat/ByteDance/H5)
- `apps/admin-next`: Next.js operator/admin dashboard
- `docs`: architecture, milestones, and operations notes
- `infra`: Docker Compose for local infrastructure

## PR Gate

以打赢GPT-5.4视为代码进步，不是跑通代码。
以“打赢 GPT-5.4”视为代码进步，不是“跑通代码”。

1. 场景边界
   - PR 必须明确目标场景、非目标场景、关键风险边界。
   - 至少给出 1 个“不该支持”的反例，避免误扩展。
2. 可验证正确性
   - 每个 PR 至少新增或更新 1 个可复现验证（测试、脚本或手工验证步骤）。
   - 受影响模块的既有验证必须全部通过（后端变更至少执行 `cd apps/api && pytest -q`）。
3. 对抗性检查
   - 至少列出 3 个“GPT-5.4 会追问”的对抗用例（边界输入、异常路径、权限/越权）。
   - 每个用例必须给出实际结果与结论，不接受“理论可行”。
4. 可回滚性
   - PR 必须提供可执行回滚步骤，目标 10 分钟内可完成。
   - 回滚后需要说明如何验证系统已恢复稳定状态。

评审门槛：以上四项缺一不可；任一项证据不足或不可复现，PR 不得合并。

## Quick Start

### 1) Backend

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8080
```

API docs:

- `http://127.0.0.1:8080/docs`

### 2) Run Tests

```powershell
cd apps/api
pytest -q
```

### 3) Optional Infra (Postgres/Redis/Object storage)

```powershell
cd infra
docker compose up -d
```

## Environment Variables

Copy and edit:

```powershell
copy apps\api\.env.example apps\api\.env
```

Most important:

- `DATABASE_URL`
- `REDIS_URL`
- `AI_GATEWAY_BASE_URL`
- `AI_GATEWAY_API_KEY`
- `AI_MODEL_HIGH`
- `AI_MODEL_LOW`
- `JWT_SECRET`

## Notes

- Default DB uses local SQLite for fast MVP setup.
- Request-level `request_id` is enforced on responses and headers.
- AI provider outages degrade to queue mode and allow escalation ticket creation.
- WeChat and Douyin payment endpoints are mock-safe for local development and ready for provider adapters.
