---
name: f2s-req-plan
description: 根据技术方案/需求描述/变更描述规划并实现任务；始终按 f2s-task 维护 .task/；支持子 agent 并行实现；触发：f2s-req-plan、创建任务、任务规划、我需要任务清单
---

> **任务路径**：凡 `.task/` 落盘与续作，**必须以 `rules/f2s-task` 解析的 `TASK_ROOT` 为准（`.task` 或 `.task/<developerId>`；config → git → legacy）。下文若仍出现 `.task/todo.json` / `.task/active/`，均视为 **`TASK_ROOT/...` 的简写**。


# 需求任务规划与实现（f2s-req-plan）

从需求/技术方案出发，完整覆盖「规划 → 实现」链路。**不依赖** `changeTracking.*`，但 **`.task/` 全生命周期必须以 `f2s-task` 为唯一真值源**（目录、格式、续作、打钩、归档、user-todos）。知识库同步由用户后续按需调用 `f2s-kb-feat` / `f2s-kb-sync`。

## 与 f2s-task 的关系（硬约束）

| 项 | 说明 |
| --- | --- |
| **真值源** | 配置根 **`rules/f2s-task.*`**（`alwaysApply: true`）；Codex 读 **`.codex/topics/f2s-task.md`**（init 镜像，与 rules 同源） |
| **本技能职责** | 规划草稿、实现代码、子 agent 编排；**不得**自定 `.task/` 结构或弱化打钩/归档 |
| **与 changeTracking** | `f2s-req-plan` **不受** `changeTracking.feat/fix/implement` 约束，**始终**走任务清单；见 `f2s-task`「生效条件」 |

**三端读取 `f2s-task` 全文（步骤 0 必做，先于下文任何步骤）**：

| 端 | 路径 |
| --- | --- |
| **Cursor** | 配置根 `rules/f2s-task.mdc`；或已 init 的 `.cursor/rules/f2s-task.mdc` |
| **Claude Code** | `.claude/rules/f2s-task.md` |
| **Codex** | `.codex/topics/f2s-task.md` |

## 编排（主 / 子 agent）

- `subAgent` / `switchAgentVerification` 以统一入口为唯一事实源：**Cursor/Claude** → `rules/f2s-flow2spec-unified-entry.*`；**Codex** → `.codex/topics/f2s-flow2spec-unified-entry.md`。
- **步骤 1（续作分诊 + 解析）**：主 agent 必做 `f2s-task`「任务开始」1–2；解析文档可拆子 agent（只读）。
- **步骤 2（草稿确认）**：必须主 agent；未确认前禁止创建 `.task/` 或写业务代码。
- **步骤 3（落盘）**：按 `f2s-task`「任务开始」3.a–3.f；`todo.json` **仅主 agent**；`task.md` / `context.md` / `user-todos.md` 初稿可子 agent，`user-todos.md` 执行中追加由主 agent 合并。
- **步骤 4（实现）**：子 agent 只写业务代码；**禁止**子 agent 写 `todo.json`、改 `task.md` checkbox；打钩由主 agent 在合并后当步完成。
- **步骤 5（归档）**：主 agent；**仅**满足 `f2s-task`「任务完成」归档门禁后执行。
- worktree 卫生见 `f2s-flow2spec-unified-entry`；中断/结束见 `f2s-task`「中断与会话结束」。

## 输入（任选其一）

- 技术方案路径（`.Knowledge/req-docs/*.md` 或 PDF）
- 需求 / 变更描述（自由文本）

## 步骤

### 步骤 0：前置（强制，任何步骤之前）

1. **`Read("flow2spec.config.json")`**（项目根；缺失字段视为 `false`）。
2. **`Read` 上表三端之一的 `f2s-task` 全文**（不得跳过；不得仅用本 SKILL 摘要代替）。
3. 按读到的 `subAgent` / `switchAgentVerification` 决定下文是否拆子 agent、是否交叉校验。

### 步骤 1：续作分诊 + 解析输入

#### 1a. 续作分诊（`f2s-task`「任务开始」1–2，主 agent）

1. 若存在 **`.task/todo.json`**，`Read` 并将**用户本条输入**与各条目 **`keywords`** 匹配。
2. **命中 1 个** → `Read` 对应 `task.md`、`context.md`；若存在则 `Read` **`user-todos.md`**；向用户展示剩余 checklist 与未勾用户代办；询问是否**续作**该任务。
   - 用户确认续作 → **加载本 SKILL 全文**（`linkedSkill` 应为 `f2s-req-plan`），从 `task.md` 首个 `[ ]` 继续；**禁止**新建重复 `active/` 目录；**跳至步骤 4**（若仍需补充规划，先在「## 备注」记录后再实现）。
   - 用户明确要**新任务** → 进入 1b。
3. **命中多个** → 列出候选，让用户选择续作哪一个或新建。
4. **无命中** → 检查**孤儿 `active/`**（`f2s-task`）：若有未归档且含 `[ ]` 的 `task.md`，提示是否续作或恢复 `todo.json`；否则进入 1b。
5. **无 `todo.json`** → 进入 1b。

