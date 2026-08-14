---
name: f2s-kb-migrate
description: 旧版知识库一次性迁到 `.Knowledge`：以配置根 `docs-index.md` + 规则统一入口（旧版 `rules/main.md(c)` 或新版包 `rules/f2s-flow2spec-unified-entry.md(c)`）为主索引线索，全量处理业务 `rules/` 与业务 `skills/`（排除 `f2s-*` 包技能），并全量迁移 `stock-docs`/`req-docs`；**迁移验收后必选**落盘 `.Knowledge/migration-report.md`（迁移对照表 + 拟删除路径列表）；**收尾必选**删除已迁旧的 `rules/`、已迁业务 `skills/`、旧版 `docs-index.md`/`index-doc.md`；用户只**核对/修订删除清单（排除项）**；触发：f2s-kb-migrate、知识库迁移、旧版迁移
---

> 执行口径：这是 `f2s-*` 技能流程，不是 CLI 子命令。迁移目标包含：
> 1) 结构层：`.Knowledge/topics`、`.Knowledge/index.md`、`.Knowledge/manifest-routing.json`、`.Knowledge/matchers/*.json`
> 2) 文档层：`.Knowledge/stock-docs`、`.Knowledge/req-docs`
>
> **硬边界**：`skills/f2s-*`（各 agent 配置根下）属于 Flow2Spec 包技能/执行层能力，**不得**写入 `.Knowledge`（含 `topics/stock-docs/req-docs`），也不得作为“业务技能迁移”的源；**不得**在本流程中删除（版本对齐走 `flow2spec init` / 包升级）。
>
> **基线规则保留清单（不得删除）**：`rules/f2s-flow2spec-unified-entry.md(c)`、`rules/f2s-implement-tech-design.md(c)`、`rules/f2s-stock-docs-vs-req-docs.md(c)`。

## 编排（主 / 子 agent）

- 两字段（`subAgent` / `switchAgentVerification`）语义以统一入口为唯一事实源：**Cursor/Claude** 读配置根 `rules/f2s-flow2spec-unified-entry.*`；**Codex** 读 `.codex/topics/f2s-flow2spec-unified-entry.md`（与上同源，`flow2spec init` 镜像）。本节不复述。
- **子 agent 职责**（仅当 `subAgent=true`）：在主给定清单下做搬运工作、生成 `migration-report.md` 的**草案片段**；产出一律以 patch 形式提交，由主 agent 合并落盘。
- **主必控**：
  - `.Knowledge/.migrate-state.json` **写权归主**（状态机事实源，主 / 子抢写会致队列错位）；
  - `migration-report.md` 的 **「删除执行记录」** 小节恒由主 agent 追加；
  - **删除清单确认**与闭环收尾必主完成。
- **写权硬约束**：`manifest-routing.json` / `.Knowledge/index.md` / `.Knowledge/.migrate-state.json` / 迁移报告「删除执行记录」均恒由主 agent 落盘。
- 默认落盘侧自验；本 SKILL 不绑定交叉校验。

# f2s-kb-migrate（旧版知识库 -> 新版知识库）

## 与 `f2s-kb-upgrade` 为何并存

| 技能 | 解决的问题 |
| --- | --- |
| **本技能 `f2s-kb-migrate`** | **一次性结构搬家**：旧索引（`docs-index.md` / `index-doc.md`）、`rules/main.md(c)`、业务 `skills/`、散落 `stock-docs`/`req-docs` → **`.Knowledge`**，并处理删除清单与 `migration-report.md`。 |
| **`f2s-kb-upgrade`** | **知识库模板升级技能（唯一「升级」口径）**：按 **`skills/f2s-kb-upgrade/SKILL.md`** 全文执行；其中代跑 **`flow2spec init`** 以对齐 **`manifest-routing` + `matchers/`** 与各 agent **`rules`/`skills`**；含 **V1 / 现行库（V2+）** 分流（旧项目须 **migrate 后再跑本技能**；**V2+ 含 npm v3.x 等已上 `.Knowledge` 的项目**，见 `f2s-kb-upgrade` 步骤 0）。 |

- **迁移验收、删除清单确认完成后**：应提醒或代用户执行 **`f2s-kb-upgrade` 技能全文**（其中 **步骤 2** 会代跑 **`flow2spec init`**），把 Flow2Spec 包版本、路由分片与配置根产物对齐到当前包。**勿**让用户以为「单独执行 `init`」即完成知识库模板升级。
- **已在稳定使用 `.Knowledge` 且无旧索引负担的项目**：不要重复跑本技能；日常包/模板对齐走 **`f2s-kb-upgrade`** 技能即可（不是只跑 `init`）。

