# 运行与联调手册

## 本地启动后端

```powershell
cd apps/api
copy .env.example .env
py -m pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8080
```

## 冒烟流程

1. `POST /v1/auth/mobile/send-code`
2. `POST /v1/auth/mobile/login`
3. `POST /v1/chat/session`
4. `POST /v1/chat/respond`
5. `GET /v1/plans`
6. `POST /v1/orders/create`
7. `POST /v1/pay/wechat/prepay`
8. `POST /v1/pay/wechat/callback`
9. `POST /v1/referral/reward/claim`
10. `GET /v1/admin/metrics`

## 测试

```powershell
cd apps/api
py -m pytest -q
```

## 环境变量建议

- `AI_GATEWAY_BASE_URL`：中转网关地址
- `AI_GATEWAY_API_KEY`：中转网关密钥
- `JWT_SECRET`：生产务必更换
- `DATABASE_URL`：生产建议 PostgreSQL
- `REDIS_URL`：生产用于限流/缓存/队列

## 生产前检查

- 支付回调签名校验上线
- 邀请奖励防刷阈值上线
- 管理员鉴权隔离（与普通用户 token 隔离）
- Prompt 注入与越权测试通过

