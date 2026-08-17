---
name: f2s-kb-fix
description: 根据用户指出的实现或规则错误修正代码，并默认同步知识库；触发：f2s-kb-fix、修正实现规则
---

> **任务路径**：凡 `.task/` 落盘与续作，**必须以 `rules/f2s-task` 解析的 `TASK_ROOT` 为准（`.task` 或 `.task/<developerId>`；config → git → legacy）。下文若仍出现 `.task/todo.json` / `.task/active/`，均视为 **`TASK_ROOT/...` 的简写**。


> 执行口径：`f2s-kb-fix` 默认"修代码 + 同步 `.Knowledge`"，无需用户额外要求"请同步知识库"。

## KB 自动合并协议（必须）

本技能不得把“人工执行命令”作为用户流程。修复完成后，由 agent 自己完成知识候选生成、合并、构建与校验：

1. 将本次修复后的正确规则/实现边界转换为 `kb-delta` 草稿，记录 `taskId`、`developerId`、`baseRevisions`、`changes` 与修复证据；若 `changeTracking.fix=true` 且已有任务目录，可把 delta 落在当前 `TASK_ROOT/active/<task-name>/kb-delta.json`，否则可在内存中形成等价对象。`changes` 可使用 `appendBody` / `replaceBody` / `updateFrontmatter`；确需新主题时使用 `createTopic`，并可携带 `taskRule` 与 `matcher` 让路由一并接入。
2. 写入 `.Knowledge` 前，必须用 `flow2spec kb plan <delta>` 或等价内部能力预演；若 topic revision 不一致，停止自动写入，转入语义合并说明。
3. 可自动合并时，由 agent 调用 `flow2spec kb apply <delta>` 或等价内部能力写入 topic，并随后执行 `flow2spec kb build` 与 `flow2spec kb check`。
4. 用户只看到“修复与知识库已同步 / 有语义冲突需确认 / 已跳过入库及原因”，不要求用户手动执行 `kb plan/apply/build/check`。

## 编排（主 / 子 agent）

- 两字段（`subAgent` / `switchAgentVerification`）语义以统一入口为唯一事实源：**Cursor/Claude** 读配置根 `rules/f2s-flow2spec-unified-entry.*`；**Codex** 读 `.codex/topics/f2s-flow2spec-unified-entry.md`（与上同源，`flow2spec init` 镜像）。本处不复述。
- 代码子包（bug 修复类实现代码）：`subAgent=true` 时可外包给子 agent 执行。
- 文档子包（rules / skills / topics / stock-docs 等文风类改动）：默认不拆，由主 agent 直接编写，以保证「现行真值覆盖 / 篇幅上限 / 禁历史否定堆砌」等文风合规。
- 若确需外包文档改动：子侧**只输出「原位替换 diff」**（before / after 小段），**不得整文件重写**；由主 agent 合并落盘。
- 写权硬约束：`manifest-routing.json` / `.Knowledge/index.md` 恒由主 agent 落盘，子 agent 不得触碰。
- 落盘侧自验。

# /修正能力（f2s-kb-fix）

## 输入

- 用户描述违规点、正确写法、可选范围。

## 步骤

**步骤 0：变更追踪（仅当 `changeTracking.fix: true`）**

执行前读取 `flow2spec.config.json`，若 `changeTracking.fix: true`：

- 检查 `.task/todo.json` 是否存在活跃任务，将用户描述与 `keywords` 匹配。
- 命中 → 加载对应 `task.md`，展示剩余清单，在已有任务中继续。
- 无命中 → 创建新任务（见 `f2s-task` 规则），将步骤 1–4 写入 `task.md` 作为任务 checklist。
- **执中必写盘**：每完成 `task.md` 中一步，**同一会话内**立即 `Edit` 将该步 `[ ]`→`[x]`；禁止积压打钩或口头完成代替写盘（见 `f2s-task`「中断与会话结束」「归档门禁」）。
- **用户代办**：凡须用户改库、配环境、回归验证等项，**同会话内**追加写入 `.task/active/<task-name>/user-todos.md`（见 `f2s-task`）；新建任务时若无代办可写占位说明。

