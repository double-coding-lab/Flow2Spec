---
name: f2s-kb-addRules
description: 把用户口述的规则沉淀进知识库，自动判定「新建主题 / 并入存量主题」并同步路由；不写代码、不创建 .task/；触发：f2s-kb-addRules、新增规则、口述规则、把这条记到知识库
---

> **任务路径**：凡 `.task/` 落盘与续作，**必须以 `rules/f2s-task` 解析的 `TASK_ROOT` 为准（`.task` 或 `.task/<developerId>`；config → git → legacy）。下文若仍出现 `.task/todo.json` / `.task/active/`，均视为 **`TASK_ROOT/...` 的简写**。


> 执行口径：本技能只维护 `.Knowledge`（`topics/index/manifest-routing/matchers` 分片），不改配置根 `rules/skills`，不动业务代码，不创建 `.task/`（口述规则属于元配置变更，不是业务变更追踪）。

# f2s-kb-addRules：用户口述规则进知识库

## 与既有技能的边界

- 与 `f2s-kb-feat` 区分：`f2s-kb-feat` 强绑「代码实现 + KB 同步」，命中 `changeTracking.feat` 会创建 `.task/`；本技能**只沉淀规则**，不改代码、不追踪任务。
- 与 `f2s-kb-build` 区分：`f2s-kb-build` 输入是 `.Knowledge/stock-docs/<file>_终稿.md`；本技能输入是**用户当场口述的规则文本**。
- 与 `f2s-kb-add` 区分：`f2s-kb-add` 输入是「多文件源码 / 配置」聚合到 stock-docs；本技能跳过 stock-docs，直接落 topic。

## 编排（主 / 子 agent）

- `subAgent` / `switchAgentVerification` 语义以统一入口为唯一事实源（**Cursor/Claude** 读 `rules/f2s-flow2spec-unified-entry.*`；**Codex** 读 `.codex/topics/f2s-flow2spec-unified-entry.md`）。本 SKILL 不复述。
- 默认主 agent 全流程执行——口述规则单条短文，拆子收益低于 context 切换成本。
- **写权硬约束**：`.Knowledge/manifest-routing.json` / `.Knowledge/index.md` 恒由主 agent 落盘。
- 落盘侧自验。

## 输入

- 一条或一段用户口述的规则文本（自由文本即可，无固定格式）。
- 用户**不需要**指定目标主题、文件名、`alwaysApply` 等参数；由本技能判定与提议。

## 强制前置：Read 创作侧准则

执行任何步骤前，**须先 Read** `rules/f2s-topic-authoring.*` 全文（**Cursor/Claude**：`rules/f2s-topic-authoring.mdc`；**Codex**：`.codex/topics/f2s-topic-authoring.md`），后续命名 / 骨架 / 依赖判定 / DAG 最小化 / 写盘权属均以该条为准。

## 步骤 1：意图归一

把用户口述文本归一为可落盘的"规则单元"：

- 抽取**约束句式**（"做 X 时必须 / 禁止 / 优先 Y"）或**流程描述**（"X 的处理顺序是 A→B→C"）；
- 标识规则**适用场景**（触发条件、文件路径范围、生命周期阶段等）；
- 不替用户引申、不补未说的边界——口述什么写什么，模糊处保留并在步骤 3 询问。

## 步骤 2：扫存量主题（必须）

- Read `.Knowledge/manifest-routing.json` 取 `topicPaths` 全集；
- Read `.Knowledge/index.md` 主题表，按主题 id + 一句话意图扫一遍；
- 必要时按规则正文中的**关键词**逐个 Read 候选 `topics/<id>.md` 头部 10–30 行（不要全文加载所有 topic）；
- 输出**候选清单**（重合度高 → 低，至多 3 个）作为步骤 3 的输入。

## 步骤 3：新建 vs 并入判定（必须，与用户确认）

向用户**展示候选**，按下列分支提议：

