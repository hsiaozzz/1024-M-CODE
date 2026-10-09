# 报名 Issue（已提交）

**✅ 已于 2026-10-09 16:20（北京时间）提交并成功创建。**

| 项目 | 内容 |
| --- | --- |
| Issue 编号 | **#30** |
| 标题 | 【参赛申请】麦麦补给局 · 1024 M-CODE |
| 链接 | https://github.com/M-China/mcd-developer-innovation-challenge/issues/30 |
| 提交账号 | hsiaozzz |
| 创建时间 | 2026-10-09T08:20:05Z（北京时间 16:20） |
| 状态 | OPEN，等待官方审核回复 |
| 正文长度 | 3194 字符，已确认完整渲染 |

规则说明报名成功后会由系统在 Issue 下回复成功通知。报名截止 2026-10-25 23:59（北京时间），本 Issue 提前 16 天提交。

## 实际提交的正文

> 官方报名格式仅强制要求前三行（项目名称 / 项目地址 / 项目简介），以下其余内容为补充说明，用于呈现技术细节与验证范围。

```text
【参赛申请】
项目名称：麦麦补给局 · 1024 M-CODE
项目地址：https://github.com/hsiaozzz/1024-M-CODE
项目简介：《麦麦补给局》是一个由麦当劳中国 MCP 驱动的配餐策略网页应用——把一天三顿饭变成三场补给冒险。每人每日获得早/午/晚三份任务，在预算、餐次与营养约束下装配餐品卡牌，与约束求解器比较路线，再用门店服务官方验价通关；不必消费也能获得经验与虚拟徽章。

---

**与其他参赛作品的差异**

多数作品是可由智能体加载的 Skill（提示词形态）。本项目是一个**自研 MCP 服务端网关 + 完整网页应用**（Next.js 16 App Router / React 19 / TypeScript），用官方 `@modelcontextprotocol/sdk` 的 `StreamableHTTPClientTransport` 直连 `https://mcp.mcd.cn`，由服务端持有 Token 并代用户调用工具。

**核心能力**

- **网关层**：动态发现工具，为全部 **35 项工具**实现入口、JSON Schema（AJV）参数校验与演示适配器；个人 Token 由用户在应用内输入，仅存于后端内存，不落盘、不写仓库。
- **决策层**：约束求解器在真实菜单上搜索候选组合，按「省钱 / 蛋白优先 / 丰富搭配」输出最多三条路线，附合计价格、热量、蛋白质与约束覆盖率。实测一次搜索覆盖 **80 种组合**，返回三条均满足预算与必需品类。
- **交易安全层**：**7 个写入类工具**（下单、取消订单、积分兑换、抽奖、领券、活动预约、新增地址）全部经过同一道三段式确认网关，不存在「一步直接扣款」的路径。
- **演示模式**：未连接 Token 时走本地模拟业务，35 项工具旅程完整可玩，同样经过完整预览与确认流程；演示价格、积分与订单均明确标注为模拟。

**写入操作的确认网关（本项目主要设计投入）**

```text
preview(name, args)  → 校验参数 → 绑定账户会话 → 生成 SHA-256 指纹
                     → 返回 confirmationId + 消耗摘要 + 5 分钟过期
execute(confirmationId) → 复核条件后才调用官方工具
```

- **指纹去重**：对「会话 + 工具名 + 参数 + 消耗」做 SHA-256，5 分钟内同指纹操作直接复用既有确认，避免连点重复下单。
- **账户级排他锁**：`mcp_action_locks` 表保证同一账户同时只有一笔操作处于执行或待核实状态。
- **事务与并发**：`BEGIN IMMEDIATE` + 条件更新 `WHERE state='pending'`，并发下只有一方能成功。
- **状态机**：`pending → executing → succeeded / uncertain`，非 `pending` 拒绝重入；`succeeded` 幂等返回原结果。
- **不确定结果不重试**：网络超时被标记为 `uncertain` 而**绝不自动重试**下单——重复提交可能造成重复扣款。此时账户被锁定，用户须先核实官方真实结果。

**真实使用的 MCP Tool**

读写分离：写入类工具需要确认网关，读取类工具直接调用。

- 决策与配餐：`query-nearby-stores`、`query-meals`、`query-meal-detail`、`list-nutrition-foods`、`calculate-price`
- 优惠与积分：`available-coupons`、`query-store-coupons`、`query-my-coupons`、`query-my-account`、`mall-points-products`、`mall-product-detail`
- 活动与订单：`campaign-calendar`、`party-order-create`、`query-order`、`order-list`
- 写入类（经确认网关）：`create-order`、`cancel-order`、`mall-create-order`、`draw-lottery`、`auto-bind-coupons`、`party-order-create`、`delivery-create-address`

**三个值得一提的实测发现**

