# flow-spec 架构说明（终稿）

> 适用：flow-spec 包本身。
> 本终稿由 `fs-doc-final` 从初稿转换而来，可用于 `fs-kb-build` 同步知识路由。

---

## 核心概念

| 概念 | 说明 |
| --- | --- |
| **flow-spec** | CLI 工具包（`@double-codeing/flow-spec`），用于在业务仓库初始化并维护一套可持续的 AI 协作结构。Node.js >= 16，零外部运行时依赖。 |
| **`.flow-spec/`** | 业务知识库根目录，统一承载 `stock-docs`（存量文档）、`req-docs`（需求/技术方案）、`topics`（主题路由摘要）、`matchers`（匹配词分片）、`index.md`（人读导航）、`manifest-routing.json`（机读路由事实源）。 |
| **配置根** | 各 AI 工具原生配置目录：`.cursor/`（Cursor）、`.claude/`（Claude Code）、`.codex/`（Codex）。保留 `rules/` 或 `skills/`，不破坏原生加载机制。 |
| **Agent** | 支持的 AI 工具类型：cursor、claude、codex；由 `lib/agents.js` 定义其目录结构与格式差异。 |
| **`fs-*` 技能** | 14 个知识库维护技能（如 `fs-doc-arch`、`fs-kb-sync`、`fs-kb-build` 等），以 `SKILL.md` 形式存在于 `templates/skills/` 与各配置根 `skills/` 中。 |
| **机读路由** | `.flow-spec/manifest-routing.json` + `matchers/*.json` 分片，是任务路由的第一优先级事实源；`index.md` 仅作人读导航，不替代机读链。 |
| **`flow-spec.config.json`** | 项目根配置文件，含 `subAgent`（是否允许拆子 agent）与 `switchAgentVerification`（是否交叉校验）两个布尔开关，供所有 `fs-*` 技能读取。 |
| **终稿** | 经 `fs-doc-final` 转换后的规范格式文档，存放于 `.flow-spec/stock-docs/<方案名>_终稿.md`，便于 `fs-kb-build` 同步到 `topics/index/manifest`。 |

---

## 业务规则

- **目录职责分离**：`.flow-spec/` 承载业务文档与路由索引，不承载配置根规则执行文件；`rules/skills` 保留在各配置根，保证各 AI 工具可按原生方式加载。
- **产品仓 Agent 修包边界**：在本**包开发仓**内由 Agent 改能力时，只动 `templates/`、`lib/` 等交付物，**不修改** `.cursor/`、`.claude/`、`.codex/` 配置根（避免与 templates 变更混在同一 diff）。约定写在 [flow-spec-产品仓-Agent修包边界.md](flow-spec-产品仓-Agent修包边界.md)，**不**并入 `templates/skills`；需刷新三端时由人执行 **`flow-spec init`** / **`fs-kb-upgrade`**。
- **Codex 差异化**：Codex 不读取 `rules/` 目录，统一通过 `.codex/AGENTS.md` + `skills/` 承载约束与技能入口；`AGENTS.md` 由 `codexAgentsAdapter.js` 动态生成。
- **Claude 格式适配**：Claude Code 规则文件扩展名为 `.md`（非 `.mdc`），路径范围用 `paths`（非 `globs`），由 `claudeRulesAdapter.js` 在 `init` 时自动转换。
- **渐进式读取顺序（必须）**：`manifest-routing.json` → `matcherPath` 分片 → `topics/` → `stock-docs/req-docs/` → 业务代码；禁止跳过路由直接全仓检索。
- **机读 vs 人读分离**：`manifest-routing.json` 为机读事实源；`index.md` 仅作人读导航与语义边界校验，不承载机读字段定义。
- **`init` 定位**：仅做模板与配置根落盘、结构对齐，不替代 `fs-*` 技能对业务文档与路由内容的写入；业务知识库升级由 `fs-kb-upgrade` 负责。
- **`stock-docs` 禁止直接编码**：按方案实现代码应使用 `.flow-spec/req-docs/` 中的技术方案，禁止把 `stock-docs` 作为直接编码输入。
- **`fallbackTopic` 仅兜底**：`fallback-triage` 用于低置信度分诊与澄清，不得当作最终命中直接实施改动。