1. 明确违规点与影响范围（不清先追问）。
2. 修复代码实现。
3. 同步知识库（默认执行）：
   - `.Knowledge/stock-docs/`：修订约定说明
   - `.Knowledge/topics/`：修订对应主题规则/流程
   - `.Knowledge/index.md`：更新主题索引
   - 路由清单：若路由、依赖或 `topicMetadata` 受影响则最小更新
   - **创作侧准则**：本步若新增 / 修改 topic、`topicMetadata` 或 `topicDependencies`，须先 Read `rules/f2s-topic-authoring.*` 全文（**Cursor/Claude**：`rules/f2s-topic-authoring.mdc`；**Codex**：`.codex/topics/f2s-topic-authoring.md`），再落盘。
4. 输出摘要（代码改动 + 知识库改动）。

## 输出摘要格式（建议）

```markdown
## 修正结果：<约定简述>

### 代码
- <文件路径>：<改动说明>

### 知识库
- .Knowledge/stock-docs/<文件>.md：<新增/修订说明>
- .Knowledge/topics/<topic>.md：<新增/修订说明>
- .Knowledge/index.md：<更新说明>
- .Knowledge/manifest-routing.json：<是否更新与原因>
- .Knowledge/matchers/<id>.json：<是否更新与原因>
```

## 复杂场景示例

用户指出「某回调接口幂等实现错误」，但未给明确文件范围。

- 先按最小可行范围修复已定位的回调处理链路，并在摘要中说明"可继续扩展全仓同类修复"。
- 同步更新 `topics` 中幂等规则段落，避免后续再次生成错误实现。
- 若该修复影响任务路由（例如新增"幂等修复"主题），再最小更新 `manifest`。

## 约束

- 与旧约定冲突时：**改写到当前真值**，不要叠写「（不再与某 X 有关）」等对照旧版的赘句。
- 同主题优先原位更新。
- 范围不明时按最小可行范围修复并说明。
- 不改配置根 `rules/skills`。
- 文档子包默认不拆；必要外包子侧仅出 before/after diff 片段，主合并落盘；`manifest-routing.json` / `.Knowledge/index.md` 恒主落盘（写权硬约束）。

## 知识库落盘文风（必须，防赘述）

写 `stock-docs` / `topics` / `index` 时遵守：

1. **增量最小**：只改与**本次修复**直接相关的段落或列表项；禁止借机重述整份方案、整段历史背景或与修复无关的说明。
2. **肯定式优先（见统一入口「知识库落盘文风」）**：直接写出正确描述，禁止用否定旧版来传达新约定；排他性选择除外。
3. **不重复叙事**：`stock-docs` 与 `topics` 不就同一修复各写长篇；一处写清「错因 / 正确约定 / 注意点」，另一处简短引用或链到该段。
4. **条文化优先**：以「错误表现 → 根因 → 正确行为 / 边界」为序的短列表为主，避免散文式展开。
5. **篇幅上限（软约束）**：单次同步中，对**同一文件**的新增或替换正文合计不宜超过约 **60 行**（不含代码块行）；超出则只保留与修复相关的最小说明，其余用「见提交/见某路径」代替。
6. **`index.md`**：仅更新受影响的索引行或摘要列，禁止无关整表重写。
7. **禁止**：重复粘贴用户报错全文（可摘一行标识 + 链接）、重复解释 Flow2Spec 用法。

## 完成后自检

1. 代码修复是否覆盖用户点名范围。
2. 主题文档是否与修复后的实现一致。
3. `index` 是否指向正确主题。
4. 若更新了 `manifest`，路由字段是否仍可解析。
5. 若写入 `topicMetadata`：key 是否存在于 `topicPaths`；`primary` / `tags` / `confidence` 是否合法；是否未因分类创建、重命名或拆分 topic。
6. 知识库变更是否可再压缩：删套话后约定是否仍清晰。
7. 是否仍存在「否定旧版 / 不再与某物有关」类赘句：现行规则已写清则应删。
8. 子 agent 未整文件重写文档；manifest / index 由主 agent 单点落盘。
9. 若 `changeTracking.fix: true`：`task.md`「步骤」已全部 `[x]`（或备注已记录取消项）后，才归档至 `completed/` 并从 `todo.json` 删除对应条目；禁止在仍有 `[ ]` 时移动目录（与 `f2s-task` 归档门禁一致）。
10. 若 `changeTracking.fix: true`：`user-todos.md` 已存在；有用户代办时内容已与会话结论一致。
