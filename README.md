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

