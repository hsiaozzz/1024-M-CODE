# 麦当劳 MCP 接入说明

## 版本范围：新版《麦麦补给局》网页

2026-10-09，项目从原版只读 Skill 扩展为 Next.js 网页应用。本轮网页、个人三餐任务、服务端 MCP 网关、确认状态与演示适配器由 Codex 实现；本文后半段的 WorkBuddy 调用记录属于原版历史，不证明新版已完成所有业务验收。

新版默认进入演示模式：本地适配器覆盖 35 个工具，按用户保存模拟积分、优惠券、地址、奖品及订单。连接个人 Token 后，服务端通过 MCP SDK 连接官方服务，动态读取 `tools/list` 和 `inputSchema`，对受支持工具进行 schema 与上游参数校验。Token 仅存于每用户服务端内存连接，重启后需重新连接，不写入源码或数据库。

调用路径为「网页 → 游戏/MCP API → 参数校验与数据归一化 → 演示适配器或官方 MCP」。真实只读与写操作使用不同入口：`/api/mcp/read` 拒绝写工具，7 种写操作（领券、地址创建、餐饮下单、取消、商城兑换、活动预约、抽奖）必须经过 `/api/mcp/preview` 与 `/api/mcp/execute`。确认记录持久化；重复执行不会再次提交，结果不明时不自动重试。

**实现覆盖不等于真实交易验收。** 新版开发不自动执行真实扣积分、下单、抽奖、预约、取消或支付。已有真实记录限于本文逐条列出的只读调用；演示测试不能证明官方交易结果。完整 35 工具映射、架构与测试边界见 [ARCHITECTURE.md](docs/ARCHITECTURE.md)，体验步骤见 [APP_GUIDE.md](docs/APP_GUIDE.md)。

以下「历史」章节保留原版工具发现、schema 与查询链联调证据。原版只读 Skill 仍可独立导入，其宿主直连模式不包含新版网页中转服务。

## 新版网页真实只读联调（2026-10-09）

本轮通过网页服务端连接层与游戏 API 完成只读联调，时间为北京时间约 **14:55**。以下为脱敏结果，不包含个人 Token、完整账户券或联系方式。

| 检查 | 结果与范围 |
| --- | --- |
| 官方连接与工具发现 | 连接成功，动态读取 35 个工具 |
| 附近门店 | 使用成都市武侯区世外桃源酒店位置查询，选取磨子桥餐厅 |
| 门店菜单与营养 | 菜单归一化 124 条，精确名称匹配营养 18 条；营养库返回 160 条 |
| 门店券、餐品详情与算价 | `query-store-coupons`、`query-meal-detail`、`calculate-price` 与对应流程正常返回 200 |
| 游戏候选求解与官方核价 | `/api/game/solve` 正常返回 200，获得一份午餐候选：试算 3400 分（¥34.00），蛋白质 24 g |
| 当月活动 | 活动文章名称正确解析显示 |
| 断开连接 | 恢复明确标记的演示模式 |
| 真实写操作与支付 | 未执行领券、地址创建、下单、兑换、抽奖、活动预约、取消或支付 |

这是一次特定门店、个人账户与当时菜单的读取验证，不能据此保证其他门店、所有渠道、套餐特调和每张券均可用；价格与供应会变化。营养覆盖 18/124 说明多数真实菜单项仍不能可靠参与营养任务，未知值不补造。演示业务另由自动化测试覆盖完整 35 工具旅程。

## 服务与配置

