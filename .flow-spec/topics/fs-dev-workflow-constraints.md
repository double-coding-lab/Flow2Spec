# fs-dev-workflow-constraints（路由摘要）

> **仅适用于 flow-spec 双仓自身**（`flow-spec-public` / `flow-spec`）。**不给下游使用**——本 topic 与对应 rules / skill 都**只**存在于本仓，**不进 `templates/`**。

## 作用

约束在 flow-spec 双仓内开发时的写盘边界与分发口径，避免「手改配置根被 init 覆盖」「双仓漂移」「未经用户同意主动跑 init」。

## 长文位置（本仓配置根手写，不进 templates）

- **Cursor**：`.cursor/rules/repo-dev-workflow-constraints.mdc`
- **Claude**：`.claude/rules/repo-dev-workflow-constraints.md`
- **Codex**：`.codex/fs-rules/repo-dev-workflow-constraints.md`

三份为同源手写副本；执行时按当前 agent 打开对应端。

## 依赖声明

执行前须先读依赖主题 `fs-git-commit`（提交前确认双仓一致涉及提交流程）。

## 核心约束（一句一条）

1. **只改 `templates/`**：所有下游会用到的规则/技能/主题/matcher/manifest 模板改动，只落 `templates/zh-CN/` 与 `templates/en-US/`。
2. **不改配置根（下游会用到的产物）**：`.claude/rules/` 等中在 `templates/` 有对应源的文件属 `init` 产物，手改会被覆盖。
3. **本仓专属手写例外**：`fs-dev-workflow-constraints`、`repo-dev-check` 等**只**在本仓的规则/技能，直接落配置根，**不进** `templates/`。
4. **用户驱动分发**：Agent **不主动**跑 `flow-spec init` / `npm run sync:agents`；由用户执行。
5. **双仓一致**：`flow-spec-public`（`@double-codeing`）与 `flow-spec`（`@ctrip`）模板正文与本仓专属手写规则须字节级一致，只允许 npm 包名与个别 remote URL 差异。

## 分发命令（用户执行）

```bash
npm run sync:agents
# 或
node ./cli.js init codex claude cursor
# 或全局装了
flow-spec init codex claude cursor
```

## 自查技能

`repo-dev-check` 用于本仓提交前自查写盘边界、双仓漂移、分发口径。触发词见该 SKILL。

## 适用场景 / 触发词

- 用户提到「双仓同步」「内仓」「外仓」「templates vs 配置根」「模板 vs 落盘」
- 用户说「不要改配置根 / 只改 templates / 我来跑 init / 我会自己 sync:agents」
- Agent 打算改配置根下与 `templates/` 有对应源的文件时须先读本 topic 与对应 rules 长文
- 双仓漂移排查、分发口径澄清

## 边界与禁止项

- **仅本仓适用**：下游项目不承担本 topic 约束，不 `Read` 也不生效。
- **不写下游可见位置**：本 topic 与关联 rules/skill 一律不落 `templates/`；`fs-kb-upgrade` 步骤 -1 / 步骤 2 的 init 分发**不带**这些文件到下游。
- 与 `fs-git-commit` 分工：本 topic 定义「提交前双仓一致」等原则；具体提交流程由 `fs-git-commit` 负责。
- `LOCAL_CONTEXT.md`、`.claude/memory/` 为本地不入库文件，不视为配置根。
