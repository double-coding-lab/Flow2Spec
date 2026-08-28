---
id: config-precheck
revision: 0
summary: "Read flow2spec.config.json switches before running any f2s skill"
primary: config
confidence: manual
tags: [policy]
---
# config-precheck (routing summary)

## Purpose

- Anchors topic id **`config-precheck`** for `manifest-routing.topicPaths`.
- Relates to reading the project-root **`flow2spec.config.json`** (`subAgent`, `switchAgentVerification`, `changeTracking`) before executing any **`f2s-*` skill**. Its semantics match the top of repository-root **`AGENTS.md`** and the "unified entry".

## Complete Instructions (on demand; do not maintain a second full body in `.Knowledge`)

| Side | Path |
| --- | --- |
| Codex | Repository-root `.codex/topics/f2s-config-check.md` (init mirror, same source as template); SessionStart: `.codex/hooks/f2s-config-session.js` |
| Cursor | Repository-root `.cursor/rules/f2s-config-check.mdc` (`flow2spec init cursor`) |
| Claude | `.claude/rules/f2s-config-check.md`; SessionStart: `.claude/hooks/f2s-config-session.js`; PreToolUse guard: `.claude/hooks/f2s-config-inject.js` |

## Required Steps

1. Use **Read** to open project-root **`flow2spec.config.json`** (must happen before any step in an `f2s-*` skill body).
2. The `{{FLOW2SPEC_PROJECT_CONFIG}}` table in repository-root **`AGENTS.md`** only explains field semantics; current values come from the **Read** result.
3. When `subAgent=true`, the main agent must explicitly decide early in the skill body whether this run meets the split preconditions / thresholds; even when deciding not to split, it must output the no-split reason. The SessionStart summary is only a reminder and does not replace that decision.

## Prohibitions

- Do not enter **`f2s-*`** skill-body steps before reading **`flow2spec.config.json`** (same rule as `AGENTS` and `.codex/topics/f2s-config-check.md`). Claude/Codex SessionStart summaries and Claude's PreToolUse guard reminder do not replace this Read.
