---
description: flow-spec 项目开发纪律（仅本双仓适用）：修改本仓时只改 templates/，配置根由 flow-spec init / sync:agents 分发，禁止手改配置根；双仓改动须同步
---

# flow-spec 项目开发纪律（Dev Workflow Constraints）

> **仅适用于 flow-spec 双仓自身的开发**：`flow-spec-public`（`@double-codeing/flow-spec`）与 `flow-spec`（`@ctrip/flow-spec`）。
>
> **不给下游使用**：因此本规则 / 对应 skill / 对应 topic 摘要**只**存在于本仓的配置根（`.claude/` / `.cursor/` / `.codex/`）与本仓 `.flow-spec/topics/`，**不落 `templates/`**——`flow-spec init` 不会把本文件分发给下游项目。
>
> **单一事实源**：本文件为 **`fs-dev-workflow-constraints`** 的完整约定。
> - Claude：`.claude/rules/repo-dev-workflow-constraints.md`
> - Cursor：`.cursor/rules/repo-dev-workflow-constraints.mdc`
> - Codex：`.codex/fs-rules/repo-dev-workflow-constraints.md`
> - 本仓路由摘要：`.flow-spec/topics/fs-dev-workflow-constraints.md`
>
> **命名对齐**：**配置根文件名**统一用 **`repo-*`** 前缀（避开 `init` 的 `fs-` 自清理触发面）；**topic id / 路由概念名**保留 **`fs-dev-workflow-constraints`**（`manifest-routing.topicPaths` / `topicDependencies` / `topicMetadata` / matcher 已登记的稳定 id，改会连锁破坏路由并让历史里程碑失真）。两处字面不同，指向**同一条规则**。
>
> 三端配置根内容为同源手写副本；本仓内改动须**在两个仓库、三端**同步落盘。

## 硬约束一览

| 约束 | 内容 |
| --- | --- |
| **1. 只改 `templates/` 与本仓知识库** | flow-spec 双仓下要给**下游用**的内容——规则 / 技能 / manifest / matchers / topics / knowledge 模板改动——**只落**在 `templates/zh-CN/` 与 `templates/en-US/` 下（含 `rules/`、`skills/`、`knowledge/`、`AGENTS.md`、`flow-spec.config.json` 模板）。**本仓自身**的 `.flow-spec/` 与配置根**下游用不到**的内容（如本规则、`fs-dev-workflow-check` skill）**直接**落配置根 + 本仓 `.flow-spec/topics/`。 |
| **2. 不改配置根（下游会用到的规则/技能）** | **禁止**直接编辑 `.claude/rules/` / `.claude/skills/` / `.cursor/rules/` / `.cursor/skills/` / `.codex/skills/` / `.codex/fs-rules/` 中**由 `templates/` 派生**的文件、以及根目录 `AGENTS.md`——这些是 `flow-spec init` 的产物，手改会在下次 `init` / `sync:agents` 时被静默覆盖。**例外**：本规则、`fs-dev-workflow-check` skill 之类**只存在于本仓配置根**、**从不写入 `templates/`** 的文件不受此约束（它们本来就是配置根的原生手写内容）。 |
| **3. 用户驱动分发** | 模板改完后，Agent **不主动**跑 `flow-spec init` / `sync:agents`。默认交给用户执行；如果用户明确说「帮我 init」/「跑 sync」，才代跑。 |
| **4. 双仓一致** | 公开仓与内部包仓的模板正文（templates 全量）**必须字节级一致**，**只差** npm 包名（`@double-codeing/flow-spec` ↔ `@ctrip/flow-spec`）与个别 remote URL / GitLab 特有提示。本规则等「本仓专属」内容也须双仓同步（这样两个仓库的开发者都能读到同一份纪律）。 |

## 为什么这么分

flow-spec 有一个让人容易混乱的特点：**它自己就是自己的第一位用户**——本仓开发时也遵循 flow-spec 规则，本仓的 `.claude/` / `.cursor/` / `.codex/` 是 `flow-spec init` 从 `templates/` 派生出来的产物。

这就出现两类约束：

- **A 类：下游也要遵守的通用规则**（比如 `fs-git-commit`、`fs-task`、`fs-implement-tech-design`、`fs-flow-spec-unified-entry` 等）——**放 `templates/`**，`init` 时分发到所有下游项目。
- **B 类：只有 flow-spec 双仓自己需要的开发纪律**（比如「不要手改配置根」「改完记得双仓同步」「用户来跑 init」）——**只放本仓配置根 + 本仓 `.flow-spec/topics/`**，`init` **不带**到下游。

