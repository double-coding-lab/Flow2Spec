# flow-spec：任务清单与变更追踪（设计说明）

> **定位**：说明 `.task/` 任务清单的**两种触发方式**、目录与数据约定、与配置及技能的关系。
> **执行细则**：变更追踪的 checklist 与禁止项以配置根 **`rules/fs-task.*`** 为准；显式规划链路以 **`skills/fs-req-plan/SKILL.md`** 为准。
> **仓内分工**：本文档位于 **flow-spec 产品仓** `.flow-spec/stock-docs/`（记录产品设计/约定）。**`templates/`、`lib/`** 承载 **init 下发与 CLI 行为**，不替代本 stock 作为「产品知识库正文」；业务仓内的 `.task/` 与规则则由 init 从模板落盘。

---

## 1. 设计目标

1. 在业务仓库内为 AI 协作留下**可续作**的进度载体，避免跨会话丢失上下文。
2. **自动模式**与**显式模式**解耦：日常修缺陷/加能力可走配置开关；需要「先看全貌再动手」时走独立技能。
3. **`todo.json` 单写权**：降低多 agent 并发写同一索引的冲突风险。

---

## 2. 两种模式对照

| 维度 | 自动模式（变更追踪） | 显式模式（fs-req-plan） |
| --- | --- | --- |
| **配置** | `flow-spec.config.json` → `changeTracking.feat` / `fix` / `implement` 任一为 `true` | **不依赖** `changeTracking` |
| **触发** | 执行 `fs-kb-feat`、`fs-kb-fix`、`fs-implement-tech-design`（按各自子项）时，技能内按规则创建/续接任务 | 用户调用 **`fs-req-plan`** |
| **规则入口** | 配置根 **`rules/fs-task.*`**（`alwaysApply`） | **`skills/fs-req-plan/SKILL.md`** |
| **典型场景** | 希望每次相关技能执行都自动留下清单并可关键词续作 | 有方案/需求文本，要先出**草稿清单**并经用户确认后再落盘与实现 |

---

## 3. 目录与文件约定

```
.task/
├── todo.json                 ← 活跃任务索引；仅主 agent 写入
├── active/<task-name>/
│   ├── task.md               ← checklist（步骤级 checkbox）
│   ├── context.md            ← 涉及文件、req-docs/stock-docs 链接
│   ├── user-todos.md         ← 须用户执行的代办（执行 SQL、改配置等）
│   └── acceptance.md         ← 验收清单（task.md 全部 [x] 后、归档前生成）
└── completed/<YYYYMMDD>-<task-name>/
    ├── task.md
    ├── context.md
    ├── user-todos.md
    └── acceptance.md
```

- **`user-todos.md`** 与 **`acceptance.md`**：与 `task.md` 同目录、固定文件名；详见下文 **3.1**。完整约定见 **`rules/fs-task.*`**。
- **任务名**：`snake_case`，简短描述变更内容。
- **归档目录名**：`completed/` 下为 **`<YYYYMMDD>-<task-name>`**（**日期 8 位在前**）；新归档一律使用本格式，旧式 `<task-name>-<YYYYMMDD>` 可保留并择机重命名。
- **归档**：完成后将 `active/<task-name>/` 整体移至 `completed/<YYYYMMDD>-<task-name>/`，并从 `todo.json` 删除对应条目；若数组为空可删除 `todo.json`。
- **子任务与 Git worktree**：`subAgent=true` 或并行子任务若使用 **`git worktree`**（或 IDE 等价隔离目录），须在子任务结束或主 agent 合并后 **`git worktree remove`** 并 `git worktree list` 自检，禁止长期遗留孤儿 worktree；细则见配置根 **`rules/fs-flow-spec-unified-entry.*`**。

### 3.1 `user-todos.md` 与 `acceptance.md`：用户侧两份文件，职责分离

| 文件 | 谁在做 | 内容焦点 | 写入时机 |
| --- | --- | --- | --- |
| `task.md` | Agent | 实现步骤的进度 checkbox | 任务全生命周期 |
| **`user-todos.md`** | 用户 | **代办**：Agent 做不了、必须用户在外部（库 / 平台 / 审批）执行的事 | 创建任务时建占位；执行中**追加** |
| **`acceptance.md`** | 用户 | **验收**：本轮 Agent 已交付项，用户核对是否真的可用 | 创建任务时可建占位；`task.md` 全部 `[x]` 后、归档前**成稿**（归档门禁） |

要点：

- 两者**不合并**到同一文件；`user-todos.md` 是「**还**没做的、要你来做」，`acceptance.md` 是「Agent **已经**做完的、请你核对」。
- `acceptance.md` 在实现完成前**不预写**验收点，避免与实际交付脱节。
- 完整格式、示例与禁止项见配置根 **`rules/fs-task.*`**。

---

## 4. `todo.json` 条目结构

```json
[
  {
    "name": "任务名称",
    "folder": ".task/active/<task-name>/",
    "keywords": ["关键词1", "关键词2"],
    "linkedSkill": "fs-kb-fix",
    "createdAt": "YYYY-MM-DD"
  }
]
```

- **`linkedSkill`**：跨会话续作命中后，用于加载配置根 **`skills/<linkedSkill>/SKILL.md`**，使约束与首次调用一致。`fs-req-plan` 落盘时常写 `"fs-req-plan"`。
- **写权**：`todo.json` **仅主 agent**；禁止子 agent 修改。

---

## 5. 跨会话续作（自动模式侧）

当存在 `.task/todo.json` 时，`fs-task` 规则约定：将用户首条消息与各条目的 **`keywords`** 匹配；命中则展示剩余 checklist，并可加载 **`linkedSkill`**；无命中则不打扰。

---

## 6. 显式模式要点（fs-req-plan）

1. **步骤 2（草稿确认）**必须由主 agent 完成；**未确认前**禁止创建任务文件或写代码。
2. 确认后：主 agent 写 **`todo.json`**；`task.md` / `context.md` 在 `subAgent=true` 时可由子 agent 起草，仍以技能正文为准。
3. 实现阶段：子 agent 默认**不触碰** `.task/` 与 `.flow-spec/`；checkbox **逐项**勾选，禁止批量勾选。

---

## 7. 与 `changeTracking: false` 的关系

若对应子项为 `false` 或字段缺失，**对应技能内**的变更追踪步骤**不执行**，且**不应**仅为追踪而创建 `.task/`（见 `fs-task` 禁止项）。`fs-req-plan` **始终**走自己的任务清单流程。

---

## 8. 信息来源（仓库内文档）

- `docs/体系与原理.md` — 第 3 节链路、第 4.3 节变更追踪。
- `docs/命令说明.md` — `fs-req-plan`、`fs-task`、`changeTracking` 字段说明。
- `docs/目录与路径约定.md` — `.task/` 路径约定。
- `docs/使用说明.md` — 自动模式与显式模式产品说明。

---

## 9. 知识库路由

- 主题 **`fs-task`**：`.flow-spec/topics/fs-task.md`，matcher **`m-change-tracking`**。
- 主题 **`fs-req-plan`**：`.flow-spec/topics/fs-req-plan.md`，matcher **`m-req-plan`**。

人读索引见 `.flow-spec/index.md` 主题表。
