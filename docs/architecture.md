# 架构总览

## 总体分层

- `apps/api`: 业务后端（FastAPI）
- `apps/mobile-taro`: C 端多端入口（微信/抖音/H5）
- `apps/admin-next`: 运营与风控后台
- `infra`: 本地基础设施（PostgreSQL/Redis/MinIO）

## 后端职责

- API Gateway：鉴权、限流、请求追踪、降级
- Auth Service：手机号验证码登录、设备指纹
- Conversation Service：会话管理、消息存储、额度消耗
- Yao Orchestrator：统一“姚律师”输出模板与风险路由
- Billing Service：套餐、订单、预支付、回调、退款
- Growth Service：邀请码绑定、奖励发放、反作弊校验
- Escalation Service：AI 转真人工单
- Metrics Service：核心经营指标输出

## 数据面

核心实体：

- `users`
- `sms_codes`
- `chat_sessions`
- `chat_messages`
- `plans`
- `orders`
- `payment_attempts`
- `referral_bindings`
- `referral_rewards`
- `escalation_tickets`
- `event_logs`

## 算力路线

- L1：当前中转算力 + 网关路由 + 超时熔断 + 队列降级
- L2：多供应商模型路由 + 成本阈值控制
- L3：自建 vLLM 接 OpenAI-compatible 接口承接低风险流量

## 降级策略

- 上游模型异常时返回 `queued` 状态和 ETA
- 高风险请求可直接建议创建真人升级工单
- 响应中始终保留法官版/客户版/团队版结构

