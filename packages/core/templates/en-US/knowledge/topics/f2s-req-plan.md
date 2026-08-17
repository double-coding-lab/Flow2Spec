---
id: f2s-req-plan
revision: 0
summary: "f2s-req-plan (routing summary)"
dependsOn: [f2s-task]
primary: policy
confidence: manual
---
# f2s-req-plan (routing summary)

> For the long-form body, see configuration-root **`skills/f2s-req-plan/SKILL.md`**.  
> **`.task/` source of truth**: configuration-root **`rules/f2s-task.*`** (Codex: `.codex/topics/f2s-task.md`).  
> Design background (optional): [task list and change tracking](../stock-docs/<task-list-notes>.md).

## Dependency

Before executing this topic, first read dependency topic **`f2s-task`** (`manifest-routing.topicDependencies`).

## Purpose

Starting from a technical spec or requirement description: **resume triage -> draft confirmation -> write to disk according to f2s-task -> implement -> archive**.

1. Step 0: `flow2spec.config.json` + the full **`f2s-task`** text
2. `f2s-task` "task start": check `todo.json` / keywords for resume work
3. Draft confirmation (main agent)
4. Write `task.md` / `context.md` / `user-todos.md` / `todo.json` to disk (`linkedSkill: f2s-req-plan`)
5. Implement and check off steps as they complete; write user-side todos to `user-todos.md`
6. After archive gates are satisfied, move into `completed/<YYYYMMDD>-<task-name>/`

Does not depend on `changeTracking`, but **always** follows `f2s-task`.

## Next Step

- Full skill text: `skills/f2s-req-plan/SKILL.md`
- Task rules: `rules/f2s-task.*` or `.codex/topics/f2s-task.md`