**为何各 agent 下都有同名 `SKILL.md`？** 各工具只读各自配置根下的 `skills/`；`flow2spec init` 会向所选 agent **同步**当前语言对应的技能内容。

## 本命令做什么（对外口径）

把旧版“散落在配置根的文档索引 + 规则 + 业务技能 + stock/req 文档树”，**整体搬迁并改写到新版 `.Knowledge`**，完成后再做**旧版入口与旧版业务产物清理**，实现与旧版知识库组织方式的切割。

必须覆盖的对象：

1. **索引入口**：配置根 `docs-index.md`（兼容 `index-doc.md`）中声明/映射到的业务文档与规则线索。
2. **规则入口**：`rules/main.md` / `rules/main.mdc`（旧版常见）或 `rules/f2s-flow2spec-unified-entry.md` / `rules/f2s-flow2spec-unified-entry.mdc`（兼容历史命名 `rules/flow2spec-unified-entry.md(c)`）中声明/引用的规则集合（以及 `rules/` 下其它业务规则文件）。
3. **业务技能**：各 agent 配置根 `skills/` 下除 `f2s-*` 以外的业务技能目录（全量盘点）。
4. **文档树**：旧版 `stock-docs/`、`req-docs/`（或同义目录）**全量**迁入 `.Knowledge` 对应目录。

对“索引未覆盖”的对象：

- 先输出候选清单（路径 + 推断理由：命名/目录/引用关系）。
- **默认必须让用户确认**是否纳入迁移；仅当证据非常充分（例如被 `rules/main` / `f2s-flow2spec-unified-entry` 显式引用、或被已索引文档明确引用）才允许 Agent 自行判定纳入，并在迁移摘要中写明判定依据。

迁移完成后的清理（**必选收尾**；且迁移结果无失败、无待确认项；**`skills/f2s-*` 永不删除**）：

- **必须执行**：删除旧版 **`rules/` 中已迁移业务规则文件**（含 `main.md(c)` 若仅作为旧入口），但**不得删除**基线规则保留清单中的 3 个 `f2s-*` 根规则文件。
- **必须执行**：删除旧版 **业务** `skills/` 下**已迁移**的子目录（**排除** `f2s-*`；若某目录下仍有未迁完项则不得删该目录，须先补齐或从清单剔除）。
- **必须执行**：删除旧版入口 **`docs-index.md`**（兼容 **`index-doc.md`**），避免与 `.Knowledge/index.md` 双入口并存。
- **默认一并列入删除子清单**（用户可在清单中排除）：旧版 **`stock-docs/`**、**`req-docs/`** 源目录（仅当对应文档层迁移验收通过、无失败/无待确认项时执行实际删除）。

**用户确认的含义（重要）**：

- **不是**询问「要不要做清理」；清理是流程的一部分。
- **而是**输出**默认全选的「删除路径清单」**（规则文件逐条、业务 skill 目录逐条、索引文件名、以及可选的旧文档根目录），请用户**核对**；用户只能：
  - 回复「**确认清单**」按当前清单执行删除；或
  - 回复「**排除：<路径…>**」从清单中移除指定项后再执行（移除项须写入 `.migrate-state.json` 的 `notes[]` 并说明原因）。
- 若用户要求**暂缓删除某路径**，须在清单中保留该项并结束本轮清理（状态文件 `status=paused`），**不得**假装已完成迁移闭环。

## 适用场景

- 项目仍在使用旧版知识组织（`docs-index.md` / `index-doc.md` + `rules/main.md(c)` 或 `rules/f2s-flow2spec-unified-entry.md(c)`（兼容旧 `flow2spec-unified-entry.md(c)`）+ 业务 `skills/` + 散落 `stock-docs`/`req-docs`）。
- 希望迁移到新版 `.Knowledge`，并且按主题逐个确认，避免一次性大改。
- 需要 **req-docs / stock-docs 全量** 迁入 `.Knowledge`，并与旧版知识库目录/表述做切割（路径、索引、主题文案统一到新架构口径）。

## 输入

