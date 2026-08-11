---
description: Flow2Spec 主题创作准则：topic 命名 / 骨架 / topicMetadata / topicDependencies 判定 / rule 是否需建对应 topic / 写盘权属指针
alwaysApply: false
---
# Flow2Spec 主题创作准则（Topic Authoring）

本条为 **创作侧** 单一事实源；凡 `f2s-*` 技能在新增或修改 `.Knowledge/topics/<topic>.md`、调整 `manifest-routing.topicMetadata` / `manifest-routing.topicDependencies`、删除 / 迁移 topic 时，**必须先 Read 本条全文**，再按对应 SKILL 的步骤继续。与 `f2s-flow2spec-unified-entry`（消费侧）**并存**；硬冲突时以统一入口为准。

## 适用范围

满足下列任一即「触达本条」：

- 新增或重写 `.Knowledge/topics/<topic>.md`；
- 修改既有 topic 的标题 / 适用场景 / 关键流程边界；
- 新增、删除或调整 `manifest-routing.topicMetadata`；
- 在 `manifest-routing.topicDependencies` 中新增、删除或调整依赖边；
- 在 `taskToTopicRules[].topics` 中新增引用某个 topic id；
- 删除或迁移 topic（`f2s-kb-rm` / `f2s-kb-migrate` / `f2s-kb-upgrade`）。

## 1. topic 命名

- **id**：`kebab-case`，与 `manifest-routing.topicPaths` 的 key 一致。
- **文件名**：`.Knowledge/topics/<topic-id>.md`；若该 topic 与同名 `f2s-*` 技能 / 规则强绑定（如 `f2s-task` / `f2s-req-plan`），文件名可加 `f2s-` 前缀以示同源。
- **不要**：版本后缀（`-v2` / `-new`）、个人花名、与 `index.md` 行级标题冲突的同义词。

## 2. topic 定位与正文骨架

**topic 的定位**：可执行路由摘要 + 关键边界。topic 可以包含必要的边界说明、关键流程步骤、禁止项、配置摘要——Agent 读完即可执行或判断是否需要继续下钻；**不应承载**完整实现细节、长文背景或可在 stock-doc 里查的原始内容。stock-doc 承载完整背景与长文细节，topic 指向它。

**长文背景引用的目录边界（硬约束）**：topic 中「详细背景 / 相关资料 / 长文来源 / 参考文档」等**指向长文源**的引用槽位，**只允许**指向 `.Knowledge/stock-docs/*_终稿.md` 或已被归档为长文事实的 `stock-docs/*`；**禁止**把这类槽位挂到 `.Knowledge/req-docs/*`（含澄清 / 技术方案 / SQL / PRD 等）——`req-docs` 是本次交付的**临时输入**，用完会随任务归档或迁移，作为 topic 的长文事实源是悬空引用。若同步 / 新建 topic 时相应 `stock-docs/*_终稿.md` 尚未生成，**必须先触发 `f2s-doc-final` 沉淀终稿**（或与用户确认由手写补齐），再让 topic 指向终稿；不得跳过终稿直接把 topic 挂在 `req-docs` 上。**允许**：topic 正文可**短引**方案里的一句结论或一个字段名作为佐证（如「见 `.Knowledge/req-docs/xxx_技术方案.md`」的偶发点引），但**长文背景槽位**（"详细背景 / 相关资料"整节）仍须指向 stock-doc。

每个 topic 至少包含：

1. **标题与一句话意图**（一行写清"该 topic 解决什么"）；
2. **适用场景 / 触发词**（与对应 `matchers/<id>.json` `includeAny` 语义一致）；
3. **核心规则 / 流程**（可执行知识；步骤须可由 Agent 复现）；
4. **依赖声明**（若 `topicDependencies` 中存在依赖项，正文须显式写一句「执行前须先读依赖主题 `<dep>`」，参考 `topics/f2s-req-plan.md` 首段写法）；
5. **边界与禁止项**（避免膨胀到隔壁 topic）；
6. **长文背景 / 详细资料引用**（如需承载业务背景）：只列 `.Knowledge/stock-docs/*_终稿.md` 的可点击 Markdown 链接（1–3 条即可）；**禁止**直接列 `.Knowledge/req-docs/*` 作为长文背景来源；无对应终稿时**先生成终稿**再回填此小节。

