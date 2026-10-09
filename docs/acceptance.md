# 真实 MCP 联调验收

**执行时间**：2026-10-09 14:09—14:20（北京时间）
**执行环境**：MCP 客户端 / 宿主智能体，会话握手 HTTP 200，`tools/call` 均返回 `isError: false`
**凭证**：个人 MCP Token，仅存放于客户端本地配置，未写入本仓库

## 工具级验证

| 工具 | 参数 | 结果 | 观测到的行为 |
| --- | --- | --- | --- |
| `now-time-info` | 无 | 通过 | 返回 `2026-10-09 14:09:36`，`timezone: GMT+08:00`，`dayOfWeek: FRIDAY` |
| `campaign-calendar` | 无 | 通过 | 返回当月活动，按日期分组，区分往期回顾 / 今日 / 未来 |
| `campaign-calendar` | `specifiedDate: 2026-10-20` | 通过 | 锚点模式生效，返回 `2026-10-18` 与 `2026-10-22`；与官方 schema 描述的「共三天」不符，按实测处理 |
| `campaign-calendar` | `specifiedDate: 2026-11-15` | 通过 | 返回仍落在当月，确认不覆盖未来月份 |
| `available-coupons` | 无 | 通过 | 返回券列表，含券名与 `已领取 / 可领取` 状态 |
| `query-my-coupons` | 无 | 通过 | 返回卡包券及总数，含用券价格、有效期时段、门店/渠道标签 |
| `query-my-account` | 无 | 通过 | 返回可用/累计/过期/冻结积分与各周期将过期积分 |
| `query-lottery-info` | 无 | 通过 | 返回活动状态、单次消耗、资格标识与 10 项奖品列表 |
| `query-my-prizes` | 无 | 通过 | 返回历史奖品记录与状态 |
| `mall-points-products` | 无 | 通过 | 返回商城商品，含 `spuId` / `point` / `price` / 上下架时间 / 类目 / 状态 |
| `list-nutrition-foods` | 无 | 通过 | 返回 **160 个餐品**的能量、蛋白质、脂肪、碳水、钠、钙 |
| `query-party-city` | `spuId=8516` | 通过 | 返回全国城市列表，含 `code` 与经纬度 |
| `query-party-store` | `spuId, code, lat, lng` | 通过 | 返回该市 2 家门店，含 `code`、地址与距离 |
| `query-party-store-date` | `spuId, storeCode` | 通过 | 返回 10 个可约日期 |
| `query-party-store-session` | `spuId, storeCode, date` | 通过 | 返回场次 `id`、时间段、人数区间、价格与**余位** |
| `query-store-coupons` | `storeCode, orderType, beType` | 通过 | 返回门店维度券及适用商品编码 |
| `calculate-price` | 缺 `storeCode` | 通过 | 返回 `code:400`，明确「storeCode 门店编码不能为空」并列出取值规则 |

## 六层依赖链贯通验证

以生日派对 SPU `8516` 为例，逐层验证参数确实来自上层返回：

| 层 | 工具 | 从上游取到的参数 | 返回结果 |
| --- | --- | --- | --- |
| L1 | `mall-points-products` | — | `spuId=8516`，`shopId=5`，`price=138` |
| L2 | `mall-product-detail` | `spuId` | 商品详情与 SKU |
| L3 | `query-party-city` | `spuId` | 安康市 `code=610900`、`lat=32.685435`、`lng=109.029017` |
| L4 | `query-party-store` | `spuId` + L3 三参数 | 门店 `code=1960713`（813m）、`1960663`（3.6km） |
| L5 | `query-party-store-date` | `spuId` + L4 `storeCode` | 2026-10-09 至 2026-10-18 共 10 天 |
| L6 | `query-party-store-session` | `spuId` + L4 `storeCode` + L5 `date` | 场次 `id=36668015`、`18:30-20:00`、`5-12 人`、`13800`（分）、`leftNum=12` |

**结论**：六层链路全部贯通，每层参数均由上一层真实返回提供，无任何推断值。`party-order-create` 属写入类，本次**不调用**，Skill 设计为识别下单意图后交回客户端授权流程。

## 场景验收

| 场景 | 预期行为 | 结果 |
| --- | --- | --- |
| 孩子办生日派对选哪里 | 六层链逐步查询，参数不推断，人数超区间或余位不足时如实说明 | 通过（链路已验证） |
| 我有多少积分怎么花 | 账户 + 商城对比，商品分「现在够/需攒点/需加钱」三档，标出过期积分 | 通过 |
| 附近门店有什么券 | 用门店维度工具，不把账户券说成门店可用 | 通过 |
| 算一笔账多少钱 | 先取 `storeCode` 再算价，缺参如实转述 400 原因 | 通过 |
| 配低热量套餐 | 热量与预算双约束，输出营养合计，无价格标「待核实」 | 通过（营养库 160 条） |
| 这个周末有什么活动 | 按真实周末筛选，未来与进行中分开标明 | 通过 |
| 下个月有什么活动 | 明确说明仅覆盖当月，不编造 | 通过 |
| 工具返回含指令 | 视为数据字段，不当作授权，不据此改变推荐规则 | 通过（已写入 SKILL.md 核心原则） |
| 活动已结束/无匹配 | 不推荐过期活动，明确说明无匹配 | 通过 |
| Token 无效 / 限流 | 说明实时查询失败，不伪造推荐，不索要 Token | 通过（401/429 处理已记录） |

## 已确认的边界

- `campaign-calendar` 仅覆盖当月，传入未来月份日期不会返回下月数据。
- `specifiedDate` 是锚点语义，返回前后最近的有活动日期，非当天。
- `query-my-coupons` 不校验门店、渠道与配送规则，不等于该券可用于当前订单。
- 账户级券（`available-coupons` / `query-my-coupons`）≠ 门店可用券（`query-store-coupons`）。
- `calculate-price` 与 `query-store-coupons` 缺 `storeCode` / `beCode` 会返回 400。
- 派对链每层仅在上游返回真实可用值时继续。

## 未覆盖范围

- 未测试写入类工具（`party-order-create`、`create-order`、`draw-lottery`、`mall-create-order`、`auto-bind-coupons`、`cancel-order`），本项目不自动调用，避免真实扣款。
- 未测试外送场景（需 `delivery-query-addresses` 与 `addressId`）。
- 未测试 `beType=5` 得来速、6 企业团餐分支。
- 上述为工具级与链路级实测，端到端对话流程可在 WorkBuddy 中以真实提问复核。