---
name: f2s-req-plan
description: Plan and implement tasks from a technical design, requirement description, or change description; always maintain `.task/` according to f2s-task; supports parallel sub-agent implementation. Triggers: f2s-req-plan、创建任务、任务规划、我需要任务清单、task planning、create task list
---

> **Task paths**: all `.task/` reads/writes must use **`TASK_ROOT` from `rules/f2s-task`** (` .task` or `.task/<developerId>`; config → git → legacy). Bare `.task/todo.json` / `.task/active/` below mean **`TASK_ROOT/...`**.


# Requirement Task Planning and Implementation (f2s-req-plan)

Start from a requirement or technical design and cover the full "plan -> implement" chain. This skill **does not depend on** `changeTracking.*`, but the full `.task/` lifecycle **must use `f2s-task` as the only source of truth** (directory structure, format, continuation, checkbox updates, archiving, and user-todos). Knowledge-base sync is invoked later by the user as needed through `f2s-kb-feat` / `f2s-kb-sync`.

## Relationship with f2s-task (Hard Constraint)

| Item | Description |
| --- | --- |
| **Source of truth** | Config-root **`rules/f2s-task.*`** (`alwaysApply: true`); Codex reads **`.codex/topics/f2s-task.md`** (init mirror, same source as rules) |
| **This skill's responsibility** | Planning draft, code implementation, and sub-agent orchestration; **must not** define a custom `.task/` structure or weaken checkbox/archive requirements |
| **Relationship with changeTracking** | `f2s-req-plan` is **not constrained by** `changeTracking.feat/fix/implement`; it **always** uses task lists. See `f2s-task` "Activation Conditions" |

**All three clients must read the full `f2s-task` text (Step 0 is mandatory, before any step below):**

| Client | Path |
| --- | --- |
| **Cursor** | Config-root `rules/f2s-task.mdc`; or initialized `.cursor/rules/f2s-task.mdc` |
| **Claude Code** | `.claude/rules/f2s-task.md` |
| **Codex** | `.codex/topics/f2s-task.md` |

## Orchestration (main / sub agent)

- `subAgent` / `switchAgentVerification` use the unified entry as the only source of truth: **Cursor/Claude** -> `rules/f2s-flow2spec-unified-entry.*`; **Codex** -> `.codex/topics/f2s-flow2spec-unified-entry.md`.
- **Step 1 (continuation triage + parsing)**: the main agent must perform `f2s-task` "Task Start" 1-2. Document parsing may be split to a sub agent (read-only).
- **Step 2 (draft confirmation)**: must be handled by the main agent. Before confirmation, do not create `.task/` and do not write business code.
- **Step 3 (write task files)**: follow `f2s-task` "Task Start" 3.a-3.f. `todo.json` is **main-agent only**. Drafts of `task.md` / `context.md` / `user-todos.md` may be created by a sub agent; additions to `user-todos.md` during execution are merged by the main agent.
- **Step 4 (implementation)**: sub agents may write only business code. **Sub agents must not** write `todo.json` or modify `task.md` checkboxes. The main agent checks off items after merging.
- **Step 5 (archive)**: main agent only. Execute only after the archive gates in `f2s-task` "Task Completion" are satisfied.
- Worktree hygiene follows `f2s-flow2spec-unified-entry`; interruption/end-of-session handling follows `f2s-task` "Interruption and Session End".

## Input (Choose One)

- Technical design path (`.Knowledge/req-docs/*.md` or PDF)
- Requirement / change description (free text)

## Steps

### Step 0: Preflight (Mandatory, Before Any Step)

1. **`Read("flow2spec.config.json")`** (project root; missing fields are treated as `false`).
2. **`Read` the full `f2s-task` text for one of the three clients above** (do not skip; do not use only this SKILL summary as a substitute).
3. Decide whether to split to sub agents and whether to cross-verify based on the read `subAgent` / `switchAgentVerification` values.

### Step 1: Continuation Triage + Parse Input

#### 1a. Continuation Triage (`f2s-task` "Task Start" 1-2, Main Agent)

1. If **`.task/todo.json`** exists, `Read` it and match the **current user input** against each entry's **`keywords`**.
2. **Exactly 1 match** -> `Read` the corresponding `task.md` and `context.md`; if present, `Read` **`user-todos.md`**. Show the remaining checklist and unchecked user todos, then ask whether to **continue** that task.
   - User confirms continuation -> **load the full text of this SKILL** (`linkedSkill` should be `f2s-req-plan`), continue from the first `[ ]` in `task.md`, and **do not** create a duplicate `active/` directory. **Jump to Step 4** (if planning still needs additions, record them first under `## Notes`, then implement).
   - User explicitly wants a **new task** -> proceed to 1b.
3. **Multiple matches** -> list candidates and let the user choose which one to continue or choose a new task.
4. **No match** -> check for **orphan `active/`** tasks (`f2s-task`): if any unarchived task has a `task.md` containing `[ ]`, ask whether to continue it or restore `todo.json`; otherwise proceed to 1b.
5. **No `todo.json`** -> proceed to 1b.

