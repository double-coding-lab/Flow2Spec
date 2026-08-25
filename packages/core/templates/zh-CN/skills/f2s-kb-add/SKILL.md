---
name: f2s-kb-add
description: 工作中把已落地能力解析进知识库（多文件聚合）：初稿→终稿→topics/index/manifest；触发：f2s-kb-add、已有能力进知识库、多文件生成上下文
---

> 执行口径：本技能只维护 `.Knowledge`，不改配置根 `rules/skills`。

## 编排（主 / 子 agent）

- `subAgent` / `switchAgentVerification` 两字段语义以统一入口为唯一事实源：**Cursor/Claude** 读配置根 `rules/f2s-flow2spec-unified-entry.*`；**Codex** 读 `.codex/topics/f2s-flow2spec-unified-entry.md`（与上同源，`flow2spec init` 镜像）。
- 默认不拆子：主会话全流程完成；低于阈值时拆子收益低于 context 切换成本。
- 拆子阈值（仅当 `subAgent=true` 且任一满足）：① 输入路径 ≥ 5；② 单源文件 > ~3000 行；③ 多路径总量 > ~10000 行。
- **拆子策略（仅在达到拆子阈值且 `subAgent=true` 时启用）**：
  - **B 模式（默认，单轮并行）**：主先产出「inventory（待解析源文档路径清单 + 核心能力名，主手写，禁止子 agent 自行增删）」+「扫描契约（每个源读哪些章节 / 行号范围、禁扫目录、统一产出字段与表头）」→ 子 agent 并行只读按表填写 → 主一轮合并 + 去重 → 写 `.Knowledge/stock-docs/<方案名>_初稿.md` → 主做用户确认与验收。适合源边界较清晰、中等规模、希望尽快出一版。
  - **C 模式（大仓 / 高风险，多轮纠偏）**：在 B 之前或替代 B 首轮 —— 主先做 inventory → 子并行交表 → 主专做一轮**对表**（标重合 / 矛盾 / 缺依赖 / 跨源边界）→ 必要时对矛盾点补派小任务或主自读关键点 → 最后主写 / 改定稿。适合多 workspace / monorepo、目录极深、源路径 > 20 条、首轮子表矛盾或空洞明显、多源叙述重合或矛盾严重的场景。
  - **切换判据**（任一成立即切到 C）：多 workspace / monorepo；目录极深或源路径 > 20 条；首轮子表矛盾 / 空洞明显；多源叙述重合 / 矛盾严重。
- **子交付硬约束**：子 agent 不得自行裁剪源路径范围，必须按主手写 inventory 执行；交付按「子交付 YAML schema」（字段：`source` / `scope` / `capabilities` / `cross_refs` / `pending`），禁止散文式回传；子不得写 `manifest-routing.json` / `.Knowledge/index.md`；子不得单独宣布「已进知识库」。
- 主必控：重合判定、终稿定稿、`f2s-kb-build` 调度、整体验收。
- 写权硬约束：`manifest-routing.json` 与 `.Knowledge/index.md` 恒由主 agent 落盘。
- 落盘侧自验。

# f2s-kb-add：多文件聚合 -> 初稿 -> 终稿 -> 知识路由同步

## 使用时机

- 某能力已在代码中落地，但信息分散在多个文件，需沉淀为可检索知识。
- 与 `f2s-doc-arch` 区分：`doc-arch` 产出架构初稿；`doc-add` 产出“已落地能力”知识沉淀链路。

## 输入

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| 文件路径列表 | 是 | 一个或多个路径（空格/换行/`@`）；支持源码、配置、文档 |
| 方案名 | 否 | 用于生成 `<方案名>_初稿.md`、`<方案名>_终稿.md` |
| 初稿/终稿路径 | 否 | 默认放 `.Knowledge/stock-docs/` |

无有效路径时中止并要求用户补充。

## 步骤 0：重合判定（重要）

执行前先对照：

- `.Knowledge/index.md`
- `.Knowledge/topics/*.md`
- `.Knowledge/stock-docs/*.md`

若已有同主题沉淀，优先原位更新，避免重复主题和重复索引行。

## 步骤 0.5：多模块检测（输入路径 ≥ 2 时必须执行）

1. **目录聚合**：按路径中的功能层目录（如 `src/<模块名>/`、顶层目录名）对文件分组。
2. **判定规则**（满足任一即判定为「多模块」）：
   - 文件分属 ≥ 2 个不同顶层功能目录（如 `auth/`、`payment/`）；
   - 用户在输入中明确提及「多个功能 / 不同模块 / 分别处理」等；
   - 文件名前缀明显不同且无共同父目录。
3. **单模块（未触发判定）**：不中断，继续步骤 1，按现有单输出逻辑生成 `<方案名>_初稿.md`。
4. **多模块（触发判定）**：**暂停**，向用户展示分组结果，并询问：
   - **方案 A（推荐）**：按模块分别生成知识文件 → 每组独立走步骤 1→2→3→4，各自产出 `<模块名>_初稿.md` / `<模块名>_终稿.md`；
   - **方案 B（合并）**：忽略模块边界，合并生成一份 `<方案名>_初稿.md`（原有行为）。
   - **禁止**在未获用户明确选择前默认走方案 B 继续执行。
