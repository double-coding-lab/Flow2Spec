---
name: f2s-kb-sync
description: 可显式给出能力或零输入推断；先输出知识库更新大纲，确认后写入 topics/index/manifest；触发：f2s-kb-sync、全局同步、知识库同步、已实现能力
---

> 执行口径：本技能只维护 `.Knowledge`，默认不改配置根 `rules/skills`。

## 编排（主 / 子 agent）

- 两字段（`subAgent` / `switchAgentVerification`）语义以统一入口为唯一事实源：**Cursor/Claude** 读配置根 `rules/f2s-flow2spec-unified-entry.*`；**Codex** 读 `.codex/f2s-rules/f2s-flow2spec-unified-entry.md`（与上同源，`flow2spec init` 镜像）。
- 步骤 1（素材汇总）：`subAgent=true` 时可拆子并行，仅只读汇总，不得落盘。
- 步骤 2（大纲 + 用户确认）：必主 agent 完成，确认权不可下放子 agent。
- 步骤 3（落盘）：`subAgent=true` 时可按已确认大纲拆子逐项落盘；硬约束：子落盘前必须前置加载近邻 2–3 个主题的开头摘要，做叙事风格对齐。
- 写权硬约束：`manifest-routing.json` 与 `.Knowledge/index.md` 恒由主 agent 单点落盘，禁止下放。
- 校验：默认落盘侧 agent 自验；本 SKILL 不绑定交叉校验。

# f2s-kb-sync（先大纲后写入）

## 输入（可选）

1. 用户显式给出“已实现能力列表”
2. 零输入：由 Agent 基于当前上下文推断
3. 辅助材料：`@` 文件、需求文档、架构说明等

## 强制流程（不可颠倒）

### 步骤 1：收集素材（只读）

- 汇总用户目标、范围、优先级
- 汇总已实现能力（用户指定 + Agent 推断）
- 对照现有知识库：
  - `.Knowledge/topics/`
  - `.Knowledge/index.md`
  - `.Knowledge/manifest-routing.json`
  - `.Knowledge/matchers/*.json`（与路由中 `matcherPath` 对应的分片）
  - `.Knowledge/stock-docs/`
- **主题粒度扫描**：对已有 topic 粗扫以下信号，命中时在步骤 2 大纲中列为"建议拆分"（不阻断同步流程）：
  - 对应 stock-doc 超过 **300–500 行**；
  - `includeAny` 词数超过 **12 个**；
  - topic 正文包含超过 **3 个不相干职责域**的二级标题。

### 步骤 2：输出《更新大纲》（必须）

大纲至少包含：

1. 同步目标
2. 能力清单（用户指定 / Agent 推断 / 合并结果）
3. 信息来源
4. 拟改文件清单（精确到路径）
5. 主题同步计划：说明每个能力是“更新已有主题”还是“创建新主题”，并列出 topicId、topic 文件、index 行、manifest/matcher 变更；如涉及 `topicMetadata`，列出 `primary` / `tags` / `confidence` 候选和证据；无明确证据时写“不分类 / 暂不写入”
6. 不改动范围
7. 等待用户确认提示

> 未确认前禁止落盘修改。

### 步骤 3：确认后写入

> 硬约束：若启用拆子，子 agent 落盘前必须读取近邻 2–3 个主题的开头摘要，确保叙事风格一致；`manifest-routing.json` 与 `.Knowledge/index.md` 由主 agent 单点落盘，子 agent 无写权。
>
> **创作侧准则**：本步若新增 / 修改 topic、`topicMetadata` 或 `topicDependencies`，须先 Read `rules/f2s-topic-authoring.*` 全文（**Cursor/Claude**：`rules/f2s-topic-authoring.mdc`；**Codex**：`.codex/f2s-rules/f2s-topic-authoring.md`），再落盘。

按大纲逐项更新：

- `.Knowledge/topics/*.md`
- `.Knowledge/index.md`（同步主题路由表的“关联文档（摘要）”列）
- 路由清单（按需）；若创建新 topic，须同步 `topicPaths`、必要的 `taskToTopicRules` / matcher 分片；可在证据明确时写 `topicMetadata`，但分类只用于治理、审计和阅读预期，不参与路由命中或执行强制性，不得为了分类创建、重命名或拆分 topic
- `.Knowledge/stock-docs/*.md`（按需补充索源文档）

### 步骤 4：收尾摘要

- 列出已修改路径与目的
- 列出未执行项与原因

## 输出摘要格式（建议）

```markdown
## 知识库同步结果

### 已确认能力范围
- <能力1>
- <能力2>

### 已修改文件
- .Knowledge/topics/<topic>.md：<修改说明>
- .Knowledge/index.md：<修改说明>
- .Knowledge/manifest-routing.json：<修改说明或“未改动”>
- .Knowledge/matchers/<id>.json：<修改说明或“未改动”>
- .Knowledge/stock-docs/<doc>.md：<修改说明或“未改动”>

### 未执行项
- <项>：<原因>
```

## 复杂场景示例

用户仅说“/f2s-kb-sync 同步一下”，未给能力清单。

- 步骤 1 先做最小推断（例如从 `git diff` / 目录名归纳 1～2 个能力域），并给出推断依据。
- 步骤 2 必须输出大纲并等待“确认”；未确认前禁止写入任何 `.Knowledge` 文件。
- 用户确认后只执行大纲内条目；若用户中途缩小范围，未执行项写入收尾摘要。

## 约束

- 先大纲，后写入
- 小步增补，避免整文件重写
- 同主题优先原位更新
- `index.md` 每个主题需包含 `stock-docs/req-docs` 的摘要级**可点击 Markdown 链接**（格式：`[标题](相对路径)`，1-3 条，允许写“无”）
- 不改配置根 `rules/skills`

## 完成后自检

1. 是否存在未确认即写入（必须为否）。
2. topic 文件与 index 行是否一一对应，且“关联文档（摘要）”已同步更新。
3. manifest 中 `topics` / `taskToTopicRules` / `topicDependencies` 是否仍引用有效路径。
4. 若写入 `topicMetadata`：key 是否均存在于 `topicPaths`；`primary` / `tags` / `confidence` 是否合法；是否避免类型前缀命名。
5. 是否误改配置根 `rules/skills`（必须为否）。
6. 步骤 2 大纲 + 用户确认未下放子 agent；步骤 3 子落盘前已加载近邻 2–3 主题摘要；manifest / index 由主单点落盘。