---

## CLI 命令

| 命令 | 说明 |
| --- | --- |
| `flow-spec init [agent…] [flags]` | 项目初始化/结构对齐 |
| `flow-spec config` | 打印解析后的配置（含缺省值合并） |
| `flow-spec version` | 输出当前版本号（等价 `--version` / `-v`） |
| `flow-spec update` | 比对 registry 最新版并全局更新 |

---

## 关键流程

### 流程一：项目初始化（推荐 `npx @double-codeing/flow-spec@latest init`）

在业务仓库根执行 **`npx @double-codeing/flow-spec@latest init [cursor|claude|codex …] [--reset-knowledge]`**；若已 **`npm install -g @double-codeing/flow-spec@latest`**，可使用等价的 **`flow-spec init …`**。

1. **补齐配置**：若项目根不存在 `flow-spec.config.json`，从包模板补齐（默认 `subAgent=false`, `switchAgentVerification=false`）；已存在则不覆盖。
2. **创建知识库目录**：创建 `.flow-spec/` 及其子目录（`stock-docs`、`req-docs`、`matchers` 等）。
3. **复制模板**：从 `templates/knowledge/` 复制模板到 `.flow-spec/`（支持增量写入；`--reset-knowledge` 时强制覆盖）。
4. **路由对齐**：`manifest-routing.json` + `matchers/*.json` 增量对齐（schema 版本检查）。
5. **写入 Agent 配置根**：
   - Cursor：`.cursor/rules/`（.mdc 原样）+ `.cursor/skills/`
   - Claude：`.claude/rules/`（.mdc → .md 转换）+ `.claude/skills/`
   - Codex：`.codex/AGENTS.md`（动态生成）+ `.codex/skills/`

**入口**：`cli.js` → `lib/init.js` → `lib/agents.js` + `lib/flowSpecConfig.js` + 格式适配器

### 流程二：上下文沉淀工作流

1. **架构初稿**：`fs-doc-arch` 生成 `.flow-spec/stock-docs/<方案名>_初稿.md`
2. **终稿转换**：`fs-doc-final` 将初稿转为规范格式 `.flow-spec/stock-docs/<方案名>_终稿.md`
3. **知识同步**：`fs-kb-build` 将终稿同步到 `.flow-spec/topics/`、`index.md`，并更新路由清单

**入口**：用户执行 `/fs-doc-arch` → `/fs-doc-final` → `/fs-kb-build`

### 流程三：按方案实现工作流

1. **需求澄清**：`fs-req-clarify` 针对 PRD/需求反问直到清楚
2. **技术方案**：`fs-req-tech` 基于知识库生成技术方案文档，写入 `.flow-spec/req-docs/`
3. **方案实现**：`implement-tech-design` 读取 `req-docs` 中的技术方案并执行编码

**入口**：用户执行 `/fs-req-clarify` → `/fs-req-tech` → 命中 `implement-tech-design` 主题

### 流程四：知识库维护工作流

| 场景 | 技能 |
| --- | --- |
| 修正实现/规则错误 | `fs-kb-fix` |
| 新增能力（补全实现 + 知识库） | `fs-kb-feat` |
| 全局同步已实现能力 | `fs-kb-sync` |
| 从 stock-docs 生成主题路由（含拆分评估） | `fs-kb-build`（stock-doc > 300–500 行或覆盖 3+ 职责域时提示拆分） |
| 解决合并后上下文冲突 | `fs-kb-merge` |
| 知识库模板升级 | `fs-kb-upgrade`（其中一步代跑 `npx @double-codeing/flow-spec@latest init`，或已全局安装时的 `flow-spec init`） |
| 旧版一次性迁移 | `fs-kb-migrate` |

