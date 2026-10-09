# 报名 Issue 草稿（尚未提交）

官方入口：https://github.com/M-China/mcd-developer-innovation-challenge/issues

建议标题：`【参赛申请】麦麦补给局 · 1024 M-CODE`

## 正文

```text
【参赛申请】
项目名称：麦麦补给局 · 1024 M-CODE
项目地址：https://github.com/hsiaozzz/1024-M-CODE
项目简介：《麦麦补给局》是一个由麦当劳中国 MCP 驱动的配餐策略网页应用，把一天的三顿饭变成三场补给冒险。每人每天获得早/午/晚三份任务，在预算、餐次与营养约束下装配餐品卡牌，与约束求解器比较路线，再用门店服务官方验价通关，不需消费也能获得经验与徽章。技术上自研 MCP 服务端网关，用官方 MCP SDK 直连 https://mcp.mcd.cn，动态发现并实现 20 类工具的入口、参数 schema 校验与演示适配；7 个写入类工具（下单、取消、积分兑换、抽奖、领券、活动预约、新增地址）全部经 preview→confirmationId→execute 三段式确认网关，具备 SHA-256 指纹去重、账户级排他锁、BEGIN IMMEDIATE 事务、状态机与 5 分钟过期；写操作超时标记 uncertain 且绝不自动重试以避免重复扣款。已通过 35 项自动化测试、TypeScript 检查与生产构建；真实只读联调覆盖 35 工具发现、门店菜单 124 条、营养库 160 条、门店券与官方 calculate-price 验价，活动与优惠数据均来自官方实时返回，演示模式与个人 Token 模式明确区分。
```

## 提交前自检

### 合规文件（规则要求）

- [x] 仓库为公开可访问（Public）
- [x] 创建时间在官方窗口内（2025-12-25 00:00 ~ 2026-10-25 23:59，仓库实际 2026-10-09）
- [x] `README.md` 含项目介绍、安装方法、使用示例与目标用户
- [x] `CONTEST_DECLARATION.md` 文件名与内容与官方完全一致（`diff` 零差异）
- [x] `MCP_INTEGRATION.md` 说明实际使用的 Server、Tool、调用流程与业务价值
- [x] `mcp-config.example.json` 脱敏，仅含 `${MCD_MCP_TOKEN}` 环境变量占位符
- [x] 源代码为可运行应用（Next.js 16 + React 19 + TypeScript）
- [x] `workbuddy.md` 存在（WorkBuddy 专项奖励必需）

### 信息安全

- [x] 真实 MCP Token 仅存于本地 `~/.workbuddy/mcp.json`，仓库内无任何真实凭证
- [x] `data/`（含 `session.key`、SQLite）、`.next/`、`.local/`、`node_modules/` 均被 `.gitignore` 排除
- [x] 全仓与远端扫描无 Token、密钥、个人身份信息
- [x] 应用内 Token 由用户自行输入，仅存于后端内存，不写入持久化存储

### 质量门槛

- [x] `npm test` 35/35 通过
- [x] `npm run typecheck` 无错误
- [x] `npm run build` 生产构建通过
- [x] GitHub Actions 在 Node.js 24 下执行三项检查

### 仍待完成

- [ ] **Star 数 > 0**（规则明确：0 Star 不进入排行榜，无任何奖励）
- [ ] 参赛者本人确认同意官方规则与参赛声明

> 报名截止：2026-10-25 23:59（北京时间）
> 排行榜数据截止：2026-10-26 00:00
> 领奖信息提交截止：2026-11-14

## 附：项目演进说明（如评审需要）

本仓库在同一天内经历三个阶段，git 历史完整保留：

| commit | 阶段 | 内容 |
| --- | --- | --- |
| `778a41c` | 活动推荐 Skill | 4 个只读工具做活动排序 |
| `286898b` | 综合规划 Skill | 探测 35 个工具 schema 后覆盖五条查询链 |
| `1ccb64f` | 麦麦补给局（当前参赛版本） | Next.js 网页应用 + MCP 服务端网关 + 确认网关 |

第 2 阶段的实测记录（六层派对查询链、锚点日期语义、跨月边界、工具返回内嵌指令）仍保留在 [MCP_INTEGRATION.md](../MCP_INTEGRATION.md) 的历史章节，可作为参数依赖约束的设计依据。
