---
description: When the user asks to implement a runnable deliverable from a technical design document, follow this rule (read the document, list tasks, confirm, implement, and provide pending items and reminders). The user provides the technical design path in the conversation (MD or PDF); if it is a PDF, convert it to MD with f2s-doc-pdf first.
globs:
  - "**/.Knowledge/req-docs/**/*.md"
alwaysApply: false
---

> **Task paths**: all `.task/` reads/writes must use **`TASK_ROOT` from `rules/f2s-task`** (` .task` or `.task/<developerId>`; config → git → legacy). Bare `.task/todo.json` / `.task/active/` below mean **`TASK_ROOT/...`**.


> **Single long-form rule**: this file is the complete execution rule for **implement-tech-design**. `.Knowledge/topics/f2s-implement-tech-design.md` is only a routing summary; **Codex** reads `.codex/topics/f2s-implement-tech-design.md` (automatically mirrored from this file by `flow2spec init`) as the equivalent rule text.

> Execution scope: the unified knowledge-base path is `/.Knowledge/`. All paths below are interpreted according to the `.Knowledge` convention.

# Implement Deliverables From a Technical Design (General)

When the user asks to implement a runnable deliverable based on a **technical design document** (the user provides a document path such as `.Knowledge/req-docs/xxx.md`, or a PDF), follow these conventions.

**Directory convention**: `.Knowledge/req-docs/` stores technical designs "used for implementation"; `.Knowledge/stock-docs/` stores consolidated documents and must not be used as direct coding input.

**Trigger note**: this rule auto-loads when opening `.md` files under `req-docs` (`**/req-docs/**/*.md`). If the technical design was not opened before the conversation, the user may @ this rule in the conversation and then provide the path.

- If the user provides a PDF: first run `f2s-doc-pdf`, convert the PDF to MD under `.Knowledge/req-docs/`, then continue.
- If the user provides MD/text: read it directly and enter the implementation flow.

---

## 1. Goals and Principles

- **Goal**: implement a runnable deliverable from the technical design while staying consistent with existing project conventions. Deliverables may include frontend pages/components, backend APIs/services, data-processing logic, task orchestration, scripts, configuration, and similar items, trimmed to the design's actual scope.
- **Principles**:
  1. **List tasks before acting**: output the "implementation task list" before asking questions or implementing.
  2. **Read before doing**: fully understand the design, boundaries, dependencies, and acceptance criteria before coding.
  3. **Align with project conventions**: directory, naming, dependencies, encapsulation, error handling, and existing project style must match.
  4. **Ask when something is missing**: confirm key decisions not specified in the document; unanswered items go into the pending list.
  5. **Make the result executable**: provide verification steps and external todos so the user can complete acceptance.

---

## 2. Design Elements and Implementation Mapping (General)

| Technical design content | Implementation action (land according to project conventions) |
| --- | --- |
| Requirement goal / scope / non-goals | Clarify the implementation boundary for this turn and avoid out-of-scope development. |
| Key flow / state transitions / sequence | Implement the main flow and branches, adding brief comments at key decision points. |
| Data structure / protocol / field constraints | Land type definitions, models, validators, or contract layers. |
| APIs / events / messages | Implement call entry points, event handlers, subscriptions, or callbacks, choosing based on design scope. |
| Pages / components / interactions | Implement UI structure, state management, interaction flow, and fault-tolerant prompts when the design covers UI. |
| Configuration / switches / environment differences | Register and read them in project-conventional locations; add defaults and fallback strategy. |
| Error codes / exception strategy / retries | Unify error returns and logging strategy, matching existing wrappers. |
| Release / routing / permissions / task scheduling | Implement the corresponding code and remind the user to finish platform-side configuration when relevant. |

### Flowchart Handling (Important)

- If the flowchart is a PDF/image without textual steps, first ask the user for a textual flow or supplementary document.
- If textual steps already exist, implement strictly in their order and branches.
- When branches cannot be confirmed, ask first, or implement with a default strategy and record it in the pending list.

---

## 3. Execution Steps

### Step 1: Normalize Input

- PDF input: first run `f2s-doc-pdf` and obtain `.Knowledge/req-docs/*.md`.
- MD/text input: read directly.

### Step 2: Understand the Design and Context

1. Read the full technical design and extract: goals, scope, flow, APIs/interactions, data, configuration, dependencies, and acceptance conditions.
2. Read project conventions such as README, `.Knowledge/stock-docs/`, architecture notes, and existing modules to align implementation style.
3. If a flowchart lacks textual explanation, record the gap first and confirm it with the user in step 3.

### Step 2.5: Output the Implementation Task List First (Mandatory)

Before asking questions or coding, output a task list first (trim as appropriate for the design):

