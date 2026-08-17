---
name: f2s-kb-build
description: 根据 .Knowledge/stock-docs 文档生成知识路由主题与索引；触发：生成项目上下文、f2s-kb-build、终稿生成上下文
---

> 执行口径：本技能只维护 `.Knowledge`（`topics/index/manifest-routing/matchers` 分片），不改配置根 `rules/skills`。不再维护 `.Knowledge/manifest-matchers.json`（已废弃聚合文件；`flow2spec init` 会删除遗留副本）。

# 根据文档生成项目上下文（topics/index/路由清单）

## 编排（主 / 子 agent）

- 两字段（`subAgent` / `switchAgentVerification`）语义以统一入口为唯一事实源：**Cursor/Claude** 读配置根 `rules/f2s-flow2spec-unified-entry.*`；**Codex** 读 `.codex/topics/f2s-flow2spec-unified-entry.md`（与上同源，`flow2spec init` 镜像）。本 SKILL 不复述。
- **首选分支（小变更 → 主全流程）**：当本次改动 **≤ 2 个新 / 改主题**，**且 ≤ 1 个新 matcher**，**且无跨主题批量引用调整** 时，全流程在主 agent 完成，不拆子。
- **中大变更分支**（`subAgent=true` 且超出上述阈值）：
  - 主 agent 在主会话中列出**文件级契约**：子 A 只写 `.Knowledge/topics/<foo>.md`，子 B 只写 `.Knowledge/matchers/<m-foo>.json`，路径互不重叠；
  - 子 agent 仅落盘契约内文件，不跨边界；
  - **主 agent 单点**编辑 `.Knowledge/manifest-routing.json` / `.Knowledge/index.md`（补 `taskToTopicRules`、`topicPaths`、`matcherPath`、`topicDependencies`、`topicMetadata`）；
  - 主 agent 做整体验收。
- **不推荐**：单个子 agent 同时改 manifest / index / 多份 topics / matchers；以及「子 A 写、子 B 验」。
- **「一子写、主验」**：仅在交付边界极窄（例如只产出 1 个新 matcher 分片草稿，manifest 引用仍由主写）时可接受。
- **写权硬约束**：`.Knowledge/manifest-routing.json`（含 `topicMetadata`）/ `.Knowledge/index.md` **恒由主 agent 落盘**，子 agent 不得触碰。
- 默认落盘侧 agent 自验；本 SKILL 不绑定交叉校验。

## 输入

- 接收一个参数：URL 或本地路径。
- 本地路径必须位于 `.Knowledge/stock-docs/`。
- **须为终稿**：推荐文件名含 `_终稿.md`，或已由 **`f2s-doc-final`** 规范化；**禁止**以 `f2s-doc-arch` 产出的 `*_初稿.md` 作为入参直接执行本技能。
- 若入参路径含 **`_初稿`**、或用户刚完成架构初稿尚未执行 `f2s-doc-final`：**停止**，回复须先执行 **`f2s-doc-final <初稿路径>`**，待终稿落盘后再以终稿路径调用本技能。
- 若传入 `.Knowledge/req-docs/`，提示用户先整理为 `stock-docs` 终稿后再执行。

## 生成原则

1. **拆解**：文档较长或包含多块独立能力时，拆分为多个 topic；避免把无关能力塞到同一主题。
2. **分工**：
  - `topics/`：规则与流程正文（可执行知识）
  - `index.md`：主题索引与语义说明（人读入口）
  - `manifest-routing.json` + `taskToTopicRules[].matcherPath` 指向的 `matchers/*.json`：任务路由与关键词词表（机读入口）

## 步骤 1：获取文档内容

- URL：抓取正文；无法访问时提示用户先落地到 `.Knowledge/stock-docs/*.md`。
- 本地路径：读取 Markdown 文档，提炼主题与能力边界。

## 步骤 2：语义分析（必须）

从文档中提炼：

- 主题名与主题意图（可形成 topic id）
- 核心概念与关键流程
- 业务规则与边界条件
- 任务触发词（写入对应 `matchers/<matcherId>.json` 的 `includeAny`）
- 与现有主题的依赖关系（用于 `topicDependencies`）

> **创作侧准则**：本步骤涉及新增 / 修改 topic 与 `topicDependencies`，**须先 Read** `rules/f2s-topic-authoring.*` 全文（**Cursor/Claude**：`rules/f2s-topic-authoring.mdc`；**Codex**：`.codex/topics/f2s-topic-authoring.md`），再继续步骤 3 / 步骤 5。命名、骨架、依赖判定、DAG 最小化、判定时机均以该条为准，本 SKILL 不复述。

