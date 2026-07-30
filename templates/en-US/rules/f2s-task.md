---
name: f2s-task
description: >
  Change tracking: automatically create and maintain task checklists under .task/ during code changes, supporting continuation across sessions.
  The corresponding skill takes effect only when at least one of changeTracking.feat / fix / implement in flow2spec.config.json is true.
  Trigger words: changeTracking, task tracking, change tracking, continue work, resume previous task; 任务追踪、变更追踪、续作、继续上次任务
alwaysApply: true
---

# f2s-task (Change-Tracking Rule)

## Effective Conditions

Each skill checks its own subfield:

- `f2s-kb-feat`: read `changeTracking.feat`
- `f2s-kb-fix`: read `changeTracking.fix`
- `f2s-implement-tech-design`: read `changeTracking.implement`

If the corresponding subfield is `false` or missing, **the change-tracking steps inside that skill do not run** and are skipped directly.

> The `f2s-req-plan` command is not constrained by this condition and always runs (see `skills/f2s-req-plan/SKILL.md`).

## Binding When f2s-req-plan Is Invoked

When executing **`f2s-req-plan`** (or continuing a task matched by `linkedSkill: "f2s-req-plan"`):

- It is **not constrained** by `changeTracking.feat` / `fix` / `implement`, but **must** maintain `.task/` according to this rule's "Task start / During execution / Interruption and session end / Task completion / New-session continuation" sections.
- Skill **step 0** must `Read` this full rule (**Cursor/Claude**: `rules/f2s-task.*`; **Codex**: `.codex/f2s-rules/f2s-task.md`).
- Disk writes, checkbox updates, archiving, and `user-todos.md` / `acceptance.md` format **are governed by this rule**. The skill body must not omit `todo.json` / `user-todos.md` / `acceptance.md`, and must not rewrite the archive directory naming (`<YYYYMMDD>-<task-name>`).

## Directory Structure

```
.task/
├── todo.json                          <- active task index, written only by the main agent
├── active/
│   └── <task-name>/
│       ├── task.md                    <- checklist (execution steps)
│       ├── context.md                 <- involved file paths and related material links
│       ├── user-todos.md              <- todos that the user must execute (database changes, environment config, etc.); see below
│       └── acceptance.md              <- acceptance checklist: generated after every task.md item is [x] and before archiving; see below
└── completed/
    └── <YYYYMMDD>-<task-name>/
        ├── task.md
        ├── context.md
        ├── user-todos.md              <- archived with the task so acceptance can clear items one by one
        └── acceptance.md              <- archived with the task for the user's final cross-check
```

**Archive directory naming**: folder names under `completed/` are **`<YYYYMMDD>-<task-name>`** (**8-digit local calendar date first**, and `<task-name>` matches the `active/` name in snake_case for time sorting). **All new archives must use this format**. Existing legacy `<task-name>-<YYYYMMDD>` directories in the repository may remain and can be manually renamed when convenient.

## todo.json Structure

```json
[
  {
    "name": "task name",
    "folder": ".task/active/<task-name>/",
    "keywords": ["keyword1", "keyword2"],
    "linkedSkill": "f2s-kb-fix",
    "createdAt": "YYYY-MM-DD"
  }
]
```

**Write ownership constraint**: `todo.json` is written only by the main agent; sub agents must not modify it.

## Task Start (Before Code Changes)

1. Check whether `.task/todo.json` contains active tasks.
2. Match the user input against each entry's `keywords`:
   - One match -> load the corresponding `task.md` and `context.md`; **if present**, also load `user-todos.md`, then show the remaining checklist and unresolved user todos.
   - Multiple matches -> list candidates and ask the user to choose.
   - No match -> confirm the task name and create a new task.
3. Create a new task (when there is no match):
   a. Confirm the task name (snake_case, brief description of the change).
   b. Create `.task/active/<task-name>/`.
   c. Write this turn's work steps into `task.md`.
   d. Write involved file paths and related material links into `context.md`.
   e. **Create `user-todos.md`** (fixed filename, same directory as `task.md`): see "`user-todos.md` format and disk-write obligation" below. If there are no todos yet, write a placeholder note.
   f. Add an entry to `todo.json` (main agent only).

## During Execution

- Each time a step is completed, **immediately** use `Edit` / `Write` to change the corresponding checkbox in `task.md` from `[ ]` to `[x]` (treat this like a code change; **do not** rely only on verbal "completed" claims in the conversation).
- Do not batch-check boxes or skip steps.
- **User todos must be persisted**: whenever an item must be completed by the task owner (the user) on the local machine, in a database, on a configuration platform, or in a process (for example running DDL/DML, entering secrets, clicking approvals, releasing, or backfilling data), append it to `user-todos.md` **in the same session** (`Edit` a new section or list item). **Do not** only mention it in the conversation without writing it to this file. It may also appear in the conversation summary; the disk file is the handoff source of truth.

## Interruption and Session End (Hard Constraints)

