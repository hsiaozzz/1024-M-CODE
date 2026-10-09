# 麦麦活动推荐助手 · 1024 M-CODE

把「最近麦当劳有什么活动？」变成有时间、有条件、有理由的行动清单。

面向想了解新品、限时活动和优惠的麦当劳用户，基于麦当劳中国 MCP 的实时活动日历，结合用户的日期、兴趣和已有优惠券，推荐值得关注的活动。项目主体是可由兼容智能体加载的 [Skill](skills/mcd-campaign-assistant/SKILL.md)，无需自行部署服务器。

> 当前为首版 Skill：已完成工具调用流程与使用说明，尚未配置个人 MCP Token、完成真实服务联调或正式报名。推荐结果中的活动和优惠必须来自实际 MCP 返回，不能把示例当成实时信息。

## 首版能力

- 查询当月活动，区分进行中、即将开始和已结束的活动。
- 根据「新品 / 优惠 / 周末安排」等偏好，给出最多三项推荐和推荐理由。
- 用户询问优惠时，结合可领取优惠券或账户已有券说明参与条件。
- 资料缺失时明确标注，避免把活动宣传、券面优惠或未来活动误当成当前可用权益。

## 安装与使用

1. 在 [麦当劳 MCP 开放平台](https://open.mcd.cn/mcp) 申请个人 Token。
2. 在支持 Streamable HTTP 的 MCP 客户端中配置 `https://mcp.mcd.cn`，请求头使用 `Authorization: Bearer <个人 Token>`。参考 [官方指南](https://github.com/M-China/mcd-mcp-server)。仓库的 [mcp-config.example.json](mcp-config.example.json) 仅含环境变量占位符；环境变量插值方式取决于客户端，详见 [MCP_INTEGRATION.md](MCP_INTEGRATION.md)。真实凭证只保存在客户端本地。
3. 在兼容 Skill 的智能体中安装 `skills/mcd-campaign-assistant` 文件夹，或按客户端的技能导入功能导入其中的 `SKILL.md`。如果客户端仅支持自定义指令，可将其正文作为助手指令使用。MCP 连接成功不代表客户端自动加载了 Skill，需要分别完成配置。
4. 启用麦当劳 MCP，并输入下方示例。首次使用应检查工具是否可用。

```text
最近麦当劳有哪些活动？优先推荐新品，告诉我什么时候去合适。

这个周末想吃麦当劳，帮我选三个值得关注的活动，说明参加条件。

结合我已有的优惠券，看看今天有哪些值得参与的活动。
```

输出包含：查询时间、活动名称、活动日期、推荐理由、参与条件、官方入口（工具提供时）以及需要进一步核实的事项。完整的验证场景见 [docs/acceptance.md](docs/acceptance.md)。

## 项目结构

```text
skills/mcd-campaign-assistant/SKILL.md  助手主体
mcp-config.example.json               脱敏接入模板
MCP_INTEGRATION.md                     工具和业务流程
CONTEST_DECLARATION.md                 官方参赛声明原文
docs/acceptance.md                     联调验收场景
docs/registration-issue.md             报名正文草稿
```

## 参赛信息

用于参加 [麦当劳程序员创意开发大赛](https://github.com/M-China/mcd-developer-innovation-challenge)。报名及排名时间为 **2026 年 10 月 9 日 10:30 至 10 月 25 日 23:59（北京时间）**，具体以 [官方规则](https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md) 为准。

完成真实 MCP 联调并确认参赛声明后，可将 [报名草稿](docs/registration-issue.md) 提交至官方仓库 Issue。创建本仓库不等于报名成功，须以官方回复为准。未使用 WorkBuddy 开发，当前不包含 `workbuddy.md`；若后续申请 WorkBuddy 专项奖励，应提交真实且脱敏的开发对话。

项目为独立开发作品，非麦当劳官方产品。活动信息、价格及供应状态以官方实时结果为准。原创 Skill 和文档以 [MIT License](LICENSE) 开源；官方参赛声明及第三方商标、服务与材料的权利归各自权利人，其使用遵循相应条款。
