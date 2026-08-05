---
name: f2s-kb-sync
description: 可显式给出能力或零输入推断；先输出知识库更新大纲，确认后写入 topics/index/manifest；触发：f2s-kb-sync、全局同步、知识库同步、已实现能力
---

> 执行口径：本技能只维护 `.Knowledge`，默认不改配置根 `rules/skills`。

## KB 自动合并协议（必须）

本技能不得把“人工执行命令”作为用户流程。用户确认同步大纲后，由 agent 自己完成知识候选生成、合并、构建与校验：

1. 将已确认的大纲转换为一个或多个 `kb-delta` 草稿，记录 `taskId`、`developerId`、`baseRevisions`、`changes` 与证据摘要；没有显式任务目录时可在内存中形成等价对象，不强制为了本技能创建 `.task`。`changes` 可使用 `appendBody` / `replaceBody` / `updateFrontmatter`；确需新主题时使用 `createTopic`，并可携带 `taskRule` 与 `matcher` 让路由一并接入。
2. 写入 `.Knowledge` 前，必须用 `flow2spec kb plan <delta>` 或等价内部能力预演；若 topic revision 不一致，停止自动写入，转入语义合并说明。
3. 可自动合并时，由 agent 调用 `flow2spec kb apply <delta>` 或等价内部能力写入 topic，并随后执行 `flow2spec kb build` 与 `flow2spec kb check`。
4. 用户只看到“知识库已同步 / 有语义冲突需确认 / 已跳过入库及原因”，不要求用户手动执行 `kb plan/apply/build/check`。

## 编排（主 / 子 agent）

- 两字段（`subAgent` / `switchAgentVerification`）语义以统一入口为唯一事实源：**Cursor/Claude** 读配置根 `rules/f2s-flow2spec-unified-entry.*`；**Codex** 读 `.codex/topics/f2s-flow2spec-unified-entry.md`（与上同源，`flow2spec init` 镜像）。
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
5. 主题同步计划：说明每个能力是"更新已有主题"还是"创建新主题"，并列出 topicId、topic 文件、index 行、manifest/matcher 变更；如涉及 `topicMetadata`，列出 `primary` / `tags` / `confidence` 候选和证据；无明确证据时写"不分类 / 暂不写入"
6. **终稿沉淀计划（硬约束）**：对每一个"新建 / 更新"的 topic，判断其「长文背景 / 详细资料」引用槽位是否已有对应 `.Knowledge/stock-docs/*_终稿.md`：
   - **已有** → 直接引用；
   - **没有但本次同步的能力已经代码落地** → 大纲**必须列出**"待生成 `stock-docs/<能力名>_终稿.md`"，并注明沉淀来源（对应 `req-docs/*_技术方案.md` + 已实现代码 + 澄清文档），由本 SKILL 步骤 3 之前先触发 `f2s-doc-final` 沉淀（或由用户确认后手写），**再**让 topic 指向终稿；
   - **能力仍在 req-docs 待实现阶段、尚无代码** → topic「长文背景」小节暂写占位说明「待代码落地后由 `f2s-doc-final` 生成 stock-doc 终稿」，**禁止**在此槽位直接列 `req-docs/*`。
   - 依据见 `rules/f2s-topic-authoring.*`「长文背景引用的目录边界（硬约束）」。
7. 不改动范围
8. 等待用户确认提示

> 未确认前禁止落盘修改。

### 步骤 2.5：终稿沉淀（若步骤 2 列出待生成终稿）

用户确认大纲后、`.Knowledge/topics/` 落盘前，先按大纲第 6 项**逐个沉淀 `stock-docs/*_终稿.md`**：

- 优先调用 **`f2s-doc-final`**（在同一会话内直接进入，不需要用户重新触发）；
- 或按 `.Knowledge/template/`（若有终稿模版）手写并落盘；
- 沉淀完成、终稿路径确定后，再进入步骤 3 让 topic 的「长文背景」小节指向该终稿。

