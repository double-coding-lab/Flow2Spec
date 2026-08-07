---
id: flow2spec-doctor
revision: 0
summary: "只读检查 Flow2Spec 环境、初始化、协作上下文与知识库健康"
primary: feature
confidence: inferred
tags: [module]
---
# Flow2Spec Doctor

## 适用场景

用于回答或维护 `flow2spec doctor`、项目健康检查、环境诊断、初始化完整性、协作上下文和知识库严格校验。

## 已落地能力

- `flow2spec doctor` 输出人读报告；`flow2spec doctor --json` 输出稳定结构。
- 检查 Node.js、项目配置、Agent 配置根、`developerId` / `TASK_ROOT`、`.task/` 忽略规则与知识图健康。
- 告警返回 `0`，错误返回 `1`；全程只读、离线，不提供 `--fix`。

## 维护边界

- 命令分发：`cli.js`
- 诊断实现：`lib/doctor.js`
- 自动化测试：`scripts/test-doctor.js`
- 完整事实：`.Knowledge/stock-docs/Flow2Spec-doctor诊断命令.md`
- 用户文档：`docs/命令说明.md`、`docs/en/commands-reference.md`

