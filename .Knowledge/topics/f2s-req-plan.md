# f2s-req-plan（路由摘要）

> 长文见配置根 **`skills/f2s-req-plan/SKILL.md`**。  
> **`.task/` 真值源**：配置根 **`rules/f2s-task.*`**（Codex：`.codex/f2s-rules/f2s-task.md`）。  
> 设计背景：[Flow2Spec 任务清单与变更追踪](../stock-docs/Flow2Spec-任务清单与变更追踪.md)。

## 依赖

执行本主题前须先读依赖主题 **`f2s-task`**（`manifest-routing.topicDependencies`）。

## 作用

从技术方案或需求描述出发：**续作分诊 → 草稿确认 → 按 f2s-task 落盘 → 实现 → 归档**。

1. 步骤 0：`flow2spec.config.json` + **`f2s-task` 全文**
2. `f2s-task`「任务开始」：检查 `todo.json` / keywords 续作
3. 草稿确认（主 agent）
4. 落盘 `task.md` / `context.md` / `user-todos.md` / `todo.json`（`linkedSkill: f2s-req-plan`）
5. 实现并按步打钩；用户代办写 `user-todos.md`
6. 满足归档门禁后移入 `completed/<YYYYMMDD>-<task-name>/`

不依赖 `changeTracking`，但 **始终** 服从 `f2s-task`。

## 下一步

- 技能全文：`skills/f2s-req-plan/SKILL.md`
- 任务规则：`rules/f2s-task.*` 或 `.codex/f2s-rules/f2s-task.md`