**禁止**：跳过本步直接落 topic，把 `req-docs/*` 挂进 topic 的「长文背景 / 相关资料」整节槽位。

### 步骤 3：确认后写入

> 硬约束：若启用拆子，子 agent 落盘前必须读取近邻 2–3 个主题的开头摘要，确保叙事风格一致；`manifest-routing.json` 与 `.Knowledge/index.md` 由主 agent 单点落盘，子 agent 无写权。
>
> **创作侧准则**：本步若新增 / 修改 topic、`topicMetadata` 或 `topicDependencies`，须先 Read `rules/f2s-topic-authoring.*` 全文（**Cursor/Claude**：`rules/f2s-topic-authoring.mdc`；**Codex**：`.codex/topics/f2s-topic-authoring.md`），再落盘。

按大纲逐项更新：

- `.Knowledge/topics/*.md`
- `.Knowledge/index.md`（同步主题路由表的“关联文档（摘要）”列）
- 路由清单（按需）；若创建新 topic，须同步 `topicPaths`、必要的 `taskToTopicRules` / matcher 分片；可在证据明确时写 `topicMetadata`，但分类只用于治理、审计和阅读预期，不参与路由命中或执行强制性，不得为了分类创建、重命名或拆分 topic
- `.Knowledge/stock-docs/*.md`（按需补充索源文档）

### 步骤 4：收尾摘要

- 列出已修改路径与目的
- 列出未执行项与原因

### 步骤 5：写入同步时间戳（必须,f2s-git-commit 依赖）

本技能成功完成写入后（步骤 3 有实际文件落盘时）,由主 agent 落盘 `.Knowledge/.last-sync.json`,格式：

```json
{
  "syncedAt": "<ISO 8601 时间戳,如 2026-08-04T10:30:00.000Z>",
  "skill": "f2s-kb-sync",
  "developerId": "<按 f2s-task 规则解析的 developerId,legacy 时可省略>"
}
```

- 该文件由 `f2s-git-commit` 在**默认覆盖检查**前读取,若 `syncedAt` 距今 < 30 分钟则跳过覆盖检查,避免刚同步完知识库又被要求同步一次。
- **写入时机**：仅在本轮真正写盘（步骤 3 有 topic / index / manifest / stock-docs 变更）时才写；纯"读一遍 kb 什么也没改"的场景**不**写。
- 覆盖式写入,不追加历史。
- 落盘失败（磁盘只读、权限不足等）不阻塞本技能主流程,在收尾摘要中列一行 warning 即可。
- 同类知识库写入技能（`f2s-kb-feat` / `f2s-kb-fix` / `f2s-kb-add` / `f2s-kb-addRules` / `f2s-kb-distill`）成功写盘后也应遵守相同约定,`skill` 字段填自己的 id。

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
2. topic 文件与 index 行是否一一对应，且"关联文档（摘要）"已同步更新。
3. manifest 中 `topics` / `taskToTopicRules` / `topicDependencies` 是否仍引用有效路径。
4. 若写入 `topicMetadata`：key 是否均存在于 `topicPaths`；`primary` / `tags` / `confidence` 是否合法；是否避免类型前缀命名。
5. 是否误改配置根 `rules/skills`（必须为否）。
6. 步骤 2 大纲 + 用户确认未下放子 agent；步骤 3 子落盘前已加载近邻 2–3 主题摘要；manifest / index 由主单点落盘。
7. **每个新建 / 更新的 topic**，其「长文背景 / 详细资料 / 相关资料 / 长文来源 / 参考文档」整节引用槽位**是否仅指向 `.Knowledge/stock-docs/*_终稿.md`**（或已定型的 stock-doc）；**不得**直接列 `.Knowledge/req-docs/*` 作为长文事实源。若代码已落地但对应终稿尚缺，是否已在步骤 2.5 完成沉淀。