- 可选输入：
  - 旧版规则统一入口路径：`rules/main.md` / `rules/main.mdc` 和/或 `rules/f2s-flow2spec-unified-entry.md` / `rules/f2s-flow2spec-unified-entry.mdc`（兼容旧 `rules/flow2spec-unified-entry.md(c)`）
  - 旧版 `index-doc.md`（或 `docs-index.md`）路径
  - 旧版存量文档目录（如 `stock-docs/`、`docs/stock/`）
  - 旧版需求文档目录（如 `req-docs/`、`docs/req/`）
  - 迁移范围（全部主题 / 指定主题）
- 不提供时，先在仓库中定位上述文件并向用户确认。

## 断点续迁状态文件（必须启用）

- 状态文件路径：`.Knowledge/.migrate-state.json`
- 作用：记录迁移进度，支持会话中断后恢复，不重复迁移已完成项。
- 初始化时机：用户确认“开始迁移”后立即创建。
- 结束时机：
  - 全部迁移完成且用户确认结束：删除状态文件。
  - 用户主动“停止”：保留状态文件，等待下次恢复。
- `.migrate-state.json` 只由主 agent 写；子 agent 以 patch 片段提交由主合并（写权硬约束）。

建议字段（最小集）：

```json
{
  "version": "1",
  "status": "running",
  "currentStage": "inventory|orphans|topics|stock-docs|req-docs|cleanup",
  "topicQueue": [],
  "topicDone": [],
  "bizRuleQueue": [],
  "bizRuleDone": [],
  "bizSkillQueue": [],
  "bizSkillDone": [],
  "stockQueue": [],
  "stockDone": [],
  "reqQueue": [],
  "reqDone": [],
  "pendingManual": [],
  "failed": [],
  "notes": [],
  "updatedAt": "ISO-8601"
}
```

更新规则（必须执行）：

1. 每完成 1 个主题、1 个业务技能目录、1 个业务规则文件或 1 个文档文件后，立即落盘更新状态文件。
2. 收到“重试 <topic|file>”时，先回滚该项状态，再执行重试。
3. 收到“继续”时，优先读取状态文件，从未完成队列继续。
4. 收到“停止”时，写入 `status=paused` 并结束本轮。
5. 收到恢复请求时，先展示状态摘要（当前阶段、剩余数量、失败/待确认项）并等待用户确认继续。

## 强制流程（分阶段执行）

### 步骤 1：读取旧版映射

1. 读取 `docs-index.md`（兼容 `index-doc.md`），提取“业务文档 -> 规则/主题”映射（**主索引**）。
2. 读取 **`rules/main.md`（兼容 `main.mdc`）** 或 **`rules/f2s-flow2spec-unified-entry.md`（兼容 `f2s-flow2spec-unified-entry.mdc`；兼容旧 `flow2spec-unified-entry.md(c)`）**（二者通常只存在其一），提取模块/主题目录线索（**与索引交叉校验**）。
3. **全量盘点业务规则文件**：扫描 `rules/` 下除以下文件外的业务规则文件，建立 `bizRuleQueue`（去重）：
   - 统一入口：`main.md(c)`、`f2s-flow2spec-unified-entry.md(c)`、`flow2spec-unified-entry.md(c)`（兼容旧命名）
   - 基线保留：`f2s-implement-tech-design.md(c)`、`f2s-stock-docs-vs-req-docs.md(c)`
4. **全量盘点业务技能**：扫描各 agent 配置根 `skills/` 目录，**排除** `f2s-*`，其余目录一律进入 `bizSkillQueue`（去重）。
5. 扫描旧版 `stock-docs` 与 `req-docs` 候选来源目录（若存在）。
6. 生成待迁移清单并展示给用户确认：
   - 主题清单（去重、排序）
   - 业务规则文件清单（`bizRuleQueue`）
   - 业务技能目录清单（`bizSkillQueue`）
   - `stock-docs` 文件清单
   - `req-docs` 文件清单
7. 文档分类口径（必须明确）：
   - 来源路径命中 `stock-docs`（含同义目录如 `docs/stock`） -> 迁移到 `.Knowledge/stock-docs`
   - 来源路径命中 `req-docs`（含同义目录如 `docs/req`） -> 迁移到 `.Knowledge/req-docs`
   - 无法判定的文件 -> 列入“待人工确认清单”，未确认前不迁移
8. 计算“索引外候选”（`orphans`）：
   - `bizRuleQueue` 中未被 `docs-index` / 统一入口（`rules/main` 或 `f2s-flow2spec-unified-entry`）覆盖的文件
   - `bizSkillQueue` 中未被索引映射覆盖的目录
   - 对每一项默认要求用户确认是否迁移；仅在高置信引用场景允许 Agent 自判纳入，并将依据追加写入状态文件 `notes[]`（不得破坏 JSON 可解析性）。