> **拆分评估**：若输入 stock-doc 超过 **300–500 行**，或语义分析后发现覆盖 **3 个以上不相干职责域**，须在输出摘要中说明：建议拆成多份 focused stock-doc（各自对应一个独立 topic），用户确认后再分批执行；若用户选择继续生成单个大 topic，不阻断，但在摘要中记录"主题偏大，建议后续拆分"。大功能主 topic 写业务闭环/入口/子模块 stock-doc 导航链接；子模块 topic 各自独立命中，**不通过 `topicDependencies` 串联概述与详情**。

## 步骤 3：写入 topics

- 目标路径：`.Knowledge/topics/<topic>.md`
- 若已存在同主题：优先增量更新，避免重复主题。
- 若为新主题：新增文件并补充清晰标题、适用场景、规则与流程。

## 步骤 4：更新 index

- 更新 `.Knowledge/index.md` 的主题路由表。
- 保证“同主题单行”。
- 主题路由表需维护“关联文档（摘要）”列：每个主题补充 1-3 条关键文档**可点击 Markdown 链接**（格式：`[标题](相对路径)`，优先 `stock-docs/req-docs`）。
- 若某主题暂无可公开文档，写“无”或“待补充”，禁止留空导致歧义。
- 若新增/删除主题，索引同步调整，避免孤儿路径。

## 步骤 5：更新路由清单（按需）

- 本步骤由主 agent 落盘（写权硬约束），子 agent 不得执行。
- 更新 `manifest-routing.topicPaths`（topicId -> topic 文件路径）
- 更新 `manifest-routing.taskToTopicRules[]`（任务到主题集合 + matcherId）
- 更新 `manifest-routing.topicDependencies`（先读依赖后读主主题）
- 更新 `manifest-routing.topicMetadata`（按需）：仅给已存在或本次确认创建的 topicId 写入 `{ "primary": "feature|module|config|policy", "tags": ["..."], "confidence": "manual|inferred" }`；`tags` 可省略，且不得与 `primary` 重复。分类只用于治理、审计和阅读预期，不参与路由命中或执行强制性。新建 topic 时有明确证据可写 `inferred`；用户确认后才写 `manual`；证据不足时不写 metadata，并在摘要列为待确认。不得为了分类创建、重命名或拆分 topic。
- 更新 `matchers/<matcherId>.json` 的 `includeAny`（关键词词表；路径须与 `taskToTopicRules[].matcherPath` 一致）
- 校验 `fallbackTopic`、`topicPaths`、`matcherId` 引用有效
- 仅做最小改动，不重写无关字段

## 路径与引用约束

- `sourceDoc` 或文档引用统一指向 `.Knowledge/stock-docs/<文件名>.md`
- 禁止把 `.Knowledge/req-docs/` 作为 topic 的 `sourceDoc`
- 禁止改写配置根 `rules/skills`

## 输出摘要（必须）

- 新增/更新的 topic 文件
- `index` 更新项
- 路由清单更新项（如有）
- 失败或跳过项及原因

## 复杂场景示例

用户输入：`f2s-kb-build .Knowledge/stock-docs/<能力>_终稿.md`，且现有 `topics/<能力>.md` 已存在。

- 若新文档与现有 `<能力>` 主题高度重合：原位更新 `topics/<能力>.md`，不要新建 `<能力>-v2.md`。
- 若新文档新增子能力：可新增 `topics/<能力>-<子域>.md`，并在 `manifest-routing.topicDependencies` 中声明依赖关系。
- 更新后同步 `index` 与路由清单，确保 `topicPaths`、`fallbackTopic`、`matcherId` 仍有效。

## 完成后自检

1. `.Knowledge/topics/*.md` 与 `manifest-routing.topicPaths` 一一对应。
2. `index.md` 主题表与 topics 文件集合一致，且每个主题都包含“关联文档（摘要）”。
3. 每个 `taskToTopicRules[].matcherPath` 文件存在且其中 `id` 与 `matcherId` 一致。
4. 若写入 `topicMetadata`：key 是否均存在于 `topicPaths`；`primary` / `tags` / `confidence` 是否合法；`tags` 是否未与 `primary` 重复；是否未因分类改 topicId / 文件名。
5. 未触碰配置根 `rules/skills`。
6. 中大变更时是否按文件级契约拆子（子 A / 子 B 路径互不重叠）。
7. `manifest-routing.json` / `.Knowledge/index.md` 由主 agent 单点落盘，无子 agent 越权写入。