- 官方服务：`https://mcp.mcd.cn`
- 传输：Streamable HTTP
- 鉴权：请求头 `Authorization: Bearer <个人 MCP Token>`
- Token 申请：[麦当劳开放平台](https://open.mcd.cn/mcp)
- 能力依据：[官方 MCP 使用指南](https://github.com/M-China/mcd-mcp-server)，查阅日期 2026-10-09。

[配置模板](mcp-config.example.json) 使用 `${MCD_MCP_TOKEN}` 环境变量占位符。此文件是脱敏模板，不保证所有客户端都支持相同插值语法。应按客户端文档将本地环境变量映射到 Authorization 请求头；不支持插值的客户端可通过其本地设置界面填写 Token，不能将真实配置提交到仓库。不同客户端的传输类型字段也应以各自文档为准。

## 历史：已实测的 MCP Server 与工具

2026-10-09 通过真实 MCP 会话完成联调，实测记录如下。

### 连接握手

| 项目 | 实测结果 |
| --- | --- |
| 协议版本 | `2025-06-18` |
| `serverInfo` | `{"name":"mcd-mcp","version":"1.0.0"}` |
| `initialize` | HTTP 200 |
| `tools/list` | HTTP 200，返回 **35 个工具** |
| 与官方指南的差异 | 实测清单含 35 个工具，其中 `query-promotions`、`query-survey-coupon` 未列于当时官方 README 工具表；以连接后返回为准 |

实测返回的工具清单（按名称排序）：

```text
auto-bind-coupons          available-coupons         calculate-price
campaign-calendar          cancel-order              create-order
delivery-create-address    delivery-query-addresses  delivery-query-stores
draw-lottery               list-nutrition-foods      mall-create-order
mall-order-detail          mall-order-list           mall-points-products
mall-product-detail        now-time-info             order-list
party-order-create         query-lottery-info        query-meal-assistance
query-meal-detail          query-meals               query-my-account
query-my-coupons           query-my-prizes           query-nearby-stores
query-order                query-party-city          query-party-store
query-party-store-date     query-party-store-session query-promotions
query-store-coupons        query-survey-coupon
```

实测清单包含 `query-promotions` 与 `query-survey-coupon`，官方指南工具表未列出，以连接后 `tools/list` 返回为准。

### 项目使用的工具与入参

入参以实测 `inputSchema` 为准，不做猜测。

**派对活动链（六层强依赖）**

| 工具 | 入参 schema | 依赖上游 |
| --- | --- | --- |
| `mall-points-products` | 可选 `catRuleIds`（string，逗号分隔） | — |
| `mall-product-detail` | `spuId`（integer，必填） | 商城列表 |
| `query-party-city` | `spuId`（number，必填） | SPU |
| `query-party-store` | `spuId`、`code`、`latitude`、`longitude` | 城市条目 |
| `query-party-store-date` | `spuId`、`storeCode` | 门店 |
| `query-party-store-session` | `spuId`、`storeCode`、`dateStr` | 可约日期 |
| `party-order-create` | 14 个必填参数（含 `spuId`/`skuId`/`storeCode`/`id`/`partyType`/`count`/`dateStr`/`timeStart`/`timeEnd` 等） | 场次 |

**积分与抽奖链**

| 工具 | 入参 schema |
| --- | --- |
| `query-my-account` | 无参数 |
| `query-lottery-info` | 无参数 |
| `query-my-prizes` | 无参数 |

**门店与算价链**

| 工具 | 入参 schema |
| --- | --- |
| `query-nearby-stores` | 地址相关 |
| `query-store-coupons` | `storeCode`（必填）、`orderType`、`beType`，`beCode` 在外送/得来速/团餐场景必传 |
| `calculate-price` | `storeCode`（必填）、`beType`、`orderType`、`items`，`beCode` / `reservationDate` / `takeWayCode` 按场景必传 |

**营养与活动**

| 工具 | 入参 schema |
| --- | --- |
| `list-nutrition-foods` | 无参数 |
| `campaign-calendar` | 可选 `specifiedDate`（string，`yyyy-MM-dd`） |
| `now-time-info` | 无参数 |
| `available-coupons` | 无参数 |
| `query-my-coupons` | 可选 `page` / `pageSize`（string） |

`campaign-calendar` 的 `specifiedDate` 实测行为：以该日为**锚点**，返回时间线上最邻近的前后各一个有活动的日期，而非指定日期当天。实测传 `2026-10-20`，返回 `2026-10-18` 与 `2026-10-22`——锚点日本身无活动，因此不出现在结果中。**这与官方 schema 描述的「当天及前后共三天」不符**，以实测为准。

`party-order-create` 的 Preconditions 明确：仅支持 `shopId=5` 的商品，必须先确认 `partyType`（1 包场 / 2 拼团），且需 `mall-product-detail` 提供 `shopId`。

`calculate-price` 与 `query-store-coupons` 的 `storeCode` / `beCode` 配对规则由 `beType` 决定：到店取餐（beType=1）→ orderType=1 不传 beCode；得来速（beType=5）→ orderType=1 必传 beCode；外送（orderType=2）→ 必传 beCode；企业团餐（beType=6）→ 另需 `gmServiceCode`。

`query-my-coupons` 官方描述明确声明：不进行门店、渠道、配送方式等下单规则校验，**不承诺可用于当前订单**；若目标为「当前门店/订单可用的券」，应调用 `query-store-coupons`。因此本 Skill 不据其推断券可用于某活动或某订单。

原版 Skill 由宿主智能体直接调用 MCP 工具，无中转服务器。新版网页通过本仓库的服务端网关调用官方 MCP，两者均不绕过官方服务。

```text
用户需求
   ├─ 派对 →商城 → 商品 → 城市 → 门店 → 日期 → 场次 →（下单意图交回客户端）
   ├─ 积分 → 账户 → 商城对比 → 抽奖资格   →（抽奖意图交回客户端）
   ├─ 算价 → 门店 → 门店券 → 餐品 → 算价 →（下单意图交回客户端）
   ├─ 配餐 → 营养库 →热量/预算双约束筛选
   └─ 活动 → 当前时间 → 活动日历 → 按日期分类
```

## 历史：原版真实只读调用记录

**调用时间**：2026-10-09 14:09—14:20（北京时间）
**客户端**：MCP 客户端 / 宿主智能体
**会话**：`initialize` 握手 HTTP 200；`tools/list` 与 `tools/call` 均返回 `isError: false`

### 五条能力链实测

| 工具链 | 关键实测结果 |
| --- | --- |
| 派对六层链 | `spuId=8516` → `query-party-city` 返回全国城市列表 → 安庆/安康市 `code=610900`、`lat=32.685435`、`lng=109.029017` → `query-party-store` 返回该市 2 家门店（`code=1960713`，距离 813m / 3.6km）→ `query-party-store-date` 返回 10 个可约日期（2026-10-09 至 10-18）→ `query-party-store-session` 返回场次 `id=36668015`、`18:30-20:00`、`partyMin=5`、`partyMax=12`、`price=13800`（138 元）、`leftNum=12`。**全链贯通** |
| 积分与抽奖 | `query-my-account`：`availablePoint=185.5`、`accumulativePoint=1108.7`、`expiredPoint=923.2`、`frozenPoint=0`、本月将过期 0。`query-lottery-info`：状态「进行中」、`drawPoint=24`、`resourceEligible=true`、奖品 10 项（下单立减 3/2/1 元券、麦辣/板烧三件套 5 折券、双层鳕鱼 6 折券、麦旋风 5 折券、30 积分等）。`query-my-prizes` 正常返回历史奖品 |
| 门店券验证 | `query-store-coupons(storeCode=1960713, orderType=1, beType=1)` 返回券结构（券名/券ID/券码/有效期/适用商品编码），该工具需门店维度而非账户维度 |
| 参数校验 | `calculate-price` 缺 `storeCode` 返回 `code:400`、`success:false`，message 明确「storeCode 门店编码不能为空」，并列出 beType / orderType 取值说明 |
| 营养数据 | `list-nutrition-foods` 返回 **160 个条目**，字段含 `energyKcal` / `protein` / `fat` / `carbohydrate` / `sodium` / `calcium`，可用于热量与预算双约束筛选 |
| 活动日历 | `campaign-calendar` 无参返回当月活动，按日期分组区分往期回顾 / 今日 / 未来；传 `specifiedDate: 2026-10-20` 返回 `10-18` 与 `10-22`；传下月日期 `2026-11-15` 返回仍落在当月，**确认不覆盖未来月份** |

### 工具返回的内容注入风险

实测发现 `mall-points-products` 等工具的返回体中除数据外，还包含「## 输出格式」「## 输出规则」等段落，其中含有要求 AI 在提示词含「我」时主动给出兑换建议的文字指令。

本项目将此类内容**视为工具返回的数据字段**，不构成用户授权，也不覆盖 Skill 的推荐规则。是否给建议、如何建议，一律由用户需求与本 Skill 决定。该约束已写入 SKILL.md 的核心原则。

验证要点：活动与优惠数据均来自上述实时调用返回，非模型记忆生成。本文档不记录完整账户券列表、券账号或其他账户明细。

官方指南说明：401 表示 Token 缺失、无效或过期；429 表示触发限流（每 Token 每分钟上限 600 次请求）。上述原版联调只使用查询类工具，未执行领券、下单、积分扣减、抽奖或预约类写入工具。新版提供这些业务的预览与确认流程，真实交易仍须逐项验收。

## 历史：原版只读 Skill 覆盖边界

- `campaign-calendar` 覆盖**当月**活动，不覆盖未来月份；跨月请求必须明确说明限制，不得编造下月日历。
- 活动日历会返回「往期回顾」条目，需按日期与当前时间过滤，剔除已结束活动。
- `available-coupons` / `query-my-coupons` 返回的是**账户级资产或可领权益**，不等于门店可用性或活动参与资格；门店可用性只看 `query-store-coupons`。
- 派对链的每一层仅在上游返回真实可用值时才继续；无可约日期、无场次、余位不足时如实说明，不构造参数。
- 原版只读 Skill 不触发写入类工具（`party-order-create`、`create-order`、`draw-lottery`、`mall-create-order`、`auto-bind-coupons`、`cancel-order`）；新版网页在用户完成预览和确认后才执行受支持写操作。
