---
id: config-precheck
revision: 0
summary: "f2s 技能执行前必读 flow2spec.config.json 的开关口径"
primary: config
confidence: manual
tags: [policy]
---
# config-precheck（路由摘要）

## 本主题作用

- 供 `manifest-routing.topicPaths` 锚定主题 id **`config-precheck`**。
- 与执行任意 **`f2s-*` 技能**前读取项目根 **`flow2spec.config.json`**（`subAgent`、`switchAgentVerification`、`changeTracking`、`intentRecognition`、`updateCheck`）相关；语义与 **`AGENTS.md`** 顶部、「统一入口」一致。
- 同时记录 Claude / Cursor / Codex 三端对“配置读取提醒”和“自动更新检测”的分工，避免把 hooks 注入误认为替代显式 Read。

## 完整条令（按需，勿在 `.Knowledge` 再维护第二份正文）

| 侧 | 路径 |
| --- | --- |
| Codex | 仓库根 `.codex/topics/f2s-config-check.md`（init 镜像，与模板同源）；SessionStart：`.codex/hooks/f2s-config-session.js` |
| Cursor | 仓库根 `.cursor/rules/f2s-config-check.mdc`（`flow2spec init cursor`） |
| Claude | `.claude/rules/f2s-config-check.md`；SessionStart：`.claude/hooks/f2s-config-session.js`；PreToolUse 守门：`.claude/hooks/f2s-config-inject.js` |
| 包模板 | `templates/rules/f2s-config-check.mdc` |

## 必备步骤

1. 用 **Read** 打开项目根 **`flow2spec.config.json`**（须在 `f2s-*` 技能正文任何步骤之前）。
2. **`AGENTS.md`** / `.codex/topics/f2s-config-check.md` 中的配置表仅说明字段语义；当前值以 **Read** 结果为准。
3. Claude / Codex 的 `SessionStart` 配置摘要与 Claude 的 `PreToolUse Skill` 提醒只做注入 / 提醒；不得替代第 1 步的显式读取。

## 三端分工

| 侧 | 配置读取约束 | 自动更新检测 |
| --- | --- | --- |
| Claude | `SessionStart` 输出配置摘要；`PreToolUse Skill` 提醒技能前先 Read `flow2spec.config.json` | `SessionStart` 执行 `.claude/hooks/f2s-update-check.js` |
| Cursor | 通过 `.cursor/rules/f2s-config-check.mdc` 文本约束技能前先读配置 | `sessionStart` 执行 `.cursor/hooks/f2s-update-check.js`，通过 `additional_context` 注入提示 |
| Codex | `SessionStart` 输出配置摘要；通过根 `AGENTS.md` 与 `.codex/topics/f2s-config-check.md` 文本约束技能前先读配置 | `SessionStart`（`startup|resume`）执行 `.codex/hooks/f2s-update-check.js`，通过 `hookSpecificOutput.additionalContext` 注入提示 |

## intentRecognition（意图识别自动分流）

| 字段 | 行为 |
| --- | --- |
| `intentRecognition: true` | 启用意图识别：高置信操作意图按 `rules/f2s-intent-routing.*` 自动进入对应 Skill；讨论 / 评估 / 低置信输入不得自动调用 |
| `intentRecognition: false` | 不启用自动分流；仅显式 `$f2s-*` / 明确要求执行某技能时进入对应 Skill |
| 字段不存在 | 视为 `false` |

- 完整路由规则：`rules/f2s-intent-routing.*`（Claude/Cursor）；`.codex/topics/f2s-intent-routing.md`（Codex）。
- `f2s-intent-routing` 属内部行为规则，不作为独立 topic 路由，不写入 `topicPaths` / `taskToTopicRules`。

## 禁止项

- 禁止在未读 **`flow2spec.config.json`** 的情况下进入 **`f2s-*`** 技能正文步骤（与 `AGENTS`、`.codex/topics/f2s-config-check.md` 一致）。
- 禁止因为 hooks 已输出配置摘要，就跳过技能开始时的 `flow2spec.config.json` 显式读取。
- 禁止在 `intentRecognition` 未读取或为 `false` 时自动调用任何 Skill。
