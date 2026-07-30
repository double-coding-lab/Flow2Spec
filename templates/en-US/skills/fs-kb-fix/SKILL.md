---
name: fs-kb-fix
description: Fix implementation or rule errors identified by the user, and sync the knowledge base by default; triggers: fs-kb-fix、修正实现规则、fix implementation rules、fix kb rule
---

> **Task paths**: all `.task/` reads/writes must use **`TASK_ROOT` from `rules/fs-task`** (` .task` or `.task/<developerId>`; config → git → legacy). Bare `.task/todo.json` / `.task/active/` below mean **`TASK_ROOT/...`**.


> Execution scope: `fs-kb-fix` defaults to "fix code + sync `.flow-spec`"; the user does not need to separately ask "please sync the knowledge base".

## Orchestration (main / sub-agent)

- The meaning of `subAgent` / `switchAgentVerification` uses the unified entry as the only source of truth: **Cursor/Claude** read the configuration-root `rules/fs-flow-spec-unified-entry.*`; **Codex** reads `.codex/fs-rules/fs-flow-spec-unified-entry.md` (same source, mirrored by `flow-spec init`). Do not repeat those definitions here.
- Code subpackage (bug-fix implementation code): when `subAgent=true`, it may be delegated to a sub-agent.
- Documentation subpackage (style-sensitive changes to rules / skills / topics / stock-docs): by default, do not split; the main agent writes them directly to preserve writing constraints such as "current truth wins", length limits, and no stacked historical negation.
- If documentation changes must be delegated, the sub-agent **only outputs an in-place replacement diff** (small before / after snippets) and **must not rewrite whole files**; the main agent merges and writes the result.
- Write-authority hard rule: `manifest-routing.json` / `.flow-spec/index.md` are always written by the main agent; sub-agents must not touch them.
- The writing side verifies its own work.

# Fix Capability (fs-kb-fix)

## Input

- The user describes the violation, the correct behavior, and an optional scope.

## Steps

**Step 0: Change Tracking (only when `changeTracking.fix: true`)**

Before execution, read `flow-spec.config.json`. If `changeTracking.fix: true`:

- Check whether `.task/todo.json` has an active task, and match the user description against `keywords`.
- Match -> load the corresponding `task.md`, show the remaining checklist, and continue in the existing task.
- No match -> create a new task (see the `fs-task` rule), and write steps 1-4 into `task.md` as a task checklist.
- **Mandatory in-progress writes**: every time a step in `task.md` is completed, immediately `Edit` that step from `[ ]` to `[x]` in the same session; do not accumulate checkmarks or use verbal completion instead of writing to disk (see `fs-task` "interruption and session end" and "archive gate").
- **User todos**: whenever the user must change a repository, configure an environment, perform regression verification, or handle similar items, append them in the same session to `.task/active/<task-name>/user-todos.md` (see `fs-task`); when creating a new task and there are no todos, write a placeholder note.

1. Clarify the violation and impact scope (ask follow-up questions first if unclear).
2. Fix the code implementation.
3. Sync the knowledge base (default behavior):
   - `.flow-spec/stock-docs/`: revise convention descriptions.
   - `.flow-spec/topics/`: revise the corresponding topic rules / workflows.
   - `.flow-spec/index.md`: update the topic index.
   - Routing manifest: minimally update it if routing, dependencies, or `topicMetadata` are affected.
   - **Authoring-side guideline**: if this step adds or modifies topics, `topicMetadata`, or `topicDependencies`, first Read the full `rules/fs-topic-authoring.*` (**Cursor/Claude**: `rules/fs-topic-authoring.mdc`; **Codex**: `.codex/fs-rules/fs-topic-authoring.md`) before writing.
4. Output a summary (code changes + knowledge-base changes).

## Output Summary Format (Recommended)

```markdown
## Fix Result: <brief convention>

### Code
- <file path>: <change description>

### Knowledge Base
- .flow-spec/stock-docs/<file>.md: <new/revised description>
- .flow-spec/topics/<topic>.md: <new/revised description>
- .flow-spec/index.md: <update description>
- .flow-spec/manifest-routing.json: <whether updated and why>
- .flow-spec/matchers/<id>.json: <whether updated and why>
```

## Complex Scenario Example

The user points out that an idempotency implementation in a callback interface is wrong, but does not provide a clear file scope.

- First fix the already located callback-processing path with the smallest viable scope, and state in the summary that "similar fixes can be extended across the repository".
- Sync the idempotency-rule paragraph in `topics` to avoid regenerating the same wrong implementation later.
- If this fix affects task routing (for example, by adding an "idempotency fix" topic), then minimally update `manifest`.

## Constraints

- When there is a conflict with an old convention: **rewrite to the current truth**; do not stack contrastive legacy phrases such as "(no longer related to X)".
- Prefer in-place updates for the same topic.
- If the scope is unclear, fix the smallest viable scope and explain it.
- Do not modify the configuration-root `rules/skills`.
- Documentation subpackages are not split by default; when delegation is necessary, the sub-agent only outputs before/after diff snippets, and the main agent merges and writes them. `manifest-routing.json` / `.flow-spec/index.md` are always written by the main agent (write-authority hard rule).

## Knowledge-Base Writing Style (Required, Anti-Redundancy)

When writing `stock-docs` / `topics` / `index`, follow these rules:

1. **Minimal increment**: only change paragraphs or list items directly related to **this fix**; do not use the sync as an excuse to restate the whole design, historical background, or unrelated explanations.
2. **Affirmative wording first (see the unified entry "knowledge-base writing style")**: state the correct behavior directly; do not communicate the new convention by negating the old one, except for mutually exclusive choices.
3. **Avoid duplicate narration**: do not write long explanations of the same fix in both `stock-docs` and `topics`; write the "cause / correct convention / notes" clearly in one place, and use a short reference or link in the other.
4. **Prefer structured bullets**: use short lists ordered as "symptom -> root cause -> correct behavior / boundary" instead of prose-heavy expansion.
5. **Length limit (soft constraint)**: in one sync, new or replaced text in the **same file** should generally not exceed about **60 lines** (excluding code-block lines); if it does, keep only the minimal explanation relevant to the fix and replace the rest with "see commit / see path".
6. **`index.md`**: update only affected index rows or summary columns; do not rewrite unrelated tables.
7. **Forbidden**: repeatedly paste the user's full error text (one identifying line + link is enough), or repeatedly explain how flow-spec works.

## Completion Self-Check

1. The code fix covers the scope named by the user.
2. Topic documents match the fixed implementation.
3. `index` points to the correct topic.
4. If `manifest` was updated, routing fields are still parseable.
5. If `topicMetadata` was written: every key exists in `topicPaths`; `primary` / `tags` / `confidence` are valid; no topic was created, renamed, or split just for classification.
6. Knowledge-base changes can no longer be compressed without losing the convention after removing boilerplate.
7. No redundant "negate old version / no longer related to something" phrasing remains; if the current rule is clear, such phrasing should be removed.
8. No sub-agent rewrote documentation whole-file; manifest / index were written by the main agent only.
9. If `changeTracking.fix: true`: only archive `.task/active/<task-name>/` to `completed/` and remove the corresponding `todo.json` entry after all `task.md` "steps" are `[x]` (or canceled items are noted); do not move the directory while `[ ]` remains (same as the `fs-task` archive gate).
10. If `changeTracking.fix: true`: `user-todos.md` exists; when user todos exist, its content matches the session conclusion.
