---
id: f2s-dev-workflow-constraints
revision: 0
summary: "f2s-dev-workflow-constraints（路由摘要）"
primary: policy
confidence: inferred
---
# f2s-dev-workflow-constraints（路由摘要）

> **仅适用于 Flow2Spec 本仓自身**。**不给下游使用**——本 topic 与对应 rules / skill 都**只**存在于本仓，**不进 `templates/`**。

## 作用

约束在 Flow2Spec 本仓内开发时的写盘边界与分发口径，避免「手改配置根被 init 覆盖」「未经用户同意主动跑 init」。

## 长文位置（本仓配置根手写，不进 templates）

- **Cursor**：`.cursor/rules/repo-dev-workflow-constraints.mdc`
- **Claude**：`.claude/rules/repo-dev-workflow-constraints.md`
- **Codex**：`.codex/topics/repo-dev-workflow-constraints.md`

三份为同源手写副本；执行时按当前 agent 打开对应端。

## 核心约束（一句一条）

1. **只改 `templates/`**：所有下游会用到的规则/技能/主题/matcher/manifest 模板改动，只落 `templates/zh-CN/` 与 `templates/en-US/`。
2. **不改配置根（下游会用到的产物）**：`.claude/rules/` 等中在 `templates/` 有对应源的文件属 `init` 产物，手改会被覆盖。
3. **本仓专属手写例外**：`f2s-dev-workflow-constraints`、`repo-dev-check` 等**只**在本仓的规则/技能，直接落配置根，**不进** `templates/`。
4. **用户驱动分发**：Agent **不主动**跑 `flow2spec init` / `npm run sync:agents`；由用户执行。

## 分发命令(用户执行)

```bash
npm run sync:agents
# 或
node ./cli.js init codex claude cursor
# 或全局装了
flow2spec init codex claude cursor
```

## 自查技能

`repo-dev-check` 用于本仓提交前自查写盘边界与分发口径。触发词见该 SKILL。

## 适用场景 / 触发词

- 用户提到「templates vs 配置根」「模板 vs 落盘」
- 用户说「不要改配置根 / 只改 templates / 我来跑 init / 我会自己 sync:agents」
- Agent 打算改配置根下与 `templates/` 有对应源的文件时须先读本 topic 与对应 rules 长文
- 分发口径澄清

## 边界与禁止项

- **仅本仓适用**：下游项目不承担本 topic 约束，不 `Read` 也不生效。
- **不写下游可见位置**：本 topic 与关联 rules/skill 一律不落 `templates/`；`f2s-kb-upgrade` 步骤 -1 / 步骤 2 的 init 分发**不带**这些文件到下游。
- `LOCAL_CONTEXT.md`、`.claude/memory/` 为本地不入库文件，不视为配置根。

