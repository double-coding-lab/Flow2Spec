# flow-spec Knowledge Index

> **路径约定**：下文 **`.flow-spec/`**、**`manifest-routing.json`** 等路径均相对于**本仓库根目录**（即已运行 `flow-spec init` 的当前项目）。

本文件是 **人读导航**：主题说明、关联文档摘要、语义边界。
**机读事实源** 以 `.flow-spec/manifest-routing.json` + `taskToTopicRules[].matcherPath` 指向的 `.flow-spec/matchers/*.json` 分片为准（不再使用 `.flow-spec/manifest-matchers.json`）。

---

## 推荐阅读顺序

1. `.flow-spec/manifest-routing.json`（任务路由、`topicPaths`、`topicDependencies`、`fallbackTopic`）
2. 按需：由 `matcherPath` 读取 `.flow-spec/matchers/<id>.json`（`includeAny` 关键词）
3. 按需：本 `index.md`（主题语义与边界）
4. `.flow-spec/topics/<topic>.md`（执行约束与流程）
5. 按需：`.flow-spec/stock-docs/`、`.flow-spec/req-docs/`
6. 仍不足再下钻业务代码

---

## 主题一览

| 主题 | 路径 | 适用场景 | 关联文档（摘要） |
| --- | --- | --- | --- |
| implement-tech-design | `.flow-spec/topics/fs-implement-tech-design.md` | 按技术方案实现代码 | req：[技术方案](.flow-spec/req-docs/<技术方案>.md)（必填） |
| fs-doc-routing | `.flow-spec/topics/fs-stock-docs-vs-req-docs.md` | stock-docs / req-docs 目录分工 | stock：[目录边界说明](.flow-spec/stock-docs/<目录边界说明>.md)（可选） |
| fallback-triage | `.flow-spec/topics/fs-fallback-triage.md` | 未命中或低置信度：分诊与澄清 | stock：[路由分诊说明](.flow-spec/stock-docs/<分诊说明>.md)（可选） |
| config-precheck | `.flow-spec/topics/fs-config-precheck.md` | 执行 `fs-*` 前读 `flow-spec.config.json` / 编排开关（含 `intentRecognition` 意图识别）/ 更新检测 | Codex 长文：仓库根 `.codex/fs-rules/fs-config-check.md`；Claude/Cursor/Codex hooks：[路由摘要](topics/fs-config-precheck.md) |
| fs-task | `.flow-spec/topics/fs-task.md` | 变更追踪、`.task/` 任务清单与跨会话续作 | stock：[任务清单与变更追踪](stock-docs/flow-spec-任务清单与变更追踪.md)；长文：`rules/fs-task.*` |
| fs-req-plan | `.flow-spec/topics/fs-req-plan.md` | 需求/方案规划与实现；始终维护 `.task/` | 技能：`skills/fs-req-plan/SKILL.md`；依赖 `fs-task` |
| fs-git-commit | `.flow-spec/topics/fs-git-commit.md` | 提交代码；默认检查知识库覆盖，快捷提交跳过覆盖检查 | 技能：`skills/fs-git-commit/SKILL.md`；模板：[fs-git-commit](../templates/zh-CN/skills/fs-git-commit/SKILL.md) |
| flow-spec-presentations | `.flow-spec/topics/fs-flow-spec-presentations.md` | 本仓对外介绍 HTML 演示稿路径与维护约定 | stock：[对外介绍演示](stock-docs/flow-spec-对外介绍演示.md) |
| flow-spec-milestones | `.flow-spec/topics/fs-flow-spec-milestones.md` | 版本演进；含内部仓 vs 开源仓、双语 PPT、Cursor 插件 | stock：[项目里程碑](stock-docs/项目里程碑.md) |
| skill-authoring | `.flow-spec/topics/skill-authoring.md` | 新增 / 重构 `fs-*` SKILL 时的骨架与命名约定（仅本仓，不下发） | 参考实现：`templates/skills/fs-kb-addRules/SKILL.md` |
| fs-req-tech | `.flow-spec/topics/fs-req-tech.md` | 生成技术方案文档（全端通用，含后端/前端/全栈等） | 模板：[技术方案模版](template/技术方案模版.md)；技能：`skills/fs-req-tech/SKILL.md` |
| fs-dev-workflow-constraints | `.flow-spec/topics/fs-dev-workflow-constraints.md` | 开发工作流约束（仅 flow-spec 双仓自身，不给下游）：只改 templates / 不改配置根 / 用户驱动分发 / 双仓一致 | 长文：`rules/repo-dev-workflow-constraints.*`；自查技能：`skills/repo-dev-check/SKILL.md` |
| fs-kb-distill | `.flow-spec/topics/fs-kb-distill.md` | Q&A 驱动知识提取；自动判断创建新 topic 或追加现有 topic | 技能：skills/fs-kb-distill/SKILL.mdc |
| flow-spec-init-defaults | `.flow-spec/topics/fs-init-defaults.md` | `flow-spec init` 字段默认值、四处落点一致性、老项目缺字段补写、`init` 不动 stock/req/topics/matchers、manifest 两个版本字段（`projectRev` / `pkgRev`）对照 | 包源码：`lib/flowSpecConfig.js` `DEFAULTS` / `CONFIG_FIELDS`；模板：`templates/{locale}/flow-spec.config.json` |

