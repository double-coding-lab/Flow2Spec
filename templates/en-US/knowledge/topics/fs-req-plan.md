# fs-req-plan (routing summary)

> For the long-form body, see configuration-root **`skills/fs-req-plan/SKILL.md`**.
> **`.task/` source of truth**: configuration-root **`rules/fs-task.*`** (Codex: `.codex/fs-rules/fs-task.md`).
> Design background (optional): [task list and change tracking](../stock-docs/<task-list-notes>.md).

## Dependency

Before executing this topic, first read dependency topic **`fs-task`** (`manifest-routing.topicDependencies`).

## Purpose

Starting from a technical spec or requirement description: **resume triage -> draft confirmation -> write to disk according to fs-task -> implement -> archive**.

1. Step 0: `flow-spec.config.json` + the full **`fs-task`** text
2. `fs-task` "task start": check `todo.json` / keywords for resume work
3. Draft confirmation (main agent)
4. Write `task.md` / `context.md` / `user-todos.md` / `todo.json` to disk (`linkedSkill: fs-req-plan`)
5. Implement and check off steps as they complete; write user-side todos to `user-todos.md`
6. After archive gates are satisfied, move into `completed/<YYYYMMDD>-<task-name>/`

Does not depend on `changeTracking`, but **always** follows `fs-task`.

## Next Step

- Full skill text: `skills/fs-req-plan/SKILL.md`
- Task rules: `rules/fs-task.*` or `.codex/fs-rules/fs-task.md`
