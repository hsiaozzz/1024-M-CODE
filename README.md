# 麦麦活动推荐助手 · 1024 M-CODE

把「最近麦当劳有什么活动？」变成有时间、有条件、有理由的行动清单。

面向想了解新品、限时活动和优惠的麦当劳用户，基于麦当劳中国 MCP 的实时活动日历，结合用户的日期、兴趣和已有优惠券，推荐值得关注的活动。项目主体是可由兼容智能体加载的 [Skill](skills/mcd-campaign-assistant/SKILL.md)，无需自行部署服务器。

> 已在 WorkBuddy 中完成真实 MCP 联调（2026-10-09），实测握手 HTTP 200、可调用 4 个查询工具，调用记录见 [MCP_INTEGRATION.md](MCP_INTEGRATION.md)。推荐结果中的活动和优惠均来自实际 MCP 返回，不使用记忆中的活动信息。

## 已实测能力

- 查询当月活动，区分进行中、即将开始和已结束的活动。
- 支持以指定日期为锚点，定位该日前后最接近的有活动日期。
- 根据「新品 / 优惠 / 周末安排」等偏好，给出最多三项推荐和推荐理由。
- 用户询问优惠时，结合可领取优惠券或账户已有券说明参与条件。
- 资料缺失时明确标注，避免把活动宣传、券面优惠或未来活动误当成当前可用权益。

边界：`campaign-calendar` 只覆盖当月活动，跨月请求会明确说明限制；券类工具返回的是账户权益，不等于门店可用性或活动参与资格。

## 安装与使用

1. 在 [麦当劳 MCP 开放平台](https://open.mcd.cn/mcp) 申请个人 Token。
2. 在支持 Streamable HTTP 的 MCP 客户端中配置 `https://mcp.mcd.cn`，请求头使用 `Authorization: Bearer <个人 Token>`。参考 [官方指南](https://github.com/M-China/mcd-mcp-server)。仓库的 [mcp-config.example.json](mcp-config.example.json) 仅含环境变量占位符；环境变量插值方式取决于客户端，详见 [MCP_INTEGRATION.md](MCP_INTEGRATION.md)。真实凭证只保存在客户端本地。
3. 在兼容 Skill 的智能体中安装 `skills/mcd-campaign-assistant` 文件夹，或按客户端的技能导入功能导入其中的 `SKILL.md`。如果客户端仅支持自定义指令，可将其正文作为助手指令使用。MCP 连接成功不代表客户端自动加载了 Skill，需要分别完成配置。
4. 启用麦当劳 MCP，并输入下方示例。首次使用应检查工具是否可用。

```text
最近麦当劳有哪些活动？优先推荐新品，告诉我什么时候去合适。

这个周末想吃麦当劳，帮我选三个值得关注的活动，说明参加条件。

10月20号前后有什么活动？我想知道那天附近能参加什么。

结合我已有的优惠券，看看今天有哪些值得参与的活动。
```

输出包含：查询时间、活动名称、活动日期、推荐理由、参与条件、官方入口（工具提供时）以及需要进一步核实的事项。完整的验证场景与实测结论见 [docs/acceptance.md](docs/acceptance.md)。

## 项目结构

```text
skills/mcd-campaign-assistant/SKILL.md  助手主体
mcp-config.example.json               脱敏接入模板
MCP_INTEGRATION.md                     工具清单、调用流程与真实调用记录
CONTEST_DECLARATION.md                 官方参赛声明原文
docs/acceptance.md                     联调验收场景与结果
docs/registration-issue.md             报名正文草稿
docs/submission-readiness.md          参赛合规自检报告
```

## 参赛信息

用于参加 [麦当劳程序员创意开发大赛](https://github.com/M-China/mcd-developer-innovation-challenge)。报名及排名时间为 **2026 年 10 月 9 日 10:30 至 10 月 25 日 23:59（北京时间）**，具体以 [官方规则](https://github.com/M-China/mcd-developer-innovation-challenge/blob/main/activityGuidelines.md) 为准。

本项目在腾讯 [WorkBuddy](https://www.workbuddy.cn/) 中完成开发，真实调用麦当劳 MCP 完成联调，开发上下文见 [workbuddy.md](workbuddy.md)。可将[报名草稿](docs/registration-issue.md)提交至官方仓库 Issue；创建本仓库不等于报名成功，须以官方回复为准。

项目为独立开发作品，非麦当劳官方产品。活动信息、价格及供应状态以官方实时结果为准。原创 Skill 和文档以 [MIT License](LICENSE) 开源；官方参赛声明及第三方商标、服务与材料的权利归各自权利人，其使用遵循相应条款。