- **Long memory uses checkboxes in `task.md` as the source of truth**: the next session locates progress by the first step still marked `[ ]`; if not written to disk, continuation becomes inaccurate.
- Each time a real step listed in `task.md` is completed in this session: check it off **at that step**. Do not postpone all checkbox updates until archiving.
- If the user ends the conversation, the tool flow is interrupted, or you expect you cannot continue: before ending, check off at least the steps that were truly completed, and write the blocking reason or "continue from step N next session" under "## Notes". **Do not** end directly without updating `task.md` (that is equivalent to losing the progress signal).
- If this session has identified **user todos** before interruption: **write or append them to `user-todos.md`** so the next session does not lose what was handed to the user.
- If this session created a **`git worktree`** or equivalent isolated directory for a subtask: before ending, follow **`f2s-flow2spec-unified-entry`** "Git worktree and subtask working-directory hygiene" to remove it or record the leftover path and deletion command (write it to `user-todos.md` when needed).

## Task Completion

**Archive gate (self-check before moving directories)**:

- Move the directory into `completed/` **if and only if** every item under "## Steps" in `task.md` that is related to this delivery is **`[x]`** (or items explicitly canceled by the user are explained under "## Notes", and the corresponding list item has been changed to `[x]` / deleted with a cancellation note).
- After every `task.md` item is `[x]` and before moving the directory, `acceptance.md` **must** have already been created or updated (see "`acceptance.md` format and disk-write obligation" below). A missing `acceptance.md`, or one still containing only the placeholder note from task creation, fails the gate; archiving is forbidden.
- If any `[ ]` remains: **do not** move `active` -> `completed/`, and **do not** remove the entry from `todo.json`; first return to "During execution" to finish the work or adjust the checklist, then archive.

After the gate passes:

1. Move `.task/active/<task-name>/` as a whole to `.task/completed/<YYYYMMDD>-<task-name>/`.
2. Remove the entry from `todo.json`.
3. If `todo.json` becomes an empty array, delete that file.

## New-Session Continuation

At the start of a new session, if `.task/todo.json` exists:

1. Read all active tasks.
2. Match the user's first message against each entry's `keywords`.
3. If matched, show the remaining checklist. **If `user-todos.md` exists, summarize any user todo items still marked `- [ ]`**; **if `acceptance.md` exists, report its current state** (placeholder / final; final form is required before archiving). Ask "An unfinished task was detected. Continue?"
4. After the user confirms: **if `linkedSkill` is non-empty, first load the corresponding skill rule file (configuration-root `skills/<linkedSkill>/SKILL.md`) as execution context**, then continue according to the remaining steps in `task.md`. The skill's disk-write constraints, writing style rules, and self-check checklist all apply as they did on the first invocation.
5. If there is no match, do not interrupt; respond normally.

**Orphaned `active/` directories (`todo.json` missing or damaged)**: if `.task/active/<task-name>/` still exists on disk and its `task.md` contains unchecked steps, `Read` that `task.md` and ask the user whether to continue. Before continuing, it is recommended to restore or rewrite `todo.json` according to "Task start" (main agent only), so progress is not trapped in directories without an active index.

## task.md Format

```markdown
# <task-name>

## Steps
- [ ] Step 1
- [ ] Step 2
- [x] Step 3 (completed)

## Notes
<Findings, decisions, and other notes during execution>
```

## context.md Format

```markdown
# <task-name> Context

## Involved Files
- `src/<module>/callback.js`
- `src/<module>/retry.js`

## Related Materials
- `.Knowledge/req-docs/<capability>-spec.md`
- `.Knowledge/stock-docs/<capability>-arch.md`

## User Todo List
- See `user-todos.md` in the same directory (items that the user must execute are centralized in that file; do not list them only in the conversation)

## Acceptance
- See `acceptance.md` in the same directory (generated after every `task.md` item is `[x]` and before archiving)
```

## `user-todos.md` Format and Disk-Write Obligation

**Path**: `.task/active/<task-name>/user-todos.md` (after archiving: `.task/completed/<YYYYMMDD>-<task-name>/user-todos.md`). The filename **must be exactly** `user-todos.md` so hooks and scripts can reference it.

**Purpose**: collect items that **the Agent cannot do on behalf of the user** and that must be completed by the user (or a privileged operator on a platform), for example:

- Run SQL / migration scripts in a specified environment (may reference `req-docs` or repository `.sql` paths)
- Configuration center / environment variables / secrets / allowlists
- Release, approvals, tickets, external-system switches

**Disk-write obligation**:

1. **When creating a task** (`f2s-task` "Task start" step 3.e): create this file; it may contain a short note plus an empty list.
2. **During execution**: each time a new category of user todo appears, append it **in that turn** (recommended: second-level heading by date `## YYYY-MM-DD`, followed by `- [ ]` checklist items or step numbers).
3. **Division from `task.md`**: `task.md` tracks Agent-side step checkboxes; `user-todos.md` tracks user-side pending items. **Do not** write long "user-only" operation instructions only in `task.md` as a substitute for this file.
4. **Continuation**: when loading a task, `Read` this file and show the user any `- [ ]` items that remain unchecked.

