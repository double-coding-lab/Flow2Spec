# config-precheck (routing summary)

## Purpose

- Anchors topic id **`config-precheck`** for `manifest-routing.topicPaths`.
- Relates to reading the project-root **`flow-spec.config.json`** (`subAgent`, `switchAgentVerification`, `changeTracking`) before executing any **`fs-*` skill**. Its semantics match the top of repository-root **`AGENTS.md`** and the "unified entry".

## Complete Instructions (on demand; do not maintain a second full body in `.flow-spec`)

| Side | Path |
| --- | --- |
| Codex | Repository-root `.codex/fs-rules/fs-config-check.md` (init mirror, same source as template); SessionStart: `.codex/hooks/fs-config-session.js` |
| Cursor | Repository-root `.cursor/rules/fs-config-check.mdc` (`flow-spec init cursor`) |
| Claude | `.claude/rules/fs-config-check.md`; SessionStart: `.claude/hooks/fs-config-session.js`; PreToolUse guard: `.claude/hooks/fs-config-inject.js` |

## Required Steps

1. Use **Read** to open project-root **`flow-spec.config.json`** (must happen before any step in an `fs-*` skill body).
2. The `{{FLOW_SPEC_PROJECT_CONFIG}}` table in repository-root **`AGENTS.md`** only explains field semantics; current values come from the **Read** result.
3. When `subAgent=true`, the main agent must explicitly decide early in the skill body whether this run meets the split preconditions / thresholds; even when deciding not to split, it must output the no-split reason. The SessionStart summary is only a reminder and does not replace that decision.

## Prohibitions

- Do not enter **`fs-*`** skill-body steps before reading **`flow-spec.config.json`** (same rule as `AGENTS` and `.codex/fs-rules/fs-config-check.md`). Claude/Codex SessionStart summaries and Claude's PreToolUse guard reminder do not replace this Read.