9. 用户确认清单后，初始化状态文件并写入队列（inventory/orphans/topics/stock/req）。

### 步骤 2：逐主题迁移（结构层核心）

对每个主题按以下顺序执行：

1. 汇总该主题旧资料：
   - 相关 `rules/*.md(c)`（业务规则）
   - 相关 **业务** `skills/<非 f2s-*>`（将其内容合并进主题叙述/流程，不复制为 `.Knowledge` 下的技能文件）
   - 索引映射中的**业务文档**路径
   - **不得**包含 `skills/f2s-*` 下任何文件
2. 生成或更新 `.Knowledge/topics/<topic>.md`：
   - 正文表述统一为新架构口径（`.Knowledge` 分层、`manifest` 路由、`stock-docs`/`req-docs` 分工）。
   - 去除旧版独有路径/术语（如旧 `docs-index` 根路径、旧散落目录名），改为指向 `.Knowledge/...` 或相对 `.Knowledge` 的稳定路径。
   - **创作侧准则**：本步生成 / 重写 topic 或调整 `topicMetadata` / `topicDependencies`，须先 Read `rules/f2s-topic-authoring.*` 全文（**Cursor/Claude**：`rules/f2s-topic-authoring.mdc`；**Codex**：`.codex/topics/f2s-topic-authoring.md`），再落盘。
3. 更新 `.Knowledge/index.md` 的主题索引行，并同步维护“关联文档（摘要）”列（每主题 1-3 条关键 `stock-docs/req-docs` **可点击 Markdown 链接**，格式：`[标题](相对路径)`）。
4. 按需更新路由清单：
   - `.Knowledge/manifest-routing.json`：`topicPaths`、`taskToTopicRules[]`、`topicDependencies`、`topicMetadata`、`fallbackTopic`
   - `.Knowledge/matchers/<matcherId>.json`：`includeAny`（与 `manifest-routing.taskToTopicRules[].matcherPath` 一致）
5. 输出本主题迁移摘要并**暂停**，提示用户：
   - 回复“继续”迁移下一个主题
   - 或回复“停止”终止本轮
   - 或回复“重试 <topic>”重做当前主题

> 未收到“继续”前，不得迁移下一个主题。
> 每完成一个主题，必须先更新状态文件再进入等待。

### 步骤 3：迁移 `stock-docs`（文档层）

当步骤 2 全部完成后，执行：

1. 按“来源目录相对路径”迁移到 `.Knowledge/stock-docs/<relative-path>`，不做平铺。
2. 默认场景视为在旧版仓库首次迁移到新版知识库，目标路径按“不存在”执行。
3. 每迁移 1 个文件输出一次结果并暂停，等待“继续 / 停止 / 重试 <文件>”。
4. 全部完成后输出 `stock-docs` 子摘要（成功/失败/待确认）。

> 未收到“继续”前，不得迁移下一个文件。
> 每完成一个文件，必须先更新状态文件再进入等待。

### 步骤 4：迁移 `req-docs`（文档层）

当 `stock-docs` 阶段完成后，执行：

1. 按“来源目录相对路径”迁移到 `.Knowledge/req-docs/<relative-path>`，不做平铺。
2. 默认场景视为在旧版仓库首次迁移到新版知识库，目标路径按“不存在”执行。
3. 每迁移 1 个文件输出一次结果并暂停，等待“继续 / 停止 / 重试 <文件>”。
4. 全部完成后输出 `req-docs` 子摘要（成功/失败/待确认）。

> 未收到“继续”前，不得迁移下一个文件。
> 每完成一个文件，必须先更新状态文件再进入等待。

### 步骤 5：全部迁移完成后的收尾（必选：迁移报告落盘 + 删除清单确认）

当主题（步骤 2）与文档层 `stock-docs` / `req-docs`（步骤 3–4）**全部验收通过**（无失败、无阻塞性待确认项，或已在报告中单列）后，按顺序执行以下子步骤。

#### 5.0 迁移报告（必选：写入项目 Markdown）

