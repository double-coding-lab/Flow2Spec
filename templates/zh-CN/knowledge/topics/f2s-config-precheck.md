# config-precheck（路由摘要）

## 本主题作用

- 供 `manifest-routing.topicPaths` 锚定主题 id **`config-precheck`**。
- 与执行任意 **`f2s-*` 技能**前读取项目根 **`flow2spec.config.json`**（`subAgent`、`switchAgentVerification`、`changeTracking`）相关；语义与仓库根 **`AGENTS.md`** 顶部、「统一入口」一致。

## 完整条令（按需，勿在 `.Knowledge` 再维护第二份正文）

| 侧 | 路径 |
| --- | --- |
| Codex | 仓库根 `.codex/f2s-rules/f2s-config-check.md`（init 镜像，与模板同源）；SessionStart：`.codex/hooks/f2s-config-session.js` |
| Cursor | 仓库根 `.cursor/rules/f2s-config-check.mdc`（`flow2spec init cursor`） |
| Claude | `.claude/rules/f2s-config-check.md`；SessionStart：`.claude/hooks/f2s-config-session.js`；PreToolUse 守门：`.claude/hooks/f2s-config-inject.js` |

## 必备步骤

1. 用 **Read** 打开项目根 **`flow2spec.config.json`**（须在 `f2s-*` 技能正文任何步骤之前）。
2. 仓库根 **`AGENTS.md`** 中 `{{FLOW2SPEC_PROJECT_CONFIG}}` 表仅说明字段语义；当前值以 **Read** 结果为准。
3. `subAgent=true` 时，主 agent 必须在进入技能正文早期**显式判断**本次是否满足拆子前提 / 阈值；即使判断不拆，也必须输出不拆原因。SessionStart 摘要只负责提醒，不替代该判断。

## 禁止项

- 禁止在未读 **`flow2spec.config.json`** 的情况下进入 **`f2s-*`** 技能正文步骤（与 `AGENTS`、`.codex/f2s-rules/f2s-config-check.md` 一致）；Claude / Codex 的 SessionStart 摘要与 Claude 的 PreToolUse 守门提示都不替代本次 Read。
