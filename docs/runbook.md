# 运行与联调手册

## 本地启动后端

```powershell
cd apps/api
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
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
10. `GET /v1/admin/metrics`（请求头：`Authorization: Bearer ${ADMIN_BEARER_TOKEN}`）
11. `POST /v1/documents/generate`

## 测试

```powershell
cd apps/api
py -m pytest -q
```

## 环境变量建议

- `AI_GATEWAY_BASE_URL`：中转网关地址
- `AI_GATEWAY_API_KEY`：中转网关密钥
- `JWT_SECRET`：生产务必更换
- `ADMIN_BEARER_TOKEN`：管理员接口专用 Bearer Token（需与用户 JWT 严格隔离）
- `PAYMENT_CALLBACK_WECHAT_SECRET`：微信支付回调验签密钥
- `PAYMENT_CALLBACK_DOUYIN_SECRET`：抖音支付回调验签密钥
- `WECHAT_APP_ID`、`WECHAT_APP_SECRET`：微信小程序一键登录
- `WECHAT_PAY_ENABLED=true`：开启真实微信支付；需同时配置商户号、商户私钥、证书序列号、APIv3 密钥和 HTTPS 回调地址
- `PAYMENT_MOCK_ENABLED=true`：仅本地开发测试支付参数，不能产生真实扣款；生产环境 `APP_ENV=prod` 时不会启用
- `DATABASE_URL`：生产建议 PostgreSQL
- `REDIS_URL`：生产用于限流/缓存/队列

## 回调验签联调

- 回调接口 `POST /v1/pay/wechat/callback`、`POST /v1/pay/douyin/callback` 必须携带请求头 `X-Callback-Signature`。
- 服务端验签算法：`HMAC-SHA256`，签名原文为 `"{channel}|{order_id}|{provider_order_id}|{paid_flag}|{amount_cents_or_empty}"`。
- `paid_flag` 规则：`paid=true` 用 `1`，`paid=false` 用 `0`；若 `amount_cents` 为空，拼接空字符串。
- 未配置对应渠道 secret 会返回 `503 Callback secret not configured`；签名缺失或错误会返回 `401`。
- 回调还会校验渠道与金额（若回调带 `amount_cents`），不一致会返回 `400`。

## 退款限制（当前实现）

- 接口 `POST /v1/orders/{order_id}/refund` 仅允许管理员调用。
- 真实支付开启或非本地环境时，不执行本地假退款；当前需在商户侧处理真实退款，不能仅修改数据库声称已退钱。
- 仅 `paid` 状态订单允许退款；其他状态会被拒绝。
- 若该用户存在更晚支付成功的订单，会返回 `409`，需人工复核。
- 若已发放的付费额度已被消费，会返回 `409`，需人工复核。
- 若邀请奖励已领取且已被消费，会返回 `409`，需人工复核。
- 退款成功后会回滚订单状态、用户权益和邀请奖励状态。

## 生产前检查

- 支付回调签名校验上线
- 邀请奖励防刷阈值上线
- 管理员鉴权隔离（与普通用户 token 隔离）
- Prompt 注入与越权测试通过

## 前端文案与布局验收

- 首屏保留品牌、一个核心句和主操作；同时检查图片中已经嵌入的文字。
- 套餐优先展示价格和权益，不把模型宣传、工程术语放在购买操作之前。
- 案情依据和提交预览可折叠；紧急提示、重点风险和不建议动作不可折叠。
- 用 360、390、1280、1440 像素宽度检查溢出、按钮尺寸、图片加载和下一节露出。
- Taro 的 `px` 会随根字号转换；需固定的首屏高度和最大宽度使用 `Px`。
- 运行 `npx tsc --noEmit`、`npm run build:h5`，使用新的浏览器上下文验收，避免旧分块缓存干扰。
- 在项目根目录运行 `npx --yes --package @playwright/cli playwright-cli -s=concise-verify open http://127.0.0.1:4173/`，再运行 `npx --yes --package @playwright/cli playwright-cli -s=concise-verify run-code --filename output/playwright/verify-concise.js`。不要把整段脚本作为 Windows 命令行参数。
- 复验使用测试接口数据，不触发真实付费；Taro 会保留旧页面，跨页选择器需限定当前可见页面，截图前等待转场完成。