1. **必须**在项目仓库中创建或覆盖文件：**`.Knowledge/migration-report.md`**（相对项目根；与 `.Knowledge` 同库，便于评审与留痕）。
2. 报告正文须至少包含两大块（可用表格或分级列表，路径一律用**相对项目根**的 POSIX 风格）：
   - **「迁移对照表」**：
     - **主题**：每个已迁移 `topic` → 旧侧来源（对应 `rules/*.md(c)`、业务 `skills/<dir>`、`docs-index` 映射行摘要）→ 新路径 `.Knowledge/topics/<topic>.md`；并注明本次是否改写了 `.Knowledge/index.md` / 路由清单相关字段。
     - **`stock-docs`**：每条 **源路径 → `.Knowledge/stock-docs/...` 目标路径**（含跳过的文件及原因，若无则写「无」）。
     - **`req-docs`**：同上。
   - **「拟删除路径清单」**：与下文步骤 5.2 中向用户展示的**默认全选删除清单**逐项一致（`rules/` 下每个文件、业务 `skills/` 下每个待删目录、`docs-index`/`index-doc`、以及可选列入的旧 `stock-docs/`/`req-docs/` 根目录）；每条建议用 `- [ ] <路径>`，便于人类勾选核对。
3. 若用户随后在步骤 5.2 中发出 **「排除：<路径…>」**，须在**执行物理删除前**更新同一文件：追加或在「用户排除项」小节中写明排除路径与原因，并同步更新「拟删除路径清单」勾选状态或列表，使**磁盘上的报告与最终删除集合一致**。
4. 在步骤 5.2 第 3 步按最终清单**执行完物理删除后**，须在**同一文件末尾**追加小节 **`## 删除执行记录`**（含执行时间、实际已删路径列表；未删项注明原因与 `status=paused` 等），不得仅留在对话里。
5. 迁移报告的「删除执行记录」小节恒由主 agent 追加，子 agent 不得直接写入（写权硬约束）。

> **禁止**：未完成 `.Knowledge/migration-report.md` 落盘即进入物理删除或结束本轮迁移闭环。

#### 5.1 总摘要（对话内，可与报告摘要一致）

- 已迁移主题列表
- 新增/更新的 `.Knowledge` 文件
- 已迁移 `stock-docs` 文件
- 已迁移 `req-docs` 文件
- 未迁移或失败项

#### 5.2 必选清理阶段（删除清单确认，不得跳过）

1. 输出**默认全选**的「**删除路径清单**」（须与 `migration-report.md` 中「拟删除路径清单」同源），至少包含：
   - 旧版 **`rules/`** 下每个将删除的**业务规则**文件路径（可含 `main.md(c)`；**不含**基线保留清单中的 `f2s-*` 根规则）
   - 旧版 **业务** `skills/` 下每个将删除的子目录路径（**不含** `f2s-*`）
   - 旧版 **`docs-index.md` / `index-doc.md`**
   - （可选子清单）旧版 **`stock-docs/`**、**`req-docs/`** 根目录：仅当文档迁移验收通过且无待确认项时列入；用户可排除。
2. 等待用户回复 **「确认清单」** 或 **「排除：<路径…>」** 更新清单；**禁止**使用「是否执行清理」类二选一提问。
3. 按**最终清单**执行删除；**不得**删除清单外的路径；**不得**删除 **`skills/f2s-*`**。
4. 收尾完成后处理状态文件：
   - 本轮完整完成：删除 `.Knowledge/.migrate-state.json`
   - 本轮暂停/中止：保留 `.Knowledge/.migrate-state.json`（`status=paused`），并记录未删路径与原因

## 输出摘要格式（建议）

```markdown
## 主题迁移完成：<topic>

### 来源
- rules: <旧路径...>
- 业务文档: <索引映射中的文档路径...>
- 映射: <docs-index / index-doc 行或文档名>

### 已写入
- .Knowledge/topics/<topic>.md
- .Knowledge/index.md（更新 <x> 行）
- .Knowledge/manifest-routing.json（更新字段：...）
- .Knowledge/matchers/<id>.json（更新 `includeAny` 等：...）

### 下一步
- 回复“继续”迁移下一个主题
- 回复“停止”结束迁移
```

```markdown
## 文档迁移完成：<stock-docs|req-docs>/<file>

### 来源
- source: <旧路径...>

### 已写入
- .Knowledge/<stock-docs|req-docs>/<relative-path>

### 下一步
- 回复“继续”迁移下一个文件
- 回复“停止”结束迁移
```

## 约束