**Example structure**:

```markdown
# User Todo List

> Appended by the Agent; after completion, the user may change the corresponding `- [ ]` to `- [x]` or delete the line.

## 2026-05-09

- [ ] Execute in the target environment: `.Knowledge/req-docs/xxx.sql` (back up first)
- [ ] Enable feature switch `feature.foo.enabled` in the configuration center

## 2026-05-10

- [ ] After production release, write the actual version number back into this document's notes
```

## `acceptance.md` Format and Disk-Write Obligation

**Path**: `.task/active/<task-name>/acceptance.md` (after archiving: `.task/completed/<YYYYMMDD>-<task-name>/acceptance.md`). The filename **must be exactly** `acceptance.md`, kept in the same directory as `task.md` / `user-todos.md`.

**Purpose**: after every `task.md` item is `[x]` and before archiving, the Agent distills the **acceptance checklist** based on what was actually delivered this round. The user can verify item by item that "this task is truly done." Responsibilities are **separated** from `user-todos.md`:

| File | Who acts | Focus |
| --- | --- | --- |
| `task.md` | Agent | Progress checkboxes for implementation steps |
| `user-todos.md` | User | **Todos**: things the Agent cannot do; the user must run them externally (database / platform / approval) |
| `acceptance.md` | User | **Acceptance**: deliverables produced by the Agent this round; the user verifies they actually work |

**Scope of effect**: generated for any task that uses `.task/` — both automatic mode (`changeTracking.feat` / `fix` / `implement`) and explicit mode (`f2s-req-plan`); not skill-specific.

**Disk-write obligation**:

1. **When creating a task** (after `f2s-task` "Task start" step 3.e): `acceptance.md` **may** be created at the same time with a placeholder note (e.g. "After every `task.md` item is `[x]`, the Agent fills in the acceptance checklist here"). **Do not** prewrite acceptance items before implementation; that would risk drifting from the final delivery.
2. **During execution**: in principle **do not write**; if the delivery boundary materially shifts, add a one-line record under "## Notes" and consolidate when finalizing.
3. **After every `task.md` item is `[x]` and before archiving** (**required**): the Agent compiles the formal acceptance checklist based on the actual changes; placeholder notes must be replaced by the final content. **This is the archive gate** (see "Task Completion").
4. **Continuation**: when loading the task, `Read` this file and show the user the current state (placeholder / final).

**Content shape**: a checklist of `- [ ]` items plus a verification method. Each item looks like:

```markdown
- [ ] <acceptance point: what was delivered> (verification: <which file to open / which command to run / which page to view>)
```

Group by delivery domain via second-level headings (e.g. `## Code`, `## Rules and knowledge base`, `## Task list itself`). **Do not** repeat the execution steps from `task.md`; **do not** move "user todos" from `user-todos.md` into this file.

**Example structure**:

```markdown
# Acceptance Checklist

> Compiled by the Agent; after verification the user may change the corresponding `- [ ]` to `- [x]`.

## Code

- [ ] `src/<module>/<file>.ts`: <change point> (verification: read the file / run `npm test -- <file>`)

## Rules and knowledge base

- [ ] `.Knowledge/topics/<topic>.md`: <added/revised description> (verification: open the file to confirm sections are complete)
- [ ] `.Knowledge/manifest-routing.json`: <whether changed and why> (verification: read the corresponding field)

## Task list itself

- [ ] `.task/completed/<YYYYMMDD>-<task-name>/` directory complete: `task.md` / `context.md` / `user-todos.md` / `acceptance.md`
- [ ] The entry in `todo.json` has been removed (or the file has been deleted if the array became empty)
```

## Recommended Hook Configuration (Claude Code)

Add this to the project's `.claude/settings.json` to inject active tasks into context before each file change:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "node -e \"try{const f='.task/todo.json',fs=require('fs');if(fs.existsSync(f)){const t=JSON.parse(fs.readFileSync(f,'utf8'));if(t.length)console.log('[task] active tasks: '+t.map(x=>x.name).join(', '))}}catch(e){}\" 2>/dev/null || true"
      }]
    }]
  }
}
```

## Prohibited

- Sub agents must not write `todo.json`.
- Do not move a task to `completed/` before all steps are complete.
- Do not batch-check checkboxes; they must be checked step by step.
- Do not create a `.task/` directory when all of `changeTracking.feat` / `changeTracking.fix` / `changeTracking.implement` are `false` or missing (`f2s-req-plan` is not constrained by this).
- In a task that already uses `.task/`, do not write "todos that the user must execute" **only** in the conversation or only in `task.md` without appending them to `user-todos.md` (when there are no todos, the file may keep a placeholder note).
- Do not archive while `acceptance.md` is still a placeholder note or is missing; do not merge `user-todos.md` (user todos) and `acceptance.md` (user acceptance) into the same file.
- Do not prewrite concrete acceptance items before implementation is finished (only a placeholder is allowed), to avoid drifting from the actual delivery.
