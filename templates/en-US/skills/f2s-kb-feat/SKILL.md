---
name: f2s-kb-feat
description: Complete implementation and knowledge-base sync when adding a capability; if already implemented, only sync the knowledge base; triggers: f2s-kb-feat、新增能力、add capability、new feature
---

> **Task paths**: all `.task/` reads/writes must use **`TASK_ROOT` from `rules/f2s-task`** (` .task` or `.task/<developerId>`; config → git → legacy). Bare `.task/todo.json` / `.task/active/` below mean **`TASK_ROOT/...`**.


> Execution scope: `f2s-kb-feat` syncs `.Knowledge` by default; the user does not need to separately ask "please sync the knowledge base".

## KB Auto-Merge Protocol (Required)

This skill must not make manual command execution part of the user flow. After the implementation is completed or confirmed to already exist, the agent performs knowledge candidate generation, merge planning, build, and validation by itself:

1. Convert this capability change into a `kb-delta` draft with `taskId`, `developerId`, `baseRevisions`, `changes`, and implementation evidence. If `changeTracking.feat=true` and a task directory already exists, the delta may be written to `TASK_ROOT/active/<task-name>/kb-delta.json`; otherwise an equivalent in-memory object is acceptable. `changes` may use `appendBody` / `replaceBody` / `updateFrontmatter`; when a new topic is needed, use `createTopic` and optionally include `taskRule` plus `matcher` so routing is connected in the same merge.
2. Before writing `.Knowledge`, run `flow2spec kb plan <delta>` or the equivalent internal capability. If a topic revision differs, stop automatic writing and switch to semantic-merge reporting.
3. When the change is auto-mergeable, run `flow2spec kb apply <delta>` or the equivalent internal capability, then run `flow2spec kb build` and `flow2spec kb check`.
4. The user should only see "capability and knowledge base synced / semantic conflict needs confirmation / skipped with reason"; do not ask the user to manually run `kb plan/apply/build/check`.

## Orchestration (main / sub-agent)

- The meaning of `subAgent` and `switchAgentVerification` uses the unified entry as the only source of truth: **Cursor/Claude** read the configuration-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`). Do not repeat those definitions here.
- **Code subpackage** (new / modified implementation code): when `subAgent=true`, it may be delegated to a sub-agent.
- **Documentation subpackage** (style-sensitive changes to rules / skills / topics / stock-docs): by default, do not split; the main agent writes them to preserve writing constraints such as "current truth wins", length limits, and no stacked historical negation.
- If documentation changes must be delegated: the sub-agent only outputs an "in-place replacement diff" (small before / after snippets) and must not rewrite whole files; the main agent merges and writes the result.
- **Write-authority hard rule**: `manifest-routing.json` / `.Knowledge/index.md` are always written by the main agent; sub-agents must not touch them.
- The writing side verifies its own work.

# Add Capability (f2s-kb-feat)

## Input

- The user describes the new capability, scenario, boundaries, and optional paths.

## Steps

**Step 0: Change Tracking (only when `changeTracking.feat: true`)**

Before execution, read `flow2spec.config.json`. If `changeTracking.feat: true`:

- Check whether `.task/todo.json` has an active task, and match the user description against `keywords`.
- Match -> load the corresponding `task.md`, show the remaining checklist, and continue in the existing task.
- No match -> create a new task (see the `f2s-task` rule), and write steps 1-4 into `task.md` as a task checklist.
- **Mandatory in-progress writes**: every time a step in `task.md` is completed, immediately `Edit` that step from `[ ]` to `[x]` in the same session; do not accumulate checkmarks until the "closing/archive" step, and do not use verbal completion instead of writing to disk (see `f2s-task` "interruption and session end" and "archive gate").
- **User todos**: whenever the user must change a repository, configure an environment, click a platform, or handle similar items, append them in the same session to `.task/active/<task-name>/user-todos.md` (see `f2s-task`); when creating a new task and there are no todos yet, still create this file (a placeholder is allowed).

1. Determine capability status: not implemented / partially implemented / already implemented.
2. Complete code implementation (skip this step if already implemented).
3. Sync the knowledge base (default behavior):
   - `.Knowledge/stock-docs/`: capability description and usage.
   - `.Knowledge/topics/`: add or revise topic rules and workflows.
   - `.Knowledge/index.md`: topic index.
   - Routing manifest: minimally update it when routing, dependencies, or `topicMetadata` change.
   - **Authoring-side guideline**: if this step adds or modifies topics, `topicMetadata`, or `topicDependencies`, first Read the full `rules/f2s-topic-authoring.*` (**Cursor/Claude**: `rules/f2s-topic-authoring.mdc`; **Codex**: `.codex/topics/f2s-topic-authoring.md`) before writing.
4. Output a summary (capability points, implementation, knowledge-base changes).

## Output Summary Format (Recommended)

```markdown
## New Capability: <capability name>