- 必须逐主题确认，不可批量跳过确认直接全量迁移。
- `stock-docs` / `req-docs` 必须逐文件确认，不可无确认批量迁移。
- 文档迁移必须保留来源目录相对路径，不可平铺为单层文件名。
- **`f2s-*` 技能不得进入 `.Knowledge`，不得在主题迁移中合并进 `topics`。**
- **业务** `skills/`（非 `f2s-*`）必须纳入全量盘点；索引未覆盖项默认必须用户确认后才可迁移。
- 未完成全部主题前，禁止删除旧业务 `rules/` 与**非 `f2s-*`** 的旧业务 `skills/`；基线保留清单中的 `f2s-*` 根规则文件始终不得删除。
- 未完成文档迁移前，禁止删除旧文档目录。
- 删除旧目录前必须完成「**删除路径清单**」核对（允许排除项），**禁止**用「是否清理」替代清单确认。
- 迁移过程只改 `.Knowledge` 与（**最终删除清单**确认后）对清单内旧路径的删除，不改业务代码。
- 必须维护 `.Knowledge/.migrate-state.json`，禁止只在内存中维护迁移进度。
- 主题与文档层迁移验收通过后，**必须先**写入 `.Knowledge/migration-report.md`（含迁移对照表与拟删除路径清单），再进入物理删除；报告与对话内删除清单须同源可追溯。
- `.migrate-state.json` / `migration-report.md` 的删除执行记录 / `manifest-routing.json` / `.Knowledge/index.md` 均恒主落盘。

## 迁移报告模板（落盘 `migration-report.md` 时建议结构）

以下骨架可直接复制后填空；路径均为相对项目根。

```markdown
# 知识库迁移报告

- **生成时间（ISO-8601）**：<...>
- **配置根（如 `.cursor/`）**：<...>

## 迁移对照表

### 主题（旧来源 → 新路径）

| topic ID | 旧 rules / 旧业务 skills / 索引线索 | 新路径 |
| --- | --- | --- |
| <id> | <...> | `.Knowledge/topics/<id>.md` |

### stock-docs（源 → 目标）

| 源路径 | 目标路径 | 备注 |
| --- | --- | --- |
| <...> | `.Knowledge/stock-docs/...` | 成功 / 跳过原因 |

### req-docs（源 → 目标）

| 源路径 | 目标路径 | 备注 |
| --- | --- | --- |
| <...> | `.Knowledge/req-docs/...` | 成功 / 跳过原因 |

## 拟删除路径清单（默认全选；与对话内清单一致）

- [ ] `<路径>`（`rules/` 下逐文件）
- [ ] `<路径>`（业务 `skills/<dir>`，不含 `f2s-*`）
- [ ] `.cursor/docs-index.md`（或实际路径）
- [ ] （可选）旧 `stock-docs/` / `req-docs/` 根目录

## 用户排除项（如有）

- （无则写「无」）

## 失败或未迁移项（如有）

- （无则写「无」）

## 删除执行记录

（仅在执行物理删除后追加：时间、已删列表、未删及原因）
```

## 完成后自检

1. 主题总数是否与旧映射总数对齐（允许用户显式跳过）。
2. `manifest.topics[].path` 是否都存在。
3. `index` 是否可定位到每个已迁移主题。
4. `topicMetadata` 是否只引用 `topicPaths` 已存在 topicId；`primary` / `tags` / `confidence` 是否合法。
5. `.Knowledge/stock-docs`、`.Knowledge/req-docs` 是否与确认迁移清单一致。
6. 待人工确认清单是否已清空；未清空则禁止删除旧文档目录。
7. 旧业务 `rules/`、**非 `f2s-*`** 的旧业务 `skills/`、旧版索引及（若列入清单）旧文档目录是否已按**最终删除清单**执行删除；基线保留清单中的 3 个 `f2s-*` 根规则是否仍保留。
8. 旧版入口 `docs-index.md` / `index-doc.md` 与 `rules/main.md(c)` 是否已按清单删除（且 `.Knowledge` 已可替代其职责），或是否因用户排除而**明确保留**并写入 `notes[]`。
9. 状态文件是否与迁移结果一致（完成则删除，暂停则保留且 `status=paused`）。
10. `.Knowledge/index.md` 是否已为每个主题同步“关联文档（摘要）”列（可写“无”，但不得留空）。
11. `skills/f2s-*` 是否未被误删、未被写入 `.Knowledge`。
12. `.Knowledge/migration-report.md` 是否已落盘且包含 **迁移对照表**、**拟删除路径清单**；若已执行删除，是否已追加 **「删除执行记录」** 并与实际磁盘状态一致。
13. 状态机文件与删除执行记录未被子 agent 越权写入；manifest / index 由主 agent 单点落盘。