#### 1b. 解析输入（新任务或待草稿）

`subAgent=true` 时可拆子 agent 并行只读：

- 读取方案/需求全文，提取目标、范围、工作项、涉及文件
- 读取 `.Knowledge/stock-docs/` 等对齐上下文
- PDF 先 `f2s-doc-pdf` 转 MD

子 agent 只交「解析摘要」；`subAgent=false` 时主 agent 完成。→ **步骤 2**。

### 步骤 2：输出草稿并确认（必须主 agent）

主 agent 输出：

1. **任务名称**（snake_case）
2. **实现清单草稿**（每步可 checkbox，将写入 `task.md` 的「## 步骤」）
3. **涉及文件列表**（将写入 `context.md`）
4. **建议 `keywords`**（2–5 个，供 `todo.json` 续作匹配）
5. **等待用户确认**

> **未确认前**禁止：创建 `.task/`、写 `todo.json`、写业务代码。

### 步骤 3：落盘任务清单（`f2s-task`「任务开始」3.a–3.f）

用户确认后，**严格按 `f2s-task` 执行**（格式以该规则正文为准，不得省略文件）：

| 子步 | 动作 | 写权 |
| --- | --- | --- |
| 3.a | 确认 `<task-name>`（snake_case） | 主 |
| 3.b | 创建 `.task/active/<task-name>/` | 主或子（初稿） |
| 3.c | 写入 **`task.md`**：`# 任务名` + `## 步骤` + `- [ ]` 列表 + 空 `## 备注` | 主或子 |
| 3.d | 写入 **`context.md`**：涉及文件、`.Knowledge` 资料链接；用户代办指向 `user-todos.md` | 主或子 |
| 3.e | 创建 **`user-todos.md`**（固定文件名；无代办时写占位说明） | 主或子 |
| 3.f | **`todo.json` 新增条目**：`name`、`folder`、`keywords`（含步骤 2 建议词）、`linkedSkill: "f2s-req-plan"`、`createdAt` | **仅主 agent** |

**禁止**：只建 `task.md` 不写 `todo.json`；省略 `user-todos.md`；使用 `completed/<task-name>-<date>` 旧式归档名。

### 步骤 4：实现代码

遵守 `f2s-task`「**执行中**」「**中断与会话结束**」：

- 按 `task.md` 顺序实现；**每真实完成一步**，主 agent **立即** `Edit` 该步 `[ ]` → `[x]`（禁止批量勾选、禁止仅口头完成）。
- 凡须用户改库/配环境/审批等，**同会话**追加 **`user-todos.md`**（按日期分节）；禁止只写在对话或 `task.md` 正文。
- `subAgent=true`：子 agent 只改业务源码；回报后由主 agent 打钩与写 `user-todos.md`。
- 合并子 agent 后清理 **git worktree**（见统一入口）。

### 步骤 5：归档任务（`f2s-task`「任务完成」）

**归档门禁**（自检通过后才移动目录）：

- `task.md`「## 步骤」中与本次交付相关项 **全部为 `[x]`**（取消项已在「## 备注」说明）。
- 仍有 `[ ]` → **禁止**移入 `completed/`、**禁止**删 `todo.json` 条目。

通过后：

1. `.task/active/<task-name>/` → `.task/completed/<YYYYMMDD>-<task-name>/`（**日期 8 位在前**）
2. 从 `todo.json` 删除该条；空数组则删文件
3. `user-todos.md` 随目录一并归档

### 步骤 6：输出摘要

```markdown
## f2s-req-plan 完成：<任务名>

### 实现
- <文件路径>：<改动说明>

### 任务清单
- 已归档：`.task/completed/<YYYYMMDD>-<task-name>/`（或仍 active 时写明路径与剩余 `[ ]`）

### 待办（知识库）
- 可后续调用 f2s-kb-sync / f2s-kb-feat

### 用户代办
- 见 `user-todos.md`（归档后在 completed 同路径）
```

## 约束

- **步骤 0**：必须先 `Read` `flow2spec.config.json` + **`f2s-task` 全文**（三端路径见上表）
- **`.task/`**：一律服从 `f2s-task`；本 SKILL 不得与之冲突
- 不依赖 `changeTracking`，但**始终**创建并维护任务清单（除非续作已有 active 任务）
- 步骤 2 必须主 agent；未确认禁止落盘
- `todo.json` 仅主 agent；子 agent 禁止写入
- 禁止批量勾选；禁止跳过 `user-todos.md`

## 完成后自检

1. 是否已读 **`f2s-task` 全文** 且落盘格式与其一致。
2. `task.md` 步骤是否均已磁盘 `[x]`（非口头）。
3. 归档门禁满足时目录在 `completed/<YYYYMMDD>-<task-name>/`，`todo.json` 已更新。
4. `user-todos.md` 与会话中用户代办一致（无则占位）。
5. worktree 已清理或已交接删除命令（N/A 则注明）。
