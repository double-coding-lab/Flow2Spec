---
id: flow2spec-dsh-adapter
revision: 0
summary: "DeepSeek Harness 项目级技能初始化与目录适配"
primary: feature
confidence: inferred
tags: [module]
---
# DeepSeek Harness 适配

## 适用场景

用于 `flow2spec init dsh`、DeepSeek Harness 技能发现、`.dsh/skills`、`.dsh/topics` 和根 `AGENTS.md` 入口问题。

## 已落地能力

- `flow2spec init dsh` 将 Flow2Spec 技能复制到 `.dsh/skills/<skill-name>/SKILL.md`。
- 将模板规则长文镜像到 `.dsh/topics/*.md`，并写入 `.dsh/AGENTS.md` 目录指针。
- 根目录没有 `AGENTS.md` 时生成 Harness 兼容的完整入口；已有入口不会被覆盖。
- 原生 Cordis 插件不在本适配范围内，属于后续路线图事项。

## 维护边界

- Agent 注册：`lib/agents.js`
- 初始化适配：`lib/init.js`、`lib/dshAgentsAdapter.js`
- 诊断与回归：`lib/doctor.js`、`scripts/test-dsh-init.js`
- 用户文档：`docs/使用说明.md`、`docs/en/usage-guide.md`、`docs/目录与路径约定.md`