如果本规则写进 `templates/`，下游项目 `init` 时会拿到「不要手改配置根」这条——但下游的配置根就是它的运行时事实源，这条约束对它**毫无意义**且**会产生误导**。所以本规则严格保持在本仓内。

从数据流看：

```
本仓 templates/       ─┐
   ├── rules/          │  → flow-spec init → 三端配置根（同时供本仓消费 + 下游消费）
   ├── skills/         │
   └── knowledge/     ─┘

本仓配置根手写内容（本文件、fs-dev-workflow-check skill）
   └── 不进 templates，只服务本仓开发；双仓同源手写两份
```

## 目录清单

### ✅ Agent / 人工都可以改

**通用（进 templates，会分发到下游）**：
- `templates/zh-CN/**` 与 `templates/en-US/**`：包括
  - `rules/*.md`（Cursor 端 `.mdc` 由 init 转换）
  - `skills/<skill-id>/SKILL.md`
  - `AGENTS.md`（Codex 根条令模板）
  - `flow-spec.config.json`（首次 init 模板）
  - `knowledge/index.md` / `knowledge/topics/*.md` / `knowledge/matchers/*.json` / `knowledge/manifest-*.json`

**本仓专属（不进 templates）**：
- `.flow-spec/topics/*.md`、`.flow-spec/index.md`、`.flow-spec/manifest-routing.json`、`.flow-spec/matchers/*.json`、`.flow-spec/stock-docs/*.md`、`.flow-spec/req-docs/*.md`：本仓自身知识库
- **本仓专属规则 / 技能**：`.claude/rules/repo-dev-workflow-constraints.md`、`.cursor/rules/repo-dev-workflow-constraints.mdc`、`.codex/fs-rules/repo-dev-workflow-constraints.md`、`.claude/skills/fs-dev-workflow-check/`、`.cursor/skills/fs-dev-workflow-check/`、`.codex/skills/fs-dev-workflow-check/`——这些**从不进 `templates/`**，直接手写落三端配置根
- `docs/*.md` / `docs/en/*.md`、`lib/*.js`、`cli.js`、`scripts/*`、`package.json`、`README*.md`

### ❌ Agent 禁止改（下游会用到的 init 产物）

- `.claude/rules/`、`.claude/skills/` 中**由 `templates/` 派生**的文件（`fs-config-check`、`fs-flow-spec-unified-entry`、`fs-task`、`fs-kb-*` 等）
- `.claude/hooks/*.js`、`.claude/settings.json`（hook 段由 init 写）
- `.cursor/rules/*.mdc`、`.cursor/skills/*/SKILL.md`（除本仓专属条目外）
- `.cursor/hooks.json`、`.cursor/hooks/*.js`
- `.codex/fs-rules/` 中**由 `templates/rules/` 镜像**的文件、`.codex/skills/` 中**由 `templates/skills/` 派生**的文件
- `.codex/AGENTS.md`（指针文件）、`.codex/hooks.json`、`.codex/hooks/*.js`
- 根目录 `AGENTS.md`（Codex 完整条令，由 `buildCodexAgentsMd` 从 templates 拼装）

**判定捷径**：如果一份文件在 `templates/{zh-CN,en-US}/` 下有对应源，就是「下游会用到的 init 产物」，禁止手改配置根版；否则就是「本仓专属手写内容」，可以直接改配置根版。

### 例外：本地不入库文件

- `.claude/memory/`：本地记忆，会话运行时状态，不进版本，不受约束
- `LOCAL_CONTEXT.md` / `.claude/memory/dual-repo-sync.md`：本地上下文，不视为配置根

## Agent 行为准则

1. **判断改动性质**：
   - 若是**下游也要用的规则 / 技能 / 主题模板**——路径必须落 **`templates/zh-CN/` + `templates/en-US/`**（zh/en 都改）+ **双仓两份**。**禁止**用 `Edit` / `Write` 直接改配置根同名文件（哪怕当前工具的配置根就在旁边）。
   - 若是**本仓专属开发纪律 / 自查技能**（本文件、`fs-dev-workflow-check` 等）——直接手写 `.claude/` + `.cursor/` + `.codex/` 三端配置根 + `.flow-spec/topics/` 摘要 + **双仓两份**。**不进 templates**。
