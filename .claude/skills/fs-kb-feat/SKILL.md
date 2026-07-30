---
name: fs-kb-feat
description: 新增能力时补全实现与知识库；已实现则仅同步知识库；触发：fs-kb-feat、新增能力
---

> **任务路径**：凡 `.task/` 落盘与续作，**必须以 `rules/fs-task` 解析的 `TASK_ROOT` 为准（`.task` 或 `.task/<developerId>`；config → git → legacy）。下文若仍出现 `.task/todo.json` / `.task/active/`，均视为 **`TASK_ROOT/...` 的简写**。


> 执行口径：`fs-kb-feat` 默认同步 `.flow-spec`，无需用户额外提出"请同步知识库"。

## 编排（主 / 子 agent）

- `subAgent` 与 `switchAgentVerification` 的语义以统一入口为唯一事实源：**Cursor/Claude** 读配置根 `rules/fs-flow-spec-unified-entry.*`；**Codex** 读 `.codex/fs-rules/fs-flow-spec-unified-entry.md`（与上同源，`flow-spec init` 镜像）。本处不复述。
- **代码子包**（新增 / 修改实现代码）：`subAgent=true` 时可外包给子 agent 执行。
- **文档子包**（rules / skills / topics / stock-docs 文风类改动）：默认不拆，由主 agent 写，以保证「现行真值覆盖 / 篇幅上限 / 禁历史否定堆砌」等文风合规。
- 若确需外包文档改动：子侧只输出「原位替换 diff」（before / after 小段），不得整文件重写；主合并落盘。
- **写权硬约束**：`manifest-routing.json` / `.flow-spec/index.md` 恒由主 agent 落盘，子 agent 不得触碰。
- 落盘侧自验。

# /新增能力（fs-kb-feat）

## 输入

- 用户描述新增能力、场景、边界、可选路径。

## 步骤

**步骤 0：变更追踪（仅当 `changeTracking.feat: true`）**

执行前读取 `flow-spec.config.json`，若 `changeTracking.feat: true`：

- 检查 `.task/todo.json` 是否存在活跃任务，将用户描述与 `keywords` 匹配。
- 命中 → 加载对应 `task.md`，展示剩余清单，在已有任务中继续。
- 无命中 → 创建新任务（见 `fs-task` 规则），将步骤 1–4 写入 `task.md` 作为任务 checklist。
- **执中必写盘**：每完成 `task.md` 中一步，**同一会话内**立即 `Edit` 将该步 `[ ]`→`[x]`；禁止把打钩积压到「收尾/归档」一步、禁止口头完成代替写盘（见 `fs-task`「中断与会话结束」「归档门禁」）。
- **用户代办**：凡须用户改库、配环境、点平台等项，**同会话内**追加写入 `.task/active/<task-name>/user-todos.md`（见 `fs-task`）；新建任务时若尚无代办，仍应创建该文件（可占位）。

1. 判断能力状态：未实现 / 部分实现 / 已实现。
2. 补齐代码实现（已实现则跳过此步）。
3. 同步知识库（默认执行）：
   - `.flow-spec/stock-docs/`：能力说明与使用方式
   - `.flow-spec/topics/`：新增/修订主题规则与流程
   - `.flow-spec/index.md`：主题索引
   - 路由清单：路由、依赖或 `topicMetadata` 变化时最小更新
   - **创作侧准则**：本步若新增 / 修改 topic、`topicMetadata` 或 `topicDependencies`，须先 Read `rules/fs-topic-authoring.*` 全文（**Cursor/Claude**：`rules/fs-topic-authoring.mdc`；**Codex**：`.codex/fs-rules/fs-topic-authoring.md`），再落盘。
4. 输出摘要（能力点、实现、知识库变更）。

## 输出摘要格式（建议）

```markdown
## 新增能力：<能力名>

### 能力范围
- <能力点1>
- <能力点2>

### 实现
- <文件路径>：<改动说明>（若未改代码则写"已有实现"）

### 知识库
- .flow-spec/stock-docs/<文件>.md：<新增/修订说明>
- .flow-spec/topics/<topic>.md：<新增/修订说明>
- .flow-spec/index.md：<更新说明>
- .flow-spec/manifest-routing.json：<是否更新与原因>
- .flow-spec/matchers/<id>.json：<是否更新 includeAny 与原因>
```

## 复杂场景示例

用户要求"新增失败重试队列能力"，且代码中已有半成品实现。

- 先判断为"部分实现"，补齐缺口代码而非重做整模块。
- 同步新增或修订 `topics/retry-queue.md`，并更新 `index` 入口说明。
- 若该能力需任务路由命中（如"重试队列改造"），补充 `manifest.taskToTopicRules`。

## 约束

- 与旧约定冲突时：**改写到当前真值**，不要另起「（不再与某 X 有关）」等历史否定句。
- 与现有主题重合时优先原位更新。
- 至少落一处知识库更新，避免"代码有了但不可检索"。
- 不改配置根 `rules/skills`。
- 文档子包默认不拆；必要外包子侧仅出 before/after diff 片段，主合并落盘；`manifest-routing.json` / `.flow-spec/index.md` 恒主落盘（写权硬约束）。

## 知识库落盘文风（必须，防赘述）

写 `stock-docs` / `topics` / `index` 时遵守：

1. **增量最小**：只追加或改写与**本次能力**直接相关的句段；禁止因「同步知识库」而全文重述背景、需求复述、与实现无关的教程式铺垫。
2. **肯定式优先（见统一入口「知识库落盘文风」）**：直接写出正确描述，禁止用否定旧版来传达新约定；排他性选择除外。
3. **不重复叙事**：同一事实在 `stock-docs` 与 `topics` **不要各写一长篇**；择一处写清可执行约定，另一处用短段落 + 链接指向，或仅列要点与引用路径。
4. **条文化优先**：`topics` 以规则、边界、步骤、错误与配置要点为主；能用列表/表格表达的不用长段落。
5. **篇幅上限（软约束）**：单次同步中，对**同一文件**的新增正文合计不宜超过约 **80 行**（不含代码块行）；超出则拆分为新 topic、或先写「摘要 + 详见代码路径/另一文档」，禁止单文件堆叠重复说明。
6. **`index.md`**：只改与本次主题相关的行/表项，禁止整表或整节复制粘贴式刷新。
7. **禁止**：重复解释 flow-spec 目录分工、重复贴用户对话全文、与本次 diff 无关的「历史回顾」大段。

## 完成后自检

1. 能力描述与代码实现是否一致。
2. 新增能力是否可通过 topic 被检索。
3. `index` 与 `manifest` 是否同步更新。
4. 若写入 `topicMetadata`：key 是否存在于 `topicPaths`；`primary` / `tags` / `confidence` 是否合法；是否未因分类创建、重命名或拆分 topic。
5. 知识库变更是否可再压缩：删掉与本次变更无关的套话后，规则与链接是否仍完整。
6. 是否仍存在「否定旧版 / 不再与某物有关」类赘句：若现行规则已写清，此类句应删或并入用户要求的迁移小节。
7. 子 agent 未整文件重写文档；manifest / index 由主 agent 单点落盘。
8. 若 `changeTracking.feat: true`：`task.md`「步骤」已全部 `[x]`（或备注已记录取消项）后，才将 `.task/active/<task-name>/` 归档至 `completed/` 并从 `todo.json` 删除对应条目；禁止在仍有 `[ ]` 时移动目录（与 `fs-task` 归档门禁一致）。
9. 若 `changeTracking.feat: true`：`user-todos.md` 已存在；有用户代办时内容已与会话结论一致。