#### 1b. Parse Input (New Task or Draft Needed)

When `subAgent=true`, read-only parsing may be split to sub agents:

- Read the full design/requirement and extract goals, scope, work items, and touched files.
- Read `.Knowledge/stock-docs/` and other context for alignment.
- Convert PDFs to MD first with `f2s-doc-pdf`.

Sub agents return only a "parsing summary"; when `subAgent=false`, the main agent does this work. -> **Step 2**.

### Step 2: Output Draft and Confirm (Main Agent Required)

The main agent outputs:

1. **Task name** (`snake_case`)
2. **Implementation checklist draft** (each step may be a checkbox and will be written into `task.md` under `## Steps`)
3. **Touched file list** (will be written into `context.md`)
4. **Suggested `keywords`** (2-5 terms for continuation matching in `todo.json`)
5. **Wait for user confirmation**

> Before confirmation, it is forbidden to create `.task/`, write `todo.json`, or write business code.

### Step 3: Write Task Files (`f2s-task` "Task Start" 3.a-3.f)

After the user confirms, **strictly follow `f2s-task`** (the format is defined by that rule body; do not omit files):

| Sub-step | Action | Write authority |
| --- | --- | --- |
| 3.a | Confirm `<task-name>` (`snake_case`) | Main |
| 3.b | Create `.task/active/<task-name>/` | Main or sub (draft) |
| 3.c | Write **`task.md`**: `# Task Name` + `## Steps` + `- [ ]` list + empty `## Notes` | Main or sub |
| 3.d | Write **`context.md`**: touched files, `.Knowledge` links; user todos point to `user-todos.md` | Main or sub |
| 3.e | Create **`user-todos.md`** (fixed filename; when there are no todos, write a placeholder note) | Main or sub |
| 3.f | Add a **`todo.json` entry**: `name`, `folder`, `keywords` (including Step 2 suggestions), `linkedSkill: "f2s-req-plan"`, `createdAt` | **Main agent only** |

**Forbidden**: creating only `task.md` without writing `todo.json`; omitting `user-todos.md`; using the old archive name format `completed/<task-name>-<date>`.

### Step 4: Implement Code

Follow `f2s-task` "In Progress" and "Interruption and Session End":

- Implement in `task.md` order. **Every time a step is truly completed**, the main agent must immediately `Edit` that step from `[ ]` to `[x]` (no batch checking, no oral-only completion).
- For any required user action such as database changes, environment configuration, or approvals, append it to **`user-todos.md`** in the **same session** (group by date). Do not leave it only in the conversation or in `task.md` body.
- When `subAgent=true`: sub agents modify only business source code; after they report back, the main agent checks off tasks and writes `user-todos.md`.
- After merging sub-agent work, clean the **git worktree** (see unified entry).

### Step 5: Archive the Task (`f2s-task` "Task Completion")

**Archive gates** (move the directory only after self-check passes):

- All items related to the current delivery in `task.md` under `## Steps` are **`[x]`** (canceled items are explained under `## Notes`).
- If any `[ ]` remains -> **do not** move to `completed/` and **do not** delete the `todo.json` entry.

After passing:

1. `.task/active/<task-name>/` -> `.task/completed/<YYYYMMDD>-<task-name>/` (**8-digit date first**)
2. Remove the entry from `todo.json`; if the array becomes empty, delete the file
3. Archive `user-todos.md` together with the directory

### Step 6: Output Summary

```markdown
## f2s-req-plan complete: <task-name>

### Implementation
- <file path>: <change summary>

### Task List
- Archived: `.task/completed/<YYYYMMDD>-<task-name>/` (or, if still active, show the path and remaining `[ ]`)

### Todo (Knowledge Base)
- You may later call f2s-kb-sync / f2s-kb-feat

### User Todos
- See `user-todos.md` (after archiving, under the same completed path)
```

## Constraints

- **Step 0**: must first `Read` `flow2spec.config.json` + the **full `f2s-task` text** (three-client paths above).
- **`.task/`**: always obey `f2s-task`; this SKILL must not conflict with it.
- Does not depend on `changeTracking`, but **always** creates and maintains a task list (unless continuing an existing active task).
- Step 2 must be handled by the main agent; before confirmation, no disk writes.
- `todo.json` is main-agent only; sub agents must not write it.
- No batch checkbox updates; do not skip `user-todos.md`.

## Completion Self-Check

1. Has the **full `f2s-task` text** been read, and do written files match its format?
2. Are all `task.md` steps checked as `[x]` on disk (not only orally)?
3. When archive gates are satisfied, is the directory under `completed/<YYYYMMDD>-<task-name>/`, and has `todo.json` been updated?
4. Does `user-todos.md` match user todos from the session (placeholder if none)?
5. Is the worktree clean, or have cleanup commands been handed off (mark N/A if not applicable)?