1. **营养接口返回的不是 JSON**。`list-nutrition-foods` 的 `data` 字段是一段自定义格式字符串：`[160]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:` 后接缩进逗号行。作为 JSON 解析会失败，必须按行解析。已针对该格式写专用解析与归一化，160 条真实数据全部通过。

2. **`campaign-calendar` 的 `specifiedDate` 语义与官方 schema 描述不符**。官方描述为「返回当天及前后最邻近的前后各一个有活动的日子（共三天）」，实测传 `2026-10-20` 只返回 `2026-10-18` 与 `2026-10-22`——锚点日本身无活动时不出现在结果中，且实际只返回两天。项目按实测语义实现，并向用户说明实际命中日期；另实测传下月日期（`2026-11-15`）返回仍落在当月，确认该工具不覆盖未来月份。

3. **工具返回体内嵌了指令性文本**。`mall-points-products` 等工具的返回中除数据外，还包含「## 输出格式」「## 输出规则」等段落，其中含有要求模型在用户提示词带「我」时主动给出兑换建议的文字。本项目将其**明确定义为工具返回的数据字段**，不构成用户授权，也不覆盖 Skill 与网关的规则；是否给建议一律由用户需求决定。实测中未因此产生越权调用。

**验证情况**

- **自动化测试 35 / 35 通过**，`tsc --noEmit` 零错误，`next build` 生产构建通过；GitHub Actions 在 Node.js 24 下执行三项检查。
- **本地端到端验证**：首页 200；`GET /api/game/bootstrap` 下发 `HMAC-SHA256` 签名 Cookie（`HttpOnly; SameSite=Strict`）；无 Cookie 访问受保护接口返回 401；跨档案调用求解返回 400「任务不属于当前个人档案」；`/api/mcp/status` 返回 `{"mode":"demo","toolCount":35}`。
- **真实只读联调**（2026-10-09）：35 项工具发现、门店菜单归一化 124 条、营养库 160 条（精确名称匹配 18 条）、门店券、`calculate-price` 官方验价、当月活动解析均正常返回。

**未验证范围（如实说明）**

真实写入操作——真实下单、真实扣积分、真实抽奖、真实领券、真实活动预约、真实支付——**未在开发过程中自动执行**，因为会写入个人账户并可能产生扣款。「35 项工具覆盖」指已实现入口、参数校验与演示适配，不代表 35 项工具都做过真实交易。真实交易始终在官方页面完成支付，行为以官方接口实际返回为准。
```

## 提交时已通过的核查

### 合规文件（规则要求）

- [x] 仓库为公开可访问（Public，`private: false`）
- [x] 创建时间在官方窗口内（仓库实际创建 2026-10-09，窗口为 2025-12-25 ~ 2026-10-25）
- [x] `README.md` 含项目介绍、安装方法、使用示例与目标用户
- [x] `CONTEST_DECLARATION.md` 文件名与内容与官方完全一致（`diff` 零差异，提交前复核通过）
- [x] `MCP_INTEGRATION.md` 说明实际使用的 Server、Tool、调用流程与业务价值
- [x] `mcp-config.example.json` 脱敏，仅含 `${MCD_MCP_TOKEN}` 环境变量占位符
- [x] 源代码为可运行应用（Next.js 16 + React 19 + TypeScript）
- [x] `workbuddy.md` 存在（WorkBuddy 专项奖励必需）

### 信息安全

- [x] 真实 MCP Token 仅存于本地 `~/.workbuddy/mcp.json`，仓库内无任何真实凭证
- [x] `data/`（含 `session.key`、SQLite）、`.next/`、`.local/`、`node_modules/` 均被 `.gitignore` 排除
- [x] 远端逐文件扫描无 Token、账户 ID、密钥、个人身份信息
- [x] 应用内 Token 由用户自行输入，仅存于后端内存，不写入持久化存储

### 质量门槛

- [x] `npm test` 35/35 通过
- [x] `npm run typecheck` 无错误
- [x] `npm run build` 生产构建通过
- [x] GitHub Actions 在 Node.js 24 下执行三项检查

## 后续待办

- [ ] **等待官方审核回复**（规则说明成功后会由系统在 Issue 下回帖通知）
- [ ] **推动 Star 数 > 0** —— 规则明确：Star 数为 0 的项目不进入排行榜，无任何奖励。这是当前唯一的决定性变量。
- [ ] 排行榜数据截止 2026-10-26 00:00；领奖信息提交截止 2026-11-14

> 注：参赛作品若被取消资格，通常因未真实使用 MCP 或内容违规。本项目的 MCP 使用已由真实只读联调与端到端验证记录支撑，见 [MCP_INTEGRATION.md](../MCP_INTEGRATION.md) 与 [acceptance.md](acceptance.md)。
