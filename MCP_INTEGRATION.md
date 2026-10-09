# 麦当劳 MCP 接入说明

## 服务与配置

- 官方服务：`https://mcp.mcd.cn`
- 传输：Streamable HTTP
- 鉴权：请求头 `Authorization: Bearer <个人 MCP Token>`
- Token 申请：[麦当劳开放平台](https://open.mcd.cn/mcp)
- 能力依据：[官方 MCP 使用指南](https://github.com/M-China/mcd-mcp-server)，查阅日期 2026-10-09。

[配置模板](mcp-config.example.json) 使用 `${MCD_MCP_TOKEN}` 环境变量占位符。此文件是脱敏模板，不保证所有客户端都支持相同插值语法。应按客户端文档将本地环境变量映射到 Authorization 请求头；不支持插值的客户端可通过其本地设置界面填写 Token，不能将真实配置提交到仓库。不同客户端的传输类型字段也应以各自文档为准。

## 已实测的 MCP Server 与工具

2026-10-09 已通过真实 MCP 会话完成联调，实测记录如下。

### 连接握手

| 项目 | 实测结果 |
| --- | --- |
| 协议版本 | `2025-06-18` |
| `serverInfo` | `{"name":"mcd-mcp","version":"1.0.0"}` |
| `initialize` | HTTP 200 |
| `tools/list` | HTTP 200，返回 **35 个工具** |
| 与官方指南一致性 | 实测清单与官方 README 工具表逐项吻合 |

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

### 实际使用工具与入参

入参以实测 `inputSchema` 为准，不做猜测。

| 工具 | 入参 schema | 调用条件 | 业务价值 |
| --- | --- | --- | --- |
| `now-time-info` | 无参数 | 活动推荐前 | 判断今天、有效期与未来活动 |
| `campaign-calendar` | 可选 `specifiedDate`（string，`yyyy-MM-dd`） | 活动推荐时 | 获得当月真实活动，避免凭记忆生成 |
| `available-coupons` | 无参数 | 用户询问可领取优惠 | 补充当前可领券及适用条件 |
| `query-my-coupons` | 可选 `page` / `pageSize`（string） | 用户要求结合已有券时 | 提示已有权益与有效期 |

`campaign-calendar` 的 `specifiedDate` 实测行为：以该日为**锚点**，返回时间线上最邻近的前后各一个有活动的日期，而非指定日期当天。实测传 `2026-10-20`，返回 `2026-10-18` 与 `2026-10-22`——锚点日本身无活动，因此不出现在结果中。不传该参数时返回当前月所有活动。

`query-my-coupons` 返回含用户持券的有效期、门店与渠道限制、标签（实测见「今日到期」「到店专用」「外送专用」）。该工具官方描述明确声明：不进行门店、渠道、配送方式等下单规则校验，**不承诺可用于当前订单**；若目标为「当前门店/订单可用的券」，应调用 `query-store-coupons`。因此本 Skill 不据其推断券可用于某活动或某订单。

Skill 由宿主智能体直接调用 MCP 工具，无中转服务器。仓库未包含 MCP 服务实现，也不绕过官方服务。

```text
用户需求 → now-time-info → campaign-calendar
                ↓
        日期与偏好筛选
                ↓
  按需 available-coupons / query-my-coupons
                ↓
  推荐 + 参与条件 + 数据来源
```

## 真实调用记录

**调用时间**：2026-10-09 14:09—14:10（北京时间）
**客户端**：MCP 客户端 / 宿主智能体
**会话**：`initialize` 握手 HTTP 200；`tools/list` 与 `tools/call` 均返回 `isError: false`

| 工具 | 参数 | 状态 | 脱敏结果摘要 |
| --- | --- | --- | --- |
| `now-time-info` | 无 | 通过 | `2026-10-09 14:09:36`，`timezone: GMT+08:00`，`dayOfWeek: FRIDAY` |
| `campaign-calendar` | 无 | 通过 | 返回当月活动，按日期分组，含「往期回顾 / 今日 / 未来」三类。实测当日含联名周边、蘸酱新品、麦咖啡早餐等；未来节点含 10-15、10-18、10-22 等 |
| `campaign-calendar` | `specifiedDate: 2026-10-20` | 通过 | 锚点模式生效，返回 `2026-10-18`、`2026-10-22`（锚点日本身无活动，未返回） |
| `available-coupons` | 无 | 通过 | 返回麦麦省券列表，字段含券名、`已领取 / 可领取` 状态、券图 |
| `query-my-coupons` | 无 | 通过 | 返回卡包可用券及总数，字段含用券价格、有效期时段、适用门店/渠道标签 |

验证要点：活动与优惠数据均来自上述实时调用返回，非模型记忆生成。本文档不记录完整账户券列表、券账号或其他账户明细。

官方指南说明：401 表示 Token 缺失、无效或过期；429 表示触发限流（每 Token 每分钟上限 600 次请求）。本项目首版只使用上述 4 个只读查询工具，不使用领券、下单、积分扣减、抽奖或预约类工具。

## 覆盖边界

- `campaign-calendar` 覆盖**当月**活动。实测传入下月日期（如 `2026-11-15`）时，返回结果仍落在当月范围内，**不覆盖未来月份**。跨月请求必须明确说明该限制，不得编造下月日历。
- 活动日历会返回「往期回顾」条目，需按日期与当前时间过滤，剔除已结束活动。
- 券类工具返回的是**账户资产或可领权益**，不等于活动参与资格或门店可用性，不得混为一谈。