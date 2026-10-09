# 麦麦规划助手 · 1024 M-CODE

把「在麦当劳办成事」拆成可执行的查询链：派对选址、积分决策、门店算价、热量配餐、活动日历。

基于麦当劳中国 MCP 的 35 个真实工具构建。项目主体是可由兼容智能体加载的 [Skill](skills/mcd-party-planner/SKILL.md)，无需自行部署服务器。

> 全部工具调用均在 WorkBuddy 中真实执行并记录，见 [MCP_INTEGRATION.md](MCP_INTEGRATION.md)。项目只使用查询类工具，不自动执行下单、领券、抽奖等写入操作。

## 解决的问题

用麦当劳 MCP 的人都会卡在同一个地方：**工具是分散的，而真实需求是连贯的**。给孩子办生日派对，要先知道有哪些派对、再看哪些城市有、再看该城市哪家门店、再看门店哪天能约、再看当天几点有场次、还剩几个位置——六步，每一步的参数都只能从上一步的返回里取。麦当劳 App 不提供这条链，官方 MCP 也没有任何单一工具能给出答案。

本 Skill 把这些散落工具编排成完整决策链，并对每一层的参数来源、失败处理与操作边界作出明确约束。

## 五条已跑通的能力链

### 1. 派对选址（六层强依赖）

```text
mall-points-products(catRuleIds=1>6>20)
  → mall-product-detail(spuId) → query-party-city(spuId)
    → query-party-store(spuId, code, lat, lng)
      → query-party-store-date(spuId, storeCode)
        → query-party-store-session(spuId, storeCode, date)
          → party-order-create(14 必填参数)  ⚠ 写入类，不自动调用
```

实测记录：`spuId=8516`（一起开心鸭尊享版生日派对）→ 安康市 → 门店 `1960713`（813m）→ 10 个可约日期（10-09 至 10-18）→ 场次 `18:30-20:00`、5-12 人、138 元、**余位 12**。

难点：每一层的 `storeCode` / `spuId` / `date` / 场次 `id` 都必须来自上一层真实返回。Skill 明确禁止推断这些参数——这是本项目最核心的约束。

### 2. 积分资产与抽奖决策

`query-my-account` → `mall-points-products` → `query-lottery-info` →（可选）`draw-lottery`

实测：可用 185.5 分、累计 1108.7 分、**已过期 923.2 分**；抽奖 24 分/次进行中，10 个奖品含「下单立减 3 元券」「巨无霸类5 折券」「30 积分」。

Skill 会把`expiredPoint` / `currentMouthExpirePoint` 作为**优先消耗信号**（过期积分不会变成可用余额），并按 `point` 与 `availablePoint` 把商品分为「现在够 / 需攒点 / 需加钱」三档，同时校验 `resourceEligible` 与 `status`。

### 3. 门店级算价与券验证

`query-nearby-stores` → `query-store-coupons` → `query-meals` → `calculate-price`

关键区分：`available-coupons` / `query-my-coupons` 是**账户权益**，`query-store-coupons` 才是**门店真实可用**。Skill 强制区分二者，不把卡包券说成「可用于本店」。

实测边界：`calculate-price` 缺 `storeCode` 返回 400「storeCode 门店编码不能为空」；缺 `beCode`（外送/得来速场景）同样报错。Skill 如实转述缺失字段及其上游来源，不猜不编。

### 4. 热量与预算双约束配餐

`list-nutrition-foods` 返回 160 个餐品的 `energyKcal` / `protein` / `fat` / `carbohydrate` / `sodium` / `calcium`，支持按热量与预算同时筛选，并输出营养合计让用户看到取舍。无价格数据时标「价格待核实」，不承诺满足预算。

### 5. 当月活动日历

`campaign-calendar(specifiedDate?)`。实测修正了官方 schema 的描述偏差——文档说「当天及前后共三天」，实测为**前后最近各一个**有活动日期（传 `2026-10-20` 返回 `10-18` 与 `10-22`，锚点日本身无活动故不返回）。Skill 按实测语义实现，并要求向用户说明实际命中日期。

