# f2s 技能前置强制步骤

**执行任何 `f2s-*` 技能的第一个动作，必须用 Read 工具读取项目根 `flow2spec.config.json`**，获取 `subAgent` 与 `switchAgentVerification` 的实际值，再决定后续编排方式。

```
必须执行：Read("flow2spec.config.json")  ← 技能正文任何步骤之前
```

| 读取结果 | 行为 |
|---------|------|
| `subAgent: true` | 先显式判断当前技能是否满足拆子前提 / 规模阈值；满足时按技能 SKILL.md 的 B/C 模式派子 agent，并在回复或执行记录中写明「本次是否拆子、拆给谁、为什么」；不满足时主 agent 继续完成，但也必须输出不拆原因 |
| `subAgent: false` | 全部在主 agent 内完成，不得拆子 agent |
| `switchAgentVerification: true` | 子 agent 落盘的由主 agent 校验；主 agent 落盘的由子 agent 校验（须 subAgent=true 且已拆子任务） |
| `switchAgentVerification: false` | 落盘侧自验，不交叉 |
| 文件不存在 | 所有字段均视为 `false` |

**Claude Code**：`f2s-config-session` 在 `SessionStart` 注入一次配置摘要；`f2s-config-inject` 在 `PreToolUse` 仅作为守门提示，提醒调用 `f2s-*` Skill 前首步必须 `Read("flow2spec.config.json")`。两者都**不替代**本条 Read 要求。

**Cursor**：配置读取仍走文本约束（本规则 `alwaysApply`），不依赖 hook 自动读取配置。

**Codex**：`SessionStart` 会注入一次配置摘要；进入 `f2s-*` Skill 正文前仍必须 `Read("flow2spec.config.json")`，且当 `subAgent=true` 时，主 agent **必须先显式判断**当前技能是否满足拆子前提 / 阈值，再决定是否派子；即使判断不拆，也必须输出不拆原因。Codex **没有** Claude 的 `PreToolUse Skill` 守门，不能把“拆子判断”留给隐式心证。

### changeTracking（变更追踪）

| 字段 | 生效技能 | 行为 |
|------|---------|------|
| `changeTracking.feat: true` | `f2s-kb-feat` | **步骤 0 必须执行**：创建或续作 `.task/active/` 变更追踪任务 |
| `changeTracking.feat: false` | `f2s-kb-feat` | 步骤 0 跳过，不创建 `.task/` 目录 |
| `changeTracking.fix: true` | `f2s-kb-fix` | **步骤 0 必须执行**：创建或续作 `.task/active/` 变更追踪任务 |
| `changeTracking.fix: false` | `f2s-kb-fix` | 步骤 0 跳过，不创建 `.task/` 目录 |
| `changeTracking.implement: true` | `f2s-implement-tech-design` | **步骤 2.5 写入任务清单、步骤 2.6 随实现同步打钩 `task.md`、步骤 5 满足归档门禁后归档** |
| `changeTracking.implement: false` | `f2s-implement-tech-design` | 步骤 2.5、2.6 和步骤 5 的变更追踪部分跳过 |

### intentRecognition（意图识别）

| 字段 | 行为 |
|------|------|
| `intentRecognition: true` | 启用意图识别：高置信操作意图按 `rules/f2s-intent-routing.*` 自动进入对应 Skill；讨论 / 评估 / 低置信输入不得自动调用 |
| `intentRecognition: false` | 不启用自动分流；仅显式 `$f2s-*` / 明确要求执行某技能时进入对应 Skill |
| 字段不存在 | 视为 `false` |

**禁止在未读该文件的情况下进入技能正文的任何执行步骤。**