每主题保留 **1–3 条** 可点击摘要链接；全量路径对照写入 `.flow-spec/migration-report.md`（迁移场景）。
其中 **`implement-tech-design`**、**`fs-doc-routing`**、**`config-precheck`**、**`fs-task`** 在 `topics/` 内为**路由摘要**；执行长文见配置根 **`rules/fs-*.md(c)`**；使用 Codex 时见 **`.codex/AGENTS.md`**、**`.codex/fs-rules/fs-*.md`**（`fs-config-check` 与 `AGENTS` 前置同源，按需打开）。**`fs-knowledge-preflight`** 与 **`fs-kb-feedback-closing`** 是普通问答首读 / 源码补答收口门禁，作为配置根规则 / Codex 专题长文生效，不写入 `topicPaths` 或 `taskToTopicRules`；**`fs-kb-feedback-closing`** 在 cases 1–3 建议执行 **`fs-kb-distill`**。

---

## 命中与执行（与统一入口一致）

- **路由**：`taskToTopicRules` 给出任务 → 主题集合；**关键词**在 matcher 分片的 `includeAny`。
- **依赖**：命中主主题前，按 `topicDependencies` 先读依赖主题。
- **兜底**：`fallbackTopic` 指向分诊主题（如 `fallback-triage`），仅低置信度上下文，**不得**当作最终命中直接改代码。
- **执行链**：`match → expand → verify → act`；`expand` 须含依赖展开，并保留次高候选做校验。
- **全量补检索**：仅当无命中、候选分差过小、缺口检查失败，或用户明确要求「全量检查」时允许跨 matcher 补检索。

---

## 目录职责

| 目录 | 职责 |
| --- | --- |
| `topics/` | 专题规则与执行流程 |
| `matchers/` | matcher 分片（`matcherPath` 指向） |
| `stock-docs/` | 存量沉淀（架构、终稿等） |
| `req-docs/` | 需求与技术方案（驱动实现） |
| `template/` | 终稿与方案模版 |

路由清单由 `fs-*` 技能链路维护，不依赖额外 CLI 子命令。

---

## 常见缺口怎么处理（与统一入口一致）

| 情况 | 你怎么做 |
| --- | --- |
| 有文档但没配到（1a） | 维护侧：`fs-ctx-build` / `fs-kb-sync` / `fs-doc-add` 补路由与 `includeAny`。执行侧：分诊主题澄清任务类型，**不**用全仓扫替代 manifest。 |
| 配到了但不够（1b） | 走依赖与次高候选 → `verify` 点名缺哪篇文档；仍缺则向用户要路径或补 `req-docs`。 |
| 库里没有（2） | 承认缺口 → 代码下钻或请用户补需求/方案文档。 |
| 反复读 manifest 费 token（2a） | 同一任务线内 routing 只当快照；只读命中项的单个 matcher；不遍历整个 `matchers/` 目录枚举；`index.md` 勿与 routing 循环互刷。 |

**说明**：「路由/知识已更新」指 `fs-*`（如 `fs-ctx-build`、`fs-kb-sync`、`fs-doc-add`、`fs-kb-fix` 等）产出或手改 `manifest-routing` / `matchers` 分片；**`flow-spec init` 不撰写业务文档**，以模板补齐与配置根落盘为主，勿与知识库内容更新混为一谈。
