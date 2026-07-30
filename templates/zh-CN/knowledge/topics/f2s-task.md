# f2s-task（路由摘要）

> 长文见配置根 **`rules/f2s-task.*`**。  
> 体系化设计说明（可选）：在 `stock-docs/` 自建任务清单说明后，于本主题或 `index.md` 中链接，例如 `../stock-docs/<任务清单说明>.md`。

## 作用

变更追踪规则（`alwaysApply: true`）。当对应技能的 `changeTracking.*` 为 `true` 时，技能执行前后自动创建、逐步更新、最终归档 `.task/` 下的任务清单，支持跨会话续作。

## 生效范围

| 配置项 | 对应技能 |
| --- | --- |
| `changeTracking.feat` | `f2s-kb-feat` |
| `changeTracking.fix` | `f2s-kb-fix` |
| `changeTracking.implement` | `f2s-implement-tech-design` |

`f2s-req-plan` 不受配置约束，始终创建任务清单。

## 任务根 `TASK_ROOT`（多人）

- 解析顺序：`collaboration.developerId`（config）→ git email/name → legacy `.task`
- 非 legacy 时目录为 `.task/<developerId>/…`；只读写当前 `TASK_ROOT`，禁止扫其他人的 todo（防串戏）
- `.Knowledge/` 仍全员共享

## 目录结构

```
TASK_ROOT/                       ← `.task` 或 `.task/<developerId>`
├── todo.json                    ← 活跃任务索引（仅主 agent 写）
├── active/<task-name>/
│   ├── task.md                  ← checklist（执行步骤）
│   ├── context.md               ← 涉及文件、文档链接
│   ├── user-todos.md            ← 须用户执行的代办（改库、配环境等）
│   └── acceptance.md            ← 验收清单：task.md 全部 [x] 后、归档前生成
└── completed/<YYYYMMDD>-<task-name>/
    ├── task.md
    ├── context.md
    ├── user-todos.md
    └── acceptance.md
```

用户代办**必须**落在与 `task.md` 同目录的 **`user-todos.md`**；归档前**必须**生成与 `task.md` 同目录的 **`acceptance.md`**（验收清单），二者职责分离。细则见配置根 **`rules/f2s-task.*`**。

## 跨会话续作

新会话先解析 `TASK_ROOT`；若存在该根下 `todo.json`，将用户首条消息与**仅该文件**内 `keywords` 匹配：
- 命中 → 展示剩余 checklist，摘要 user-todos / acceptance，加载 `linkedSkill`，提示是否继续
- 无命中 → 不打扰

## 下一步

读配置根 `rules/f2s-task.*` 获取完整规则（目录结构、todo.json 格式、任务生命周期、Hook 配置）。
