# Public API 清单

已实现（与蓝图一致）：

- `POST /v1/auth/mobile/send-code`
- `POST /v1/auth/mobile/login`
- `POST /v1/chat/session`
- `POST /v1/chat/respond`
- `POST /v1/chat/escalate-human`
- `GET /v1/plans`
- `POST /v1/orders/create`
- `POST /v1/pay/wechat/prepay`
- `POST /v1/pay/douyin/prepay`
- `POST /v1/referral/bind`
- `POST /v1/referral/reward/claim`
- `GET /v1/admin/metrics`

扩展接口（便于闭环测试）：

- `POST /v1/pay/wechat/callback`
- `POST /v1/pay/douyin/callback`
- `POST /v1/orders/{order_id}/refund`
- `GET /healthz`