2. **用户指名要改 `.claude/rules/xxx.md`（且 xxx 在 templates 里有源）**：先澄清「这是 init 产物；改了会被覆盖；正确做法是改 `templates/{zh-CN,en-US}/rules/xxx.md`，然后跑 `npm run sync:agents` 或 `flow-spec init` 分发」。用户明确「就一次性临时改配置根 / 我知道会被覆盖」时才照办。
3. **改完后**：**不主动**跑 `flow-spec init` / `sync:agents`。回复里点名「**已改 templates；请你执行 `npm run sync:agents` 或 `node ./cli.js init codex claude cursor` 分发到配置根**」。用户明确让代跑时才代跑。
4. **提交前**：确认改动在**双仓两侧**都落了盘（`@double-codeing` ↔ `@ctrip` 包名差异除外）。缺一侧 → 双仓漂移，属硬约束违反。
5. **发现「配置根有改动、templates 没改」**：先判定是不是本仓专属手写内容——是的话正常；如果 templates 里有对应源，多半是漂移，把配置根改动**回填**到 `templates/*/` 对应位置再由 `init` 从模板重新分发。

## 分发命令

从最短到最全：

```bash
# package.json 里配好的脚本
npm run sync:agents

# 直接调本仓 CLI（本地开发常用）
node ./cli.js init codex claude cursor

# 全局装了 flow-spec 时
flow-spec init codex claude cursor
```

三条命令都会：从 `templates/{locale}/` 派生 → 写入配置根 `.claude/` / `.cursor/` / `.codex/` / 根 `AGENTS.md` / `.flow-spec/`（如首次）。当前 locale 取项目根 `flow-spec.config.json.locale`（本仓默认 `zh-CN`）。

**注意**：`init` **不会**动本仓专属手写文件（本规则、`fs-dev-workflow-check` skill）——这些文件在 `templates/` 里没有对应源，`init` 找不到就不写，用户手写的原始版本得以保留。

## 双仓同步义务

| 仓库 | 组织 | 包名 | remote |
| --- | --- | --- | --- |
| 公开仓 `flow-spec-public` | `@double-codeing` | `@double-codeing/flow-spec` | GitHub `Lands-1203/flow-spec` |
| 内部包仓 `flow-spec` | `@ctrip` | `@ctrip/flow-spec` | GitLab `trainH5/flow-spec` |

**同步义务**：

- `templates/`、`docs/`、`lib/`、`cli.js`、`scripts/`、`.flow-spec/`、`package.json`（版本号除外）、**本仓专属手写规则/技能**——**必须字节级一致**。只允许两处差异：
  - npm 包名 `@double-codeing/flow-spec` ↔ `@ctrip/flow-spec`
  - 个别 remote URL / GitLab 特有横幅提示
- 不允许「先改一侧，跑一段再补另一侧」——单侧改完立即同步到另一侧。
- `git tag` 双仓都要打（公开仓 `V3.2.x` 大写、内部包仓 `v3.2.x` 小写，遵守既有惯例）。

## 与其他规则的关系

- **`fs-git-commit`**（依赖主题）：本规则第 5 条「提交前须确认双仓一致」在 `fs-git-commit` 的提交流程里落地。
- **`fs-flow-spec-unified-entry`**：讲「消费侧读取顺序」；本文件讲「本仓开发时的生产侧写盘边界」。两者并存不冲突。
- **`fs-topic-authoring`**：新增 / 改 `.flow-spec/topics/<topic>.md` 时先读该规则；对**下游用**的 topic 要落 `templates/*/knowledge/topics/`，对**本仓专属**的 topic 直接落 `.flow-spec/topics/`。

## 禁止项

- 禁止 Agent 用 `Edit` / `Write` 直接改**在 `templates/` 里有对应源**的配置根文件（`.claude/rules/*`、`.claude/skills/*`、`.cursor/rules/*`、`.cursor/skills/*`、`.codex/fs-rules/*`、`.codex/skills/*`、根 `AGENTS.md`）——即便当前工具的配置根就是它们。
- 禁止把**本仓专属**规则 / 技能 / 主题写入 `templates/`（下游用不到，会造成噪音）。
- 禁止 Agent 主动跑 `flow-spec init` / `npm run sync:agents` 分发；须由用户明确得令。
- 禁止只改单侧仓库；提交前须双仓字节级一致（除包名与个别 URL）。
- 禁止把本纪律当作「使用 flow-spec 的下游项目」的通用约束——**本文件仅针对 flow-spec 双仓自身的开发**。