## 3. topicMetadata 判定准则

`topicMetadata` 是治理元数据，只影响盘点、审计和阅读预期；不参与 matcher 命中，不决定是否读取 topic，不改变执行强制性。执行强制性以 `AGENTS.md`、rules、skills 与 topic 正文明确要求为准。

字段：

- `primary`：主分类，单值，取 `feature` / `module` / `config` / `policy`。
- `tags`：可选，数组，取值范围同 `primary`，不得与 `primary` 重复。用于描述 topic 同时包含的次要性质，仅作审计/阅读预期，不参与路由或执行。
- `confidence`：取 `manual` / `inferred`。

判定：

1. `topicMetadata` key 必须存在于 `topicPaths`；仅给已存在或本次确认创建的 topicId 写入。
2. `primary` 取 topic 最核心的性质：读 topic 正文，判断其主要内容属于哪个类型，写入 `primary`。
3. `config`：配置项、开关、默认值、初始化参数；仅当这些内容构成 topic 的主要语义时才可作为 `primary`。
4. `policy`：流程、规则、约束、门禁、禁止项、agent 编排、技能步骤；仅当这些内容构成 topic 的主要语义时才可作为 `primary`。。
5. `feature`：已落地业务 / 产品能力。
6. `module`：公共能力、公共包、模块边界与工程结构
7. topic 同时覆盖多个性质时，最主要性质写 `primary`，其余明确成立的性质写 `tags`（可选数组，元素取值同 `primary`，不得与 `primary` 重复）。
8. `manual` 仅用于用户或维护者明确确认分类值；有明确证据但未人工确认分类值时写 `inferred`。证据不足时**不写 metadata**，但须在摘要中列出推断方向与依据（如「建议 policy，正文含多处强制约束」），供用户确认后手动补写 `manual`。**禁止仅凭 topicId 名称推断分类，必须 Read topic 正文后再判断。** **`inferred` 不需要用户事先同意即可直接落盘**：证据足够时按本条直接写入；只有当用户/维护者主动指定分类、或证据矛盾需要决断时，才升级为 `manual`。把 `inferred` 当作"待用户同意"是常见误读，等同于把"有依据的自动归类"硬变成"必须人工确认"，与本条第 7 项允许 `inferred` 落盘的语义冲突。

禁止：为了分类创建、重命名、拆分 topic；在 topic markdown 正文或 `index.md` 中重复写分类块。

## 4. topicDependencies 判定准则

设当前主题为 A、候选依赖为 B。**四问命中任一即声明 `A → B`**：

1. **前置规则强引用**：A 的执行步骤**显式提到** B 的术语 / 产物 / 落盘约束（例：`f2s-req-plan` 要求「按 `f2s-task` 维护 `.task/`」）。
2. **缺 B 必出错**：仅读 A 不读 B 能否产出对的结果？答否——典型为 A 写"怎么做"、B 写"在哪做 / 用哪份输入"。
3. **共享落盘目标**：A、B 写同一组文件且 B 定义写盘格式（如 `.task/`、`.Knowledge/topics/`）。
4. **fallback 跳转 B**：A 自身覆盖不全，按现有约定回落 B 兜底。

**反向排除**（避免依赖膨胀）：

- 仅术语相邻（都谈"知识库"）→ 不写依赖，靠 `index.md` 语义边界即可。
- 跨主题信息互查（A 想"了解一下" B）→ 不写依赖，靠 `taskToTopicRules` 次高候选 + `expand` 补召回。
- **概述 → 详情导航**：大功能主 topic 与其子模块 topic 之间是"关联/导航"关系，不是强前置依赖——子模块 topic 通过各自的 matcher 独立命中，不写 `A → B`；主 topic 正文里写子模块 stock-doc 的可点击链接作为导航入口。
- **传递依赖不重复声明**：若 `A→B`、`B→C` 已成立，禁止再写 `A→C`（读 B 时会自然带上 C）。