```markdown
## Implementation Task List (Based on the Technical Design "xxx")

| No. | Task | Notes |
| --- | --- | --- |
| 1 | Core structure and data contracts | Land types/models/validation rules and clarify inputs/outputs. |
| 2 | Business flow implementation | Implement the main path and branches according to the flowchart/text steps. |
| 3 | External capability integration | Implement external entry points such as APIs/events/page interactions. |
| 4 | Configuration and exception handling | Register configuration, handle errors, and add retry/fallback strategies. |
| 5 | Verification and closing | Provide self-test notes, pending list, and platform-side reminders. |
```

If `changeTracking.implement: true`, after outputting the task list, write this checklist to `.task/active/<task-name>/task.md` according to the `f2s-task` rule.

### Step 2.6: Sync Change Tracking With `task.md` / `user-todos.md` (Only When `changeTracking.implement: true`)

- Whenever work corresponding to an implementation task-list item is completed, use `Edit` **in the same session** to update the corresponding `[ ]` -> `[x]` in `.task/active/<task-name>/task.md`. Do not defer this to closing, and do not replace disk updates with verbal completion claims (see `f2s-task` "During execution" and "Interruption and session end").
- Whenever an item appears during execution that **must be done by the user** (database changes, environment configuration, etc.), append it **in the same session** to `.task/active/<task-name>/user-todos.md` (see `f2s-task` "user-todos.md").

### Step 3: Ask Pre-Implementation Questions (Mandatory; Do Not Skip)

Before coding, list all unclear items at once and ask the user to confirm. Common questions:

- **Scope and acceptance**: what must be delivered in this turn, and what is explicitly out of scope;
- **Technical boundary**: which module/side to implement in (frontend, backend, script, data task, etc.);
- **Dependencies and contracts**: external APIs, message protocols, data sources, authentication method;
- **Configuration and environment**: configuration key, environment differences, defaults, and rollout strategy;
- **Flowchart gaps**: branch conditions, failure fallback, timeout and retry strategy;
- **Release constraints**: whether routing, permissions, scheduling, and deployment steps are ready.

If the user does not answer an item, implement using a reasonable default or placeholder and mark it as "requires user confirmation" in the pending list.

### Step 4: Implement According to the Task List

Trim the order according to the design and the actual project. Recommended sequence:

1. Land data/contracts and shared abstractions first;
2. Implement the main flow and core capability next;
3. Integrate entry layers such as APIs/pages/events/tasks next;
4. Finally add configuration, exception handling, logging, and test helpers.

Requirements: reuse existing dependencies and wrappers; match project naming, directory, and style; keep key branches readable and maintainable.

### Step 5: Closing Output (Mandatory)

1. **Pending list (mandatory)**: list every item still requiring user or platform completion.
2. **Post-implementation reminder list (mandatory)**: remind about configuration, dependencies, data, release, permissions, scheduling, and similar items according to the actual scope.
3. **Verification suggestions (recommended)**: provide the minimal executable verification steps (local, test environment, or regression path).
4. **Persist user todos (only when `changeTracking.implement: true`)**: append the items from step 5 points 1-2 that **must be executed by the user** (database scripts, configuration, approvals, etc.) to `.task/active/<task-name>/user-todos.md` (create the file first if missing; see `f2s-task`). Do not leave them only in the conversation or at the end of the design without writing this file.
5. If `changeTracking.implement: true`: **first confirm** every item under `task.md` "Steps" is `[x]` (or canceled items are recorded in notes), then after satisfying the `f2s-task` archive gate, move `.task/active/<task-name>/` to `.task/completed/<YYYYMMDD>-<task-name>/` and remove the corresponding entry from `todo.json`. Do not archive while any `[ ]` remains.

---

## 4. Optional Additions

- If the design naming is unclear, suggest a name first and ask the user to confirm.
- If the design scope is large, split delivery into "minimum viable version -> incremental iterations".
- If the user wants to consolidate knowledge into the KB, remind them that `f2s-kb-build` can later sync topics and routing.

---

## 5. Constraints and Summary

- PDFs must be converted to MD before entering the implementation flow.
- Do not skip step 2.5 (task list) or step 3 (pre-implementation questions) and code directly.
- If `changeTracking.implement: true`: do not skip step 2.6 (write back `task.md` checkboxes as implementation progresses and append `user-todos.md`); archiving must satisfy the `f2s-task` archive gate.
- The output must include a pending list and post-implementation reminder list. If `changeTracking.implement: true`, user-side items in those lists must be synced into `user-todos.md`.
- Keep the content general. Do not assume a "backend only" scenario; trim implementation objects according to the design's actual scope.

When complete, a one-sentence summary may be used: this round of implementation based on the "xxx" technical design is complete, with pending items and verification suggestions provided; please complete the platform and environment-side configuration according to the checklist before acceptance.
