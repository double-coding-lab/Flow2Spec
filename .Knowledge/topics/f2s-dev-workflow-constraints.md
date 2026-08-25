---
id: f2s-dev-workflow-constraints
revision: 2
summary: "f2s-dev-workflow-constraints（路由摘要）"
primary: policy
confidence: inferred
---
# f2s-dev-workflow-constraints（路由摘要）

> **仅适用于 Flow2Spec 本仓自身**。**不给下游使用**——本 topic 与对应 rules / skill 都**只**存在于本仓,**不进 `templates/`**。

## 作用

约束在 Flow2Spec 本仓内开发时的写盘边界与分发口径,避免「手改配置根被 init 覆盖」「未经用户同意主动跑 init」「手改 core templates 副本」。

## 长文位置(本仓配置根手写,不进 templates)

- **Cursor**:`.cursor/rules/repo-dev-workflow-constraints.mdc`
- **Claude**:`.claude/rules/repo-dev-workflow-constraints.md`
- **Codex**:`.codex/topics/repo-dev-workflow-constraints.md`

三份为同源手写副本；执行时按当前 agent 打开对应端。

## 核心约束(一句一条)

1. **只改 `templates/`**：所有下游会用到的规则/技能/主题/matcher/manifest 模板改动,只落 `templates/zh-CN/` 与 `templates/en-US/`(workspace 根)。
2. **不改配置根(下游会用到的产物)**：`.claude/rules/` 等中在 `templates/` 有对应源的文件属 `init` 产物,手改会被覆盖。
3. **本仓专属手写例外**：`f2s-dev-workflow-constraints`、`repo-dev-check` 等**只**在本仓的规则/技能,直接落配置根,**不进** `templates/`。
4. **用户驱动分发**：Agent **不主动**跑 `flow2spec init` / `npm run sync:agents`；由用户执行。
5. **不改 `packages/core/templates/`**：它是 `scripts/sync-core-templates.js` 从根 `templates/` 自动生成的 npm 发布物副本,已进 `.gitignore`,下次同步会被覆盖。

## 模板双份关系(重要)

- **根 `templates/`**：唯一手写事实源,进 git,日常改这里。
- **`packages/core/templates/`**：npm 发布副本,不进 git,由 `scripts/sync-core-templates.js` 生成;运行时 `packages/core/index.js` 通过 `__dirname` 读它,因此 core 包必须自带这份(否则用户 `npm install` 后 `flow2spec init` 会 `ENOENT`)。
- 自动同步触发点:`sync:agents` / `test` / `pack:check` 静默同步；`packages/core` 的 `prepack` 在 `npm pack` / `npm publish` 前同步；`sync:core-templates:check` 做纯校验。

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
- 用户问「根 templates 与 core templates 是什么关系」「core templates 冗余吗」
- 分发口径澄清

## 边界与禁止项

- **仅本仓适用**：下游项目不承担本 topic 约束,不 `Read` 也不生效。
- **不写下游可见位置**：本 topic 与关联 rules/skill 一律不落 `templates/`；`f2s-kb-upgrade` 步骤 -1 / 步骤 2 的 init 分发**不带**这些文件到下游。
- `LOCAL_CONTEXT.md`、`.claude/memory/` 为本地不入库文件,不视为配置根。
- **禁止手改 `packages/core/templates/`**——它由脚本从根 templates 生成,下次同步会覆盖。

## npm workspace 发布门禁

- 主 CLI 包 `@double-coding/flow2spec` 的 `packages/cli/README.md` 与根 `README.md` 保持完全一致；Core 包维护面向程序化调用的独立 README。
- Core、CLI 与 workspace 根版本保持一致,CLI 固定依赖同版本 Core。
- 发布前运行 `npm run pack:check` 与 `node scripts/test-package-install.js`,并从 CLI tarball 校验 README,确保 npm 页面保留完整产品文档。
- `packages/core/templates/` 由 `scripts/sync-core-templates.js` 生成,`prepack` 自动触发,tarball 内始终包含最新模板；CI/pre-release 建议跑 `npm run sync:core-templates:check` 做漂移检查。