- **高重合**（口述规则明显是某存量主题的细化 / 补充 / 例外）→ 提议「**并入** `topics/<existing>.md`」，并指出拟插入位置（章节名 / 段落锚点）。
- **无重合 / 低重合**（找不到合适宿主）→ 提议「**新建** `topics/<新 id>.md`」；新 id 由本技能按规则正文生成 **kebab-case**，遵循 `f2s-topic-authoring` 命名约束（无版本后缀、无个人花名、与 `index.md` 既有标题不冲突）。
- **跨多个主题**（一条口述同时约束 ≥2 个主题）→ **暂停**，向用户呈现拆分选项：
  - 选项 A：拆为 ≥2 条规则单元，分别并入对应主题；
  - 选项 B：选主归并到一个主题，其它主题以一行交叉引用提示；
  - 选项 C：新建一个**总纲性**主题统辖，旧主题加引用——仅在该规则确实横切多个领域时使用。

> 用户未确认前**禁止**落盘 `topics/` / `manifest-routing.json` / `index.md`。

## 步骤 4：落盘（用户确认后执行）

### 4a. 写 `topics/<id>.md`

- **新建**：按 `f2s-topic-authoring` 第 2 节"topic 正文骨架"五点逐项写入（标题与一句话意图 / 适用场景 / 核心规则 / 依赖声明 / 边界与禁止项）；
- **并入**：在用户确认的章节 / 段落处**手术式插入**——只增加与本次规则直接相关的句段，禁止整文件重写或借机重述背景；
- 行文遵守 `f2s-flow2spec-unified-entry`「知识库落盘文风」**肯定式优先**；排他性选择例外。

### 4b. `topicDependencies` 判定（必须）

按 `f2s-topic-authoring` 第 4 节四问 + 反向排除 + DAG 最小化，扫新写正文中**反引号引用的其他 topic id / 规则文件名**，逐个判定是否声明依赖：

- 命中 → 在 `manifest-routing.topicDependencies` 增加边，**且**在新 / 改 topic 正文显式写一句「执行前须先读依赖主题 `<dep>`」；
- 未命中 → 不写依赖，靠 `taskToTopicRules` 次高候选 + `expand` 补召回。

并入存量主题时，若仅是细化既有规则、未引入对新 topic 的强引用，**通常不需要**新增依赖边。

### 4c. 同步路由（仅主 agent 落盘）

- **新建主题**：
  - 补 `manifest-routing.topicPaths`：`<id> -> .Knowledge/topics/<id>.md`；
  - 按需补 `manifest-routing.topicMetadata`：口述规则主题通常为 `{ "primary": "policy", "confidence": "inferred" }`；用户明确确认分类可写 `manual`；如同时包含配置项 / 模块 / 能力性质，可写入不与 `primary` 重复的 `tags`；证据不足则不写 metadata，并在摘要列为待确认。分类只用于治理、审计和阅读预期，不参与路由命中或执行强制性；
  - 视情况补 `taskToTopicRules[]`——**仅当**该规则会作为**用户任务路由命中**（参见 `f2s-topic-authoring` 第 5 节判据）才补；纯被其它规则 / SKILL 引用的内部规则**不进** `taskToTopicRules`；
  - 若补了 `taskToTopicRules[]`，须新建 `.Knowledge/matchers/<matcherId>.json`，从用户口述中抽取 `includeAny` 关键词（用户原话 + 1–2 个明显近义说法，宁缺勿滥）；
- **并入存量主题**：
  - `topicPaths` 不变；
  - 可按需补齐该 topic 的 `topicMetadata`，但不得为了分类创建、重命名或拆分 topic；
  - 仅当口述规则**新增了触发场景**时，最小更新对应 `matchers/<id>.json` 的 `includeAny`；否则不动 matcher。

### 4d. 更新 `index.md`

- 新建主题：在主题表新增一行（同主题单行原则）；「关联文档（摘要）」列填「无」或「待补充」（口述规则通常无 stock-docs / req-docs 锚定文档），禁止留空；
- 并入存量主题：仅在主题意图发生变化时更新该行的「主题意图」摘要列，否则不动。

## 步骤 5：输出摘要（必须）