**DAG 与最小化**：`topicDependencies` 必须是 DAG，禁止环；保持最小边集。

**判定时机**：终稿与新 / 改 topic 落盘后，扫正文中**反引号引用的其他 topic id 与规则文件名**，逐个套四问；命中即写入 `manifest-routing.topicDependencies`，**并在新 topic 正文显式写依赖声明**（见骨架第 4 条）。

## 5. 大功能拆分策略

当一个业务功能体量较大时，推荐「主 topic + 子 topic」结构，而非单个大 topic。

**何时拆分（软约束，满足任一评估是否需拆）**：

- 对应 stock-doc 超过 **300–500 行**：建议评估拆分，不强制阻断；
- matcher `includeAny` 超过 **12 个**：主题过宽信号；
- topic 正文包含超过 **3 个不相干职责域**的二级标题；
- `f2s-kb-upgrade` 审计时发现同一 topic 被多种不相干任务类型反复命中。

**拆分方式**：

- **主 topic**（`primary: feature`）：写业务闭环、入口边界、子模块索引，正文里用可点击 stock-doc 链接指向各细节文档；不写子模块的实现细节。
- **子模块 topic**：按实际语义各自写 `feature` / `module` / `config` / `policy`，不预设类型；各自拥有独立 matcher，通过细分触发词独立命中。
- **stock-doc**：允许长文；超过阈值时建议拆成多份 focused stock-doc（如 `<功能名>-业务规则_终稿.md`、`<功能名>-数据模型_终稿.md`），每份对应一个子 topic。

**不要做的事**：

- 不用 `topicDependencies` 表达"概述 → 详情"导航关系（见第 4 节反向排除）；
- 不为拆分而强行制造子 topic，若子模块本身不会被独立路由命中，不必建 topic。

## 6. rule 是否需新建对应 topic

判据：**该 rule 是否会作为用户任务路由命中**。

- **会**（用户问 / 输入会触发该规则的执行）→ 须在 `.Knowledge/topics/` 建对应路由摘要，并在 `taskToTopicRules` 配置入口。例：`f2s-task`（变更追踪用户场景命中）、`f2s-implement-tech-design`（"按方案实现"用户场景命中）。
- **不会**（仅被其他规则 / SKILL 内部引用，用户不会直接发起）→ **不建** topic。例：`f2s-knowledge-preflight`、`f2s-karpathy-guidelines`、`f2s-config-check`、本条 `f2s-topic-authoring`。

误区：「重要的规则就该有 topic」——重要不等于"用户路由命中"；让消费方 SKILL 在正文里直接 `Read rules/<id>.*` 全文即可，无需走 manifest 路由。

## 7. 写盘权属（指针）

`manifest-routing.json` / `.Knowledge/index.md` / `.Knowledge/topics/*.md` 的写权约束**以 `f2s-flow2spec-unified-entry` 与各 SKILL 内「写权硬约束」为准**，本条不复述；遇分歧以统一入口与对应 SKILL 为准。

## 禁止项

- 在未读本条的情况下新增 / 修改 topic 或 `topicDependencies`。
- 为补分类单独创建、重命名或拆分 topic。
- 在 topic 正文或 `index.md` 中写 `## 概念分类` 等 metadata 副本。
- 把"重要的规则"硬塞进 `taskToTopicRules`（参见第 4 条）。
- 用 `topicDependencies` 表达"信息相关"（应通过 `index.md` 语义边界 + matcher 关键词补召回，而非依赖边）。
- 在 `topicDependencies` 中写传递冗余边或形成环。
- **在 topic 的「长文背景 / 详细资料 / 相关资料 / 长文来源 / 参考文档」等指向长文源的整节引用槽位里，列出 `.Knowledge/req-docs/*`**（含澄清 / 技术方案 / SQL / PRD）。此类槽位只允许指向 `.Knowledge/stock-docs/*_终稿.md`；无终稿时须先生成再回填。短句/佐证式的偶发点引不受此约束。