5. **单模块但 stock-doc 体量大**：若单份输入文档或聚合后的源码超过 **300–500 行**，或涵盖 **3 个以上不相干职责域**，建议向用户提示"可拆成多份 focused stock-doc，各自对应独立 topic"；用户确认继续则不阻断，但在输出摘要中记录"建议后续拆分"。

## 步骤 1：适度深度解析

- 小文件通读；
- 大文件优先结构与关键片段（导出、接口、配置、流程）；
- 不确定内容显式标注”待确认”，禁止编造。
- 若任一拆子阈值满足（输入路径 ≥ 5 / 单源 > ~3000 行 / 多路径总量 > ~10000 行）且 `subAgent=true`，按 B 模式（默认）或 C 模式（达成切换判据时）拆子并行只读扫描；否则主全流程。**启用拆子时，子 agent 必须按主手写 inventory 与扫描契约执行，不得自行增删源路径。**

## 步骤 2：生成初稿

- 默认输出：`.Knowledge/stock-docs/<方案名>_初稿.md`
- 初稿建议结构：
  - 概述
  - 来源清单（含不可读文件）
  - 分模块归纳
  - 交叉关系
  - 待确认项

## 步骤 3：生成终稿

- 参考 `.Knowledge/template/终稿模版.md`
- 输出：`.Knowledge/stock-docs/<方案名>_终稿.md`
- **必须填写 `## 来源文件` 小节**，列出步骤 1 实际读取的原始源文件路径
- 若用户要求”先审初稿”，则停在初稿并等待确认

## 步骤 4：同步知识路由

基于终稿调用 `f2s-kb-build` 口径，更新：

- `.Knowledge/topics/`
- `.Knowledge/index.md`
- 路由清单（必要时）
- `manifest-routing.json.topicMetadata`（按需）：仅给已存在或本次确认创建的 topicId 写入 `primary` / `tags` / `confidence`；`tags` 可省略，且不得与 `primary` 重复。分类只用于治理、审计和阅读预期，不参与路由或执行强制性；证据不足时不写 metadata，并在摘要列为待确认；不得为了分类单独创建、重命名或拆分 topic。

> **创作侧准则**：本步骤会触发新增 / 修改 topic 与 `topicDependencies`，**须先 Read** `rules/f2s-topic-authoring.*` 全文（**Cursor/Claude**：`rules/f2s-topic-authoring.mdc`；**Codex**：`.codex/topics/f2s-topic-authoring.md`），再调用 `f2s-kb-build` 口径同步。

## 输出摘要（必须）

1. 初稿/终稿路径
2. 更新的 topic/index/路由清单 路径
3. 未完成项与原因（如路径无效、信息不足）

## 复杂场景示例

用户输入 6 个文件（代码、配置、旧文档混合），其中 2 个路径不可读。

- 先继续处理可读文件，初稿中明确列出不可读路径和缺口，不因部分失败中断全流程。
- 若发现已有 `.Knowledge/stock-docs/<能力名>_终稿.md`：优先在该终稿上修订，而不是新建重复终稿。
- 用户要求”先审初稿”：必须停在初稿，等待确认后再生成终稿并进入 `f2s-kb-build` 同步。

用户输入 3 个文件：`src/auth/login.ts`、`src/payment/checkout.ts`、`src/notification/email.ts`。

- 步骤 0.5 检测到文件分属 `auth/`、`payment/`、`notification/` 三个不同顶层功能目录，判定为「多模块」。
- 向用户展示分组：`auth` 组 1 个文件、`payment` 组 1 个文件、`notification` 组 1 个文件；询问方案 A（分别生成）或方案 B（合并）。
- 用户选方案 A：按 `auth`、`payment`、`notification` 三组各走步骤 1→2→3→4，分别产出 `auth_初稿.md`、`payment_初稿.md`、`notification_初稿.md`。
- **禁止**在用户选择前直接合并三个模块生成 `综合_初稿.md`。

## 约束

- 终稿 `sourceDoc` 仅指向 `.Knowledge/stock-docs/*`
- 不改配置根 `rules/skills`
- 同主题优先更新，不平行新建重复知识
- `manifest-routing.json` 与 `.Knowledge/index.md` 恒由主 agent 落盘（写权硬约束），子 agent 不得触碰

## 完成后自检

1. 初稿/终稿路径是否落在 `.Knowledge/stock-docs/`。
2. 同主题是否避免重复新建。
3. topic/index/manifest 是否与终稿语义一致。
4. 若写入 `topicMetadata`：是否只覆盖已存在或本次已创建的 topicId；`primary` / `tags` / `confidence` 是否合法；是否避免类型前缀命名与重命名。
5. 输入路径 ≥ 2 时，步骤 0.5 是否执行了多模块检测；若判定为多模块，是否向用户展示了分组并等待了明确选择，未默认合并输出。