```markdown
## 规则捕获结果

### 口述规则
> <用户原文，1–3 行>

### 落盘决策
- 模式：新建 / 并入 / 跨主题拆分
- 目标：.Knowledge/topics/<id>.md（章节：<可选>）

### 知识库变更
- .Knowledge/topics/<id>.md：<新增 / 修订说明>
- .Knowledge/manifest-routing.json：<topicPaths / taskToTopicRules / topicDependencies 是否更新与原因>
- .Knowledge/matchers/<id>.json：<是否更新 includeAny 与原因>
- .Knowledge/index.md：<是否更新与原因>

### 待用户后续
- <如无 taskToTopicRules，提示"该规则当前不会被任务路由命中，需要时可补"；其它跟进项一并列出>
```

## 约束

- 不写代码、不动配置根 `rules/skills`、不创建 `.task/`。
- 用户未确认「新建 / 并入 / 跨主题拆分」前禁止落盘。
- 同主题优先并入，避免新建近似主题（参见 `f2s-topic-authoring` 命名"不要"项）。
- `manifest-routing.json` 与 `.Knowledge/index.md` 恒由主 agent 落盘（写权硬约束）。
- 路由清单仅做最小改动，不重写无关字段。
- 行文遵守统一入口「知识库落盘文风」与单文件篇幅软约束（口述规则通常 ≤ 30 行新增正文足矣）。

## 复杂场景示例

**场景 A：高重合并入**

用户口述：「写 commit message 时，第一行必须中文 emoji 开头」。
扫描发现已存在 `topics/f2s-git-commit.md`（描述 git commit 流程）。
- 步骤 3 提议：**并入** `topics/f2s-git-commit.md` 的「commit 文风」章节；
- 步骤 4a 在该章节追加规则段，不改其他章节；
- 步骤 4b 不新增依赖；
- 步骤 4c manifest 不动，仅在该 topic 对应 matcher（若存在）中补 1–2 个关键词；
- 步骤 4d index 不动。

**场景 B：新建主题**

用户口述：「所有面向用户的错误提示必须以动词开头，如『重试』『检查 X』而非『错误：X 失败』」。
扫描未找到合适宿主。
- 步骤 3 提议：**新建** `topics/error-message-style.md`；
- 步骤 4a 按骨架写入；
- 步骤 4b 评估是否依赖 i18n / 文案规范类既有 topic，命中则声明；
- 步骤 4c 判断「用户日常对话中是否会触发"错误提示文案"任务路由」——若会，补 `taskToTopicRules` + 新建 matcher；若仅作为内部规范被其它 SKILL 引用，则**不进** `taskToTopicRules`；
- 步骤 4d index 新增一行。

**场景 C：跨主题拆分**

用户口述：「按方案实现时不能边写边改文档；提交 PR 时必须先跑测试」。
明显涉及 `f2s-implement-tech-design`（实现纪律）和 `f2s-git-commit`（提交流程）两个主题。
- 步骤 3 暂停，呈现 A / B / C 三选项；
- 用户选 A → 拆为两条规则单元，分别并入两个主题；
- 步骤 4 在两个 topic 中分别落盘，输出摘要列出两条变更。

## 完成后自检

1. 是否在落盘前 Read 了 `rules/f2s-topic-authoring.*` 全文。
2. 是否在用户未确认「新建 / 并入 / 跨主题拆分」前提前落盘（必须为否）。
3. 新建 topic：`topicPaths` 是否补全；正文是否含五点骨架；`taskToTopicRules` 与 matcher 的 `includeAny` 是否符合「rule 是否需建对应 topic 路由」判据。
4. 若写入 `topicMetadata`：key 是否存在于 `topicPaths`；`primary` / `tags` / `confidence` 是否合法；是否未因分类改 topicId / 文件名。
5. 并入 topic：是否仅做手术式插入；是否未借机改写无关章节。
6. `topicDependencies` 是否经四问判定；是否引入冗余传递边或环。
7. `index.md` 与 `topics/` 文件集合是否一一对应；新建主题是否补「关联文档（摘要）」列。
8. 是否未触碰配置根 `rules/skills`；是否未创建 `.task/`。
9. 输出摘要是否齐全（口述原文 / 决策 / 变更 / 待跟进）。