### Scope
- <capability point 1>
- <capability point 2>

### Implementation
- <file path>: <change description> (if no code changed, write "existing implementation")

### Knowledge Base
- .Knowledge/stock-docs/<file>.md: <new/revised description>
- .Knowledge/topics/<topic>.md: <new/revised description>
- .Knowledge/index.md: <update description>
- .Knowledge/manifest-routing.json: <whether updated and why>
- .Knowledge/matchers/<id>.json: <whether includeAny was updated and why>
```

## Complex Scenario Example

The user asks to "add a failure retry queue capability", and the code already contains a partial implementation.

- First classify it as "partially implemented" and fill the code gaps instead of rebuilding the whole module.
- Add or revise `topics/retry-queue.md`, and update the `index` entry description.
- If the capability needs to be matched by task routing (for example, "retry queue refactor"), supplement `manifest.taskToTopicRules`.

## Constraints

- When there is a conflict with an old convention: **rewrite to the current truth**; do not create additional historical-negation sentences such as "(no longer related to X)".
- Prefer in-place updates for overlapping existing topics.
- At least one knowledge-base update must be written, avoiding "code exists but cannot be retrieved".
- Do not modify the configuration-root `rules/skills`.
- Documentation subpackages are not split by default; when delegation is necessary, the sub-agent only outputs before/after diff snippets, and the main agent merges and writes them. `manifest-routing.json` / `.Knowledge/index.md` are always written by the main agent (write-authority hard rule).

## Knowledge-Base Writing Style (Required, Anti-Redundancy)

When writing `stock-docs` / `topics` / `index`, follow these rules:

1. **Minimal increment**: only append or rewrite text directly related to **this capability**; do not use "sync the knowledge base" as a reason to restate background, requirements, or tutorial-style setup unrelated to the implementation.
2. **Affirmative wording first (see the unified entry "knowledge-base writing style")**: state the correct description directly; do not communicate the new convention by negating the old one, except for mutually exclusive choices.
3. **Avoid duplicate narration**: do not write a long version of the same fact in both `stock-docs` and `topics`; make the executable convention clear in one place, and use a short paragraph + link in the other, or only list key points and reference paths.
4. **Prefer structured writing**: `topics` should focus on rules, boundaries, steps, errors, and configuration points; use lists/tables instead of long paragraphs when possible.
5. **Length limit (soft constraint)**: in one sync, new body text added to the **same file** should generally not exceed about **80 lines** (excluding code-block lines); if it exceeds that, split into a new topic or write "summary + see code path / another doc" first. Do not stack repeated explanation in one file.
6. **`index.md`**: only modify rows/table items related to this topic; do not refresh the whole table or section by copy-paste.
7. **Forbidden**: repeatedly explain Flow2Spec directory responsibilities, paste the full user conversation, or add long "historical review" sections unrelated to this diff.

## Completion Self-Check

1. Capability description matches the code implementation.
2. The new capability can be retrieved through a topic.
3. `index` and `manifest` were synced.
4. If `topicMetadata` was written: every key exists in `topicPaths`; `primary` / `tags` / `confidence` are valid; no topic was created, renamed, or split just for classification.
5. Knowledge-base changes cannot be compressed further without losing the rules and links after removing unrelated boilerplate.
6. No "negate old version / no longer related to something" redundant phrasing remains; if the current rule is clear, such sentences should be deleted or moved into a user-requested migration section.
7. No sub-agent rewrote documentation whole-file; manifest / index were written by the main agent only.
8. If `changeTracking.feat: true`: only archive `.task/active/<task-name>/` to `completed/` and remove the corresponding `todo.json` entry after all `task.md` "steps" are `[x]` (or canceled items are noted); do not move the directory while `[ ]` remains (same as the `f2s-task` archive gate).
9. If `changeTracking.feat: true`: `user-todos.md` exists; when user todos exist, its content matches the session conclusion.