### 流程五：任务路由与执行（`match → expand → verify → act`）

1. **match**：读取 `manifest-routing.json`，按 `taskToTopicRules` 与 `matcherPath` 的 `includeAny` 命中主候选主题
2. **expand**：展开 `topicDependencies`（如 `implement-tech-design` 依赖 `fs-doc-routing`），保留次高候选做补充校验
3. **verify**：执行前缺口检查（关键主题、边界条件、上下文文档是否缺失）
4. **act**：仅当置信度足够时执行；低置信度必须先澄清

---

## 接口 / 命令

| 命令 | 说明 | 入口 |
| --- | --- | --- |
| `npx @double-codeing/flow-spec@latest init [agent ...] [--reset-knowledge]`（全局安装后可用 `flow-spec init …`） | 初始化 `.flow-spec/` 与各 agent 配置根 | `cli.js` |
| `flow-spec config` | 打印合并缺省后的配置解析结果 | `cli.js` |
| `flow-spec --help` | 显示帮助信息 | `cli.js` |

---

## 配置

**项目根 `flow-spec.config.json`**（`init` 缺失时从模板补齐）：

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `subAgent` | boolean | false | 技能规定用子 agent 的步骤：`true` 执行，`false` 全在主会话完成 |
| `switchAgentVerification` | boolean | false | 切换 agent 校验：`false` 时落盘侧同会话内验；`true` 且技能写明依赖时交叉验 |
| `intentRecognition` | boolean | false | 意图识别：`true` 时仅高置信操作意图可按 `rules/fs-intent-routing.*` 自动进入对应 Skill；`false` 时不启用自动分流 |
| `changeTracking.feat` | boolean | true | `fs-kb-feat` 变更追踪开关 |
| `changeTracking.fix` | boolean | false | `fs-kb-fix` 变更追踪开关 |
| `changeTracking.implement` | boolean | true | `fs-implement-tech-design` 变更追踪开关 |

- 旧键名 `subAgentVerification` 仍可被兼容解析

---

## 实现位置与对接方式

### 核心模块位置

| 模块 | 路径 | 职责 |
| --- | --- | --- |
| CLI 入口 | `cli.js` | 命令解析与分发（init / config / --help） |
| Init 实现 | `lib/init.js` | 模板落盘、目录创建、路由对齐、Agent 配置写入 |
| Agent 定义 | `lib/agents.js` | 三类 Agent 的目录结构与格式差异定义 |
| 配置读写 | `lib/flowSpecConfig.js` | `flow-spec.config.json` 解析、缺省值合并、旧键兼容 |
| Claude 适配 | `lib/claudeRulesAdapter.js` | `.mdc` → `.md` 格式转换（globs→paths、去除 alwaysApply） |
| Codex 适配 | `lib/codexAgentsAdapter.js` | 扫描技能 frontmatter 生成摘要，渲染项目配置到 AGENTS.md |
| 包内模板 | `templates/` | knowledge 模板、rules 模板（.mdc）、skills 模板（14 个） |
| 用户文档 | `docs/` | 面向用户的使用说明、路径约定、体系原理、可行性分析等 |

### 新项目接入方式

1. 在目标业务仓库执行：`npx @double-codeing/flow-spec@latest init [cursor|claude|codex]`
2. 检查项目根 `flow-spec.config.json`，按需调整 `subAgent` / `switchAgentVerification`
3. 使用 `fs-doc-arch` → `fs-doc-final` → `fs-kb-build` 沉淀项目上下文
4. 使用 `fs-req-clarify` → `fs-req-tech` 生成技术方案，再由 `implement-tech-design` 执行编码
5. 使用 `fs-kb-sync` / `fs-kb-add` 维护已落地能力

---

## 状态与流转

（本说明无状态机，见「关键流程」中的各工作流。）
