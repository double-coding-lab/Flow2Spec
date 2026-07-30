# fs-task (routing summary)

> For the long-form body, see configuration-root **`rules/fs-task.*`**.
> Codex: **`.codex/fs-rules/fs-task.md`**.

## Purpose

Change-tracking rules (`alwaysApply: true`). When the corresponding skill's `changeTracking.*` is `true`, automatically create, update, and archive task lists under **`TASK_ROOT`** (see multi-developer section). Supports cross-session resume.

## Effective Scope

| Configuration item | Corresponding skill |
| --- | --- |
| `changeTracking.feat` | `fs-kb-feat` |
| `changeTracking.fix` | `fs-kb-fix` |
| `changeTracking.implement` | `fs-implement-tech-design` |

`fs-req-plan` always maintains a task list (not gated by `changeTracking`).

## Task root `TASK_ROOT` (multi-developer)

- Resolve: `collaboration.developerId` (config) → git email/name → legacy `.task`
- Non-legacy: `.task/<developerId>/…`; **only** current `TASK_ROOT` (no cross-developer todo scan)
- `.flow-spec/` remains shared for the whole team

## Directory Structure

```
TASK_ROOT/                       ← `.task` or `.task/<developerId>`
├── todo.json
├── active/<task-name>/
│   ├── task.md
│   ├── context.md
│   ├── user-todos.md
│   └── acceptance.md
└── completed/<YYYYMMDD>-<task-name>/
    └── …
```

## Cross-session continuation

Resolve `TASK_ROOT` first; match keywords **only** in that root's `todo.json`. On hit, show remaining checklist and optional user-todos/acceptance; load `linkedSkill` if set.

## Next step

Read configuration-root `rules/fs-task.*` for full rules.
