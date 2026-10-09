# 参赛提交合规体检报告

> **原版历史存档。** 本报告的「最新」「现在」、Star 数、报名状态与合规判断均指下文所列的原版 Skill 检查时间，不是新版《麦麦补给局》的现行状态。新版网页由 Codex 实现，当前功能、开发归属与真实 MCP 验证范围见 [README](../README.md)、[ARCHITECTURE](ARCHITECTURE.md) 和 [MCP_INTEGRATION](../MCP_INTEGRATION.md)。提交新版前应重新检查官方规则、声明、报名材料与远端状态，不能沿用本报告结论。

体检时间：2026-10-09 14:00（北京时间）
复检时间：2026-10-09 14:15（北京时间，真实 MCP 联调完成后）
升级时间：2026-10-09 14:20（北京时间，项目重构为综合规划助手）
体检对象：`E:/code/1024-M-CODE` → `https://github.com/hsiaozzz/1024-M-CODE`
依据：[activityGuidelines.md](https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md)、[官方 README](https://github.com/M-China/mcd-developer-innovation-challenge)

---

## 最新结论（14:20，项目升级后）

项目已从「活动推荐助手」重构为「麦麦规划助手」，覆盖五条已实测贯通的能力链，工具使用从 4 个只读扩展到 18 个查询类工具。

| 项目 | 初检（14:00） | 现在（14:20） |
| --- | --- | --- |
| 真实使用 MCP | 🔴 未联调，自证未接| ✅ 六层派对链 + 四条其他链全部实测贯通 |
| 技术深度 | 🔴 4 个只读工具，本质是排序 | ✅ 18 个工具，含七层强依赖链与写入前校验 |
| Star 数 | 🔴 0 | ⏳ **仍为 0，唯一剩余阻断项** |
| workbuddy.md | 🟡 缺失 | ✅ 已补齐，含完整脱敏开发时间线 |
| 报名 Issue | ⏳ 未提交 | ⏳ 待提交（截止 10-25 23:59） |

**材料层面已无阻碍。剩余唯一短板是 Star 数。**

---

## 复检结论（14:15）

初检的两个 🔴 阻断项已解除，一个🟡 已补齐。

| 初检阻断项 | 复检状态 | 处理结果 |
| --- | --- | --- |
| 🔴 未真实使用麦当劳 MCP | ✅ **已解除** | 2026-10-09 14:09 完成真实联调：握手 HTTP 200，`tools/list` 35 个工具，4 个查询工具 `tools/call` 全部 `isError: false`。记录见 `MCP_INTEGRATION.md` |
| 🔴 Star = 0 | ⏳ **仍待解决** | 远端 `stargazers_count = 0`。需推广才能进排行榜，这是唯一剩余阻断项 |
| 🟡 缺 workbuddy.md | ✅ **已补齐** | 新增 `workbuddy.md`，含脱敏开发时间线与实测发现；README 已改为"在 WorkBuddy 中完成开发" |
| 🟡 未提交报名 Issue | ⏳ 待办 | 需在 10-25 23:59 前发 Issue，正文草稿在 `docs/registration-issue.md` |

同时完成的加固：`CONTEST_DECLARATION.md` 保持与官方逐字一致；真实 Token 仅存于本地 MCP 配置，仓库与远端双重扫描零泄露；`.workbuddy/` 已排除出仓库。

---

## 一、初检结论（14:00 存档）

**初检状态：可以报名，但不建议现在就报。**

报名条件里的「形式审查」几乎全部通过，但**两条实质门槛没达标**：

| 阻断项 | 官方要求 | 初检现状 | 严重度 |
| --- | --- | --- | --- |
| 未真实使用麦当劳 MCP | "参赛项目须真实使用麦当劳 MCP 能力" | README / MCP_INTEGRATION.md 自述"尚未配置个人 Token，也未执行真实 MCP 调用" | 🔴 致命 |
| Star = 0 | "Star 数为 0 的项目不进入排行榜" | 远端 `stargazers_count = 0` | 🔴 致命（等于零奖） |
| 缺 workbuddy.md | 参加 WorkBuddy 专项奖必需 | 文件不存在，且 README 声明"未使用 WorkBuddy 开发" | 🟡 丢 3000 积分 |
| 未提交报名 Issue | 活动页面用指定 Issue 模板提交 | 官方仓库目前只有 3 个参赛 Issue，无你的 | 🟡 流程未走完 |

形式分（文件名、声明、脱敏、公开可访问、创建时间）**全部满分**。

---

## 二、形式审查逐项核对

| # | 官方要求 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1 | 仓库为Public 可公开访问 | ✅ | `private: false` |
| 2 | 创建时间在 2025-12-25 00:00 ~ 2026-10-25 23:59 | ✅ | `created_at: 2026-10-09T05:46:08Z` |
| 3 | `README.md`（项目介绍/安装方法/使用示例/目标用户） | ✅ | 四要素齐全，示例对话 3 条 |
| 4 | `CONTEST_DECLARATION.md` 文件名+ 内容不可改动 | ✅ | 与官方 `diff -u` **逐字一致，零差异** |
| 5 | `MCP_INTEGRATION.md`（Server/Tool/调用流程/业务价值） | ⚠️ 形式齐、实质空 | 有表格和流程图，但"联调状态"写明未联调 |
| 6 | 源代码 / 可运行内容 | ✅ | `skills/mcd-party-planner/SKILL.md`（规则允许"形式不限"） |
| 7 | `mcp-config.example.json` 脱敏、仅环境变量占位符 | ✅ | `"Bearer ${MCD_MCP_TOKEN}"`，无真实凭证 |
| 8 | 不含 Token/密钥/个人隐私 | ✅ | 全仓正则扫描 0 命中；`.gitignore` 已排除 `.env`、`mcp-config.json` |
| 9 | 无违规内容/外链 | ✅ | 外链仅官方 github/open.mcd.cn/cdn.mcd.cn |
| 10 | `workbuddy.md` | ✅ | 已补齐，含脱敏开发上下文（2026-10-09 复检） |

---

## 三、被低估的两个风险

### 风险 1：真实 MCP 使用是硬核验项

规则原文："参赛项目须真实使用麦当劳 MCP 能力"。麦当劳读取你仓库目录做资格核验，看到 README 和 MCP_INTEGRATION.md 里白纸黑字写着"未配置 Token、未执行真实调用"——这等于自证没接 MCP。同理`docs/acceptance.md` 通篇是"待执行""尚未记录通过结果"。

这不是"诚实"，是"把扣分理由写在脸上"。

### 风险 2：0 Star = 0 奖励

排名规则：Star > 0 才进排行榜，前 100 名才有周边。所有奖励（巨无霸券 / 积分 / 周边）都挂在排行榜上。项目再好，0 Star = 0 收益。

**另一个账号级风险**：规则写明"同一 GitHub 账号拥有多个参赛项目的，仅 Star 数最高的项目进入排行榜"。你的 `cocos-creator-skill` 已有 11 Star。如果它也报名参赛，`1024-M-CODE` 必须超过 11 Star 才能进榜。确认它没报名，或提前想好策略。

---

## 四、时间节点（以官方 GitHub 为准）

海报上的"10月8日18:00 - 10月23日23:59"与官方规则不一致，**官方仓库为准**：

| 阶段 | 官方时间 |
| --- | --- |
| 报名及排名 | 2026-10-09 10:30 ~ **2026-10-25 23:59** |
| 排行榜数据截止（定榜） | 2026-10-26 00:00 |
| 奖品兑换及信息提交截止 | 2026-11-14 |
| 奖励发放 | 提交收货信息后约 2 周内 |

报名 Issue 在 **10月25日 23:59** 前提交即可，不急在这一两天，但 Star 需要时间养。

---

## 五、提交前必做清单

### P0 — 不做就等于没参赛

- [ ] **申请 MCP Token**：https://open.mcd.cn/mcp （手机号登录 → 控制台 → 激活 → 同意协议）
- [ ] **在 WorkBuddy 里配 MCP**：连接器 → 自定义连接器 → 配置MCP → 填入官方 JSON（Token 换成真实值）→ **点保存** → 回列表**启用** mcd-mcp
- [ ] **真实跑通验收场景**：照`docs/acceptance.md` 的 7 条逐条执行
- [ ] **把真实结果写进 MCP_INTEGRATION.md「联调状态」**：日期、客户端、实际工具名、脱敏结果摘要、是否通过
- [ ] **把 `docs/acceptance.md` 更新为已执行状态**（现在是"待执行"）
- [ ] **改掉 README 里"尚未配置个人 MCP Token / 尚未完成真实服务联调 / 尚未配置报名"等表述**
- [ ] **补`workbuddy.md`**：导出本次真实、已脱敏的 WorkBuddy 对话上下文（这个项目本来就是在 WorkBuddy 里写的，声明"未使用 WorkBuddy"是自我否认）

### P1 — 决定能不能拿奖

- [ ] **养Star**：0 → 需要推广（朋友圈 / 掘金 / CSDN / V2EX / GitHub Topics）。可加 topics：`mcp`、`mcd`、`skill`、`agent`、`workbuddy`、`claude-code`
- [ ] 确认 `cocos-creator-skill` 不占用同一账号的参赛名额
- [ ] 补一个 `examples/` 或截图，让 README 有可见产出（现在全是文字描述，Star 转化率低）

### P2 — 提交

- [ ] 在官方仓库发 Issue，标题 `【参赛申请】麦麦活动推荐助手 · 1024 M-CODE`，正文用 `docs/registration-issue.md` 的草稿（项目地址已写成 `https://github.com/hsiaozzz/1024-M-CODE`，可直接用）
- [ ] 等官方 bot 回复报名成功
- [ ] 检查 GitHub 邮箱是否公开（不公开麦当劳会走 OAuth 授权流程，可能拿不到你的邮箱 → 影响领奖）

---

## 六、竞争态势

官方仓库当前只有 3 个参赛 Issue（截至 2026-10-09 13:50），包括你自己的 `Tonywusuowei`（麦当劳早餐不重样）—— **同一个MCD 官方账号已提交 2 个参赛 Issue**。按"一个账号只取 Star 最高"的规则，这两个项目会互相竞争。

早期参赛者少，Star 数普遍低，是抢排名的窗口期。但活动还有 16 天。