## 微信小程序本地测试

- `npm run build:h5` 输出到 `dist`；`npm run build:weapp` 输出到 `dist-weapp`，两者不会互相覆盖。
- 开发接口测试：在 PowerShell 设置 `$env:NODE_ENV="development"` 后运行 `npm run build:weapp`，导入 `dist-weapp`。
- 当前测试项目已绑定 AppID `wx0a51edc53e5c9ffe`；不要再使用 `touristappid`，它只是占位值，微信开发者工具会拒绝导入。
- 最新局域网测试包包含微信登录入口、微信支付参数入口和文书生成页，目录为 `apps/mobile-taro/dist-weapp-lan`。
- 微信登录接口为 `POST /v1/auth/wechat/login`，服务端通过 `wx.login` code 换取 openid，并自动创建用户。
- 文书接口为 `POST /v1/documents/generate`，当前支持民事起诉状、强制执行申请书、答辩状、上诉状、劳动仲裁申请书和证据目录。
- 真实支付通知接口为 `POST /v1/pay/wechat/notify`；本地 HMAC 测试回调只在开发测试开关开启时可用。
- 微信开发者工具中需开启“设置 > 安全设置 > 服务端口”，CLI 才能自动打开、预览或上传项目。
- 本地后端测试地址为 `http://127.0.0.1:8080`；真机测试必须改为可访问的 HTTPS 合法域名。
- 同一 Wi-Fi 下的临时真机测试可使用电脑局域网地址构建：

```powershell
cd apps/mobile-taro
$env:NODE_ENV="development"
$env:API_BASE_URL="http://192.168.1.19:8080"
$env:TARO_OUTPUT_ROOT="dist-weapp-lan"
npm run build:weapp
```

  将 `dist-weapp-lan` 导入微信开发者工具后重新预览；手机和电脑必须在同一 Wi-Fi。正式上线仍需 HTTPS 域名并配置微信业务域名。
- 微信端样式不要使用网页端的在线 `@import` 字体和通配选择器 `*`；网页字体放在 `app.h5.css`，小程序端使用组件选择器。

## 微信接入进度（2026-10-02）

- `WECHAT_APP_ID=wx0a51edc53e5c9ffe` 已写入后端 `.env`，开发者工具 `islogin` 返回 `true`。
- 局域网预览包：`apps/mobile-taro/dist-weapp-lan`；API：`http://192.168.1.19:8080`。最新二维码：`output/wechat-preview-lan-current.png`。
- 微信公众平台仍需本人扫码登录以获取现有 AppSecret；不擅自重置密钥，不把密钥放进前端、Git 或聊天。
- 当前 `WECHAT_PAY_ENABLED=false`、`PAYMENT_MOCK_ENABLED=true`，不会真实扣款。正式配置前不能开启真实支付或宣称已商用。
- 支付后前端最多主动查询三次 `/v1/orders/{order_id}/reconcile`；只有后端确认 `paid` 才刷新余额、提示到账。查询失败或暂未支付时，可从“我的订单”重新查询。
- 文书提交的重试键覆盖全部表单字段，单次页面内相同输入重复提交复用结果；编辑金额、当事人或其他字段生成新请求。“我的文书”从服务端读取当前用户的历史，模板预览单独标记。
- 现有 AI 网关连接失败，旧服务器 `usbuma:22222` 连接超时；仅完成本地联调，未部署正式 HTTPS 后端、未配置合法域名、未提交审核。
- 验证：后端 `32 passed`，TypeScript 通过，小程序构建和微信预览成功。微信专项测试使用模拟服务响应，不等于真实登录或实扣成功。
