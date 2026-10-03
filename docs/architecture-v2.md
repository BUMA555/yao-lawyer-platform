# 姚律师 Product Architecture V2

## 目标判断

当前仓库已经具备 `咨询 -> 结果 -> 深度页 -> 下单/邀请 -> 登录` 的 MVP 闭环，但还不是完整法律服务产品。

下一阶段的最优方向不是继续堆页面，而是把系统从“单轮问答产品”升级成“案件驱动的法律服务平台”：

1. 前台从“咨询页”升级成“案件入口 + 风险结果 + 深度服务承接”。
2. 后端从“聊天接口”升级成“案件编排层 + 服务任务层”。
3. 商业化从“积分包”升级成“商品/订单/权益/履约”四层结构。
4. 后台从“指标占位页”升级成“风控 + 工单 + 套餐 + 内容 + 审计”运营台。

推荐架构模式：

- `模块化单体 + 异步任务 + 前后台分域鉴权`

不推荐当前阶段直接拆微服务。现在最需要解决的是边界和状态真相，不是服务数量。

## 对标启发

结合外部成熟模式，姚律师下一阶段应吸收四类能力：

1. `Clio Grow` 风格的 intake pipeline
   - 线索采集
   - 在线预约
   - 进度阶段管理
   - intake 表单和自动跟进
2. `Harvey` 风格的 knowledge + workflow
   - 结构化案件材料
   - 可复用工作流
   - 文档/证据集中管理
   - 深度分析与可追溯输出
3. `Rocket Lawyer` 风格的 membership + human service
   - AI 自助
   - 文书能力
   - Legal Pro 咨询
   - 会员权益体系
4. `华律网` 风格的场景覆盖 + 咨询/律师/委托分层
   - 高频法律场景入口
   - 在线咨询
   - 找律师/电话咨询
   - 案件委托与解决方案

## 目标产品地图

### 1. 获客层

- 场景化首页
- 搜索/专题/内容页
- 分享裂变页
- 活动落地页

### 2. 案件入口层

- 选择场景
- 结构化录入
- 证据状态采集
- 目标与时效采集

### 3. 风险诊断层

- 初筛结果卡
- 风险等级
- 最危险点
- 证据缺口
- 48 小时动作

### 4. 深度服务层

- 深度报告
- 证据工作台
- 程序节点建议
- 对方反击视角
- 文书骨架预览

### 5. 人工承接层

- 人工复核
- 律师电话沟通
- 文书审阅/代写
- 单案深度包
- 紧急服务升级

### 6. 经营层

- 套餐与 SKU
- 订单与支付
- 会员权益
- 邀请与活动
- 内容运营

### 7. 运营层

- 风控
- 工单
- 套餐运营
- 内容运营
- 用户 360
- 审计日志

## C 端目标信息架构

推荐一级导航调整为：

1. `咨询`
2. `案件`
3. `服务`
4. `我的`

### 咨询

- 首页场景入口
- 场景选择
- 结构化录入

### 案件

- 风险结果
- 深度报告
- 证据工作台
- 案件历史

### 服务

- 单案深度包
- 人工复核
- 律师沟通
- 套餐升级
- 邀请奖励

### 我的

- 账号与登录
- 会员权益
- 奖励中心
- 订单中心

## 核心状态机

系统需要从“最近一次结果”改成“案件状态机”。

建议案件主状态：

1. `draft`
2. `intake_ready`
3. `analysis_running`
4. `result_ready`
5. `needs_evidence`
6. `queued_for_review`
7. `human_review`
8. `service_in_delivery`
9. `closed`

建议服务任务状态：

1. `open`
2. `queued`
3. `assigned`
4. `processing`
5. `waiting_user`
6. `done`
7. `cancelled`

## 后端目标架构

保持单体部署，但强制领域分层：

### interfaces

- FastAPI routers
- auth deps
- admin auth

### application

- create case
- update case
- create session
- respond consultation
- generate report
- create service task
- create order
- claim reward

### domain

- identity
- consultation
- commerce
- referral
- operations

### infrastructure

- sqlalchemy repositories
- ai gateway
- sms gateway
- payment adapters
- event logging
- object storage

## 目标核心数据对象

### Consultation

- `consult_cases`
- `consult_turns`
- `case_artifacts`
- `service_tasks`

### Identity

- `users`
- `sessions/auth tokens`
- `device risk signals`

### Commerce

- `products`
- `skus`
- `orders`
- `payment_attempts`
- `refunds`

### Entitlement

- `entitlement_accounts`
- `entitlement_ledger`

### Growth

- `campaigns`
- `referral_attribution`
- `reward_grants`

### Operations

- `human_handoffs`
- `admin_action_logs`
- `risk_events`

## API 演进方向

### 近期必须补齐

1. `GET /v1/auth/me`
2. `POST /v1/cases`
3. `PATCH /v1/cases/{case_id}`
4. `GET /v1/cases`
5. `GET /v1/cases/{case_id}`
6. `POST /v1/chat/session` 支持 `case_id`
7. `POST /v1/consultations/{case_id}/report` 或独立 report 资源
8. `GET /v1/orders`
9. `GET /v1/referral/status`

### 后台专用

1. `GET /v1/admin/orders`
2. `GET /v1/admin/tickets`
3. `PATCH /v1/admin/tickets/{id}`
4. `GET /v1/admin/risk-events`
5. `GET /v1/admin/plans`
6. `POST /v1/admin/plans`

## 商业化重构原则

必须把下面四层拆开：

1. `Catalog`
   - 卖什么
2. `Checkout`
   - 怎么下单和支付
3. `Entitlement`
   - 用户实际获得什么
4. `Delivery`
   - 服务是否真正交付

推荐商品梯度：

1. 免费体检
2. 单案深度包
3. 人工复核包
4. 月度会员
5. 高价值人工服务

## 后台 IA

推荐后台一级导航：

1. 工作台
2. 风控中心
3. 人工复核
4. 工单中心
5. 交易与套餐
6. 内容运营
7. 用户与审计

## 工程治理

生产化前必须补四个硬门槛：

1. 支付回调签名校验
2. 退款回收权益与奖励
3. 后台管理员鉴权隔离
4. 后端 CI 与风险回归测试

## 90 天落地顺序

### P0

- `/me`
- case-first intake
- 案件对象落地
- queued 服务任务持久化
- admin auth 隔离
- 支付回调安全修复

### P1

- 深度报告独立资源
- 证据工作台
- 订单中心
- 工单中心
- entitlement ledger

### P2

- 内容运营
- 活动系统
- 风控规则中心
- 多角色后台

## 一句话结论

姚律师下一阶段最该做的，不是继续把“AI 咨询页”做厚，而是把整个系统重构成：

`案件驱动 + 服务承接 + 权益可追踪 + 后台可运营`