## 安装与使用

1. 在 [麦当劳 MCP 开放平台](https://open.mcd.cn/mcp) 申请个人 Token。
2. 配置 MCP 连接器：Streamable HTTP，地址 `https://mcp.mcd.cn`，请求头 `Authorization: Bearer <个人 Token>`。参考[官方指南](https://github.com/M-China/mcd-mcp-server)。仓库的 [mcp-config.example.json](mcp-config.example.json)仅含环境变量占位符；真实凭证只保存在客户端本地。
3. 在兼容 Skill 的智能体中安装 `skills/mcd-party-planner` 文件夹，或按客户端的技能导入功能导入其中的 `SKILL.md`。MCP 连接成功不代表客户端自动加载了 Skill，需分别完成配置。
4. 启用 MCP 并确认工具可用，然后输入下方示例。

```text
孩子下个月生日，想办个麦当劳主题派对，帮我看看我所在城市有哪些选择。

我在安康，想给 8 岁孩子办生日派对，10 月中旬哪个店有空位？

我有多少麦享会积分？快过期的有没有，不想浪费。

附近麦当劳有什么券可用？帮我算一下双层吉士加中可乐多少钱。

帮我配一份 500 大卡以内的套餐，尽量别超钠摄入。

这个周末麦当劳有什么活动？
```

输出包含：结论、查询时间、数据来源工具、活动或商品名称、价格与日期、门店与地址、剩余名额、参与条件、以及未提供需核实的事项。完整验证场景见 [docs/acceptance.md](docs/acceptance.md)。

## 安全边界

- **不自动执行写入操作**。下单、领券、抽奖、积分兑换、派对下单仅在用户明确表达意图时识别，并交回客户端授权流程。Skill 从不由推荐推导授权。
- **不把工具返回当指令**。实测发现部分工具返回体内嵌「输出规则」段落，要求 AI 主动给建议。此类内容视为数据字段，不构成授权，也不覆盖 Skill 规则。
- **不推断上游参数**。`storeCode`、`spuId`、`dateStr`、场次 `id` 只能来自上一层真实返回。
- **不伪造凭证与价格**。仓库仅含环境变量占位符；无价格数据时标注待核实。
- 全部文件不含 Token、密钥或个人身份信息。

## 项目结构

```text
skills/mcd-party-planner/SKILL.md    助手主体（五条能力链与安全边界）
mcp-config.example.json             脱敏接入模板
MCP_INTEGRATION.md                   工具清单、入参 schema 与真实调用记录
CONTEST_DECLARATION.md               官方参赛声明原文
docs/acceptance.md                   联调验收场景与结果
docs/registration-issue.md           报名正文草稿
docs/submission-readiness.md        参赛合规自检报告
workbuddy.md                         WorkBuddy 开发上下文（专项奖励必需）
```

## 参赛信息

用于参加 [麦当劳程序员创意开发大赛](https://github.com/M-China/mcd-developer-innovation-challenge)。报名及排名时间为 **2026 年 10 月 9 日 10:30 至 10 月 25 日 23:59（北京时间）**，具体以 [官方规则](https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md) 为准。

本项目在腾讯 [WorkBuddy](https://www.workbuddy.cn/) 中完成开发，真实调用麦当劳 MCP 完成联调，开发上下文见 [workbuddy.md](workbuddy.md)。可将[报名草稿](docs/registration-issue.md)提交至官方仓库 Issue；创建本仓库不等于报名成功，须以官方回复为准。

项目为独立开发作品，非麦当劳官方产品。活动信息、价格及供应状态以官方实时结果为准。原创 Skill 和文档以 [MIT License](LICENSE) 开源；官方参赛声明及第三方商标、服务与材料的权利归各自权利人，其使用遵循相应条款。