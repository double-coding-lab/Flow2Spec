---
description: Before running any f2s-* skill, force-read flow2spec.config.json to determine the actual subAgent and switchAgentVerification values
alwaysApply: true
---

> **Task paths**: all `.task/` reads/writes must use **`TASK_ROOT` from `rules/f2s-task`** (` .task` or `.task/<developerId>`; config → git → legacy). Bare `.task/todo.json` / `.task/active/` below mean **`TASK_ROOT/...`**.


# Mandatory Preflight for f2s Skills

**The first action before running any `f2s-*` skill must be to read the project-root `flow2spec.config.json` with the Read tool**, obtain the actual `subAgent` and `switchAgentVerification` values, and then decide the orchestration approach.

```
Required: Read("flow2spec.config.json")  <- before any step in the skill body
```

| Read result | Behavior |
|---------|------|
| `subAgent: true` | First make an explicit decision about whether the current skill meets the split preconditions / scale threshold; if it does, follow the skill's B/C mode to dispatch sub agents and record "whether this run split work, to whom, and why"; otherwise continue in the main agent, but still output the no-split reason |
| `subAgent: false` | Complete everything in the main agent; do not split work to sub agents |
| `switchAgentVerification: true` | Writes from a sub agent are verified by the main agent; writes from the main agent are verified by a sub agent (requires `subAgent=true` and an actual split subtask) |
| `switchAgentVerification: false` | The writing side verifies its own work; no cross-verification |
| File does not exist | Treat every field as `false` |

**Claude Code**: `f2s-config-session` injects one configuration summary at `SessionStart`; `f2s-config-inject` only acts as a guard reminder in `PreToolUse`, reminding that the first step before invoking an `f2s-*` Skill must be `Read("flow2spec.config.json")`. Neither replaces the Read requirement in this rule.

**Cursor**: configuration reading still relies on text constraints (this `alwaysApply` rule) and does not depend on hooks reading configuration automatically.

**Codex**: `SessionStart` injects one configuration summary, but before entering any `f2s-*` skill body you still must `Read("flow2spec.config.json")`. When `subAgent=true`, the main agent **must first make an explicit split/no-split decision** for the current skill based on its preconditions / thresholds before deciding whether to dispatch sub agents; even when deciding not to split, it must output the no-split reason. Codex does **not** have Claude's `PreToolUse Skill` guard, so this decision cannot remain implicit.

### changeTracking

| Field | Effective skill | Behavior |
|------|---------|------|
| `changeTracking.feat: true` | `f2s-kb-feat` | **Step 0 is mandatory**: create or continue a change-tracking task under `.task/active/` |
| `changeTracking.feat: false` | `f2s-kb-feat` | Skip step 0 and do not create a `.task/` directory |
| `changeTracking.fix: true` | `f2s-kb-fix` | **Step 0 is mandatory**: create or continue a change-tracking task under `.task/active/` |
| `changeTracking.fix: false` | `f2s-kb-fix` | Skip step 0 and do not create a `.task/` directory |
| `changeTracking.implement: true` | `f2s-implement-tech-design` | **Step 2.5 writes the task list, step 2.6 checks off `task.md` as implementation progresses, and step 5 archives after the archive gate passes** |
| `changeTracking.implement: false` | `f2s-implement-tech-design` | Skip step 2.5, step 2.6, and the change-tracking portion of step 5 |

### intentRecognition

| Field | Behavior |
|------|------|
| `intentRecognition: true` | Enable intent recognition: high-confidence operational intents automatically enter the corresponding Skill according to `rules/f2s-intent-routing.*`; discussion, evaluation, and low-confidence input must not auto-invoke a Skill |
| `intentRecognition: false` | Do not enable automatic routing; enter a Skill only for an explicit `$f2s-*` command or a clear request to run a specific skill |
| Field does not exist | Treat as `false` |

**Do not enter any execution step in a skill body before this file has been read.**
