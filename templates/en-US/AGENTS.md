# flow-spec Project Entry

This file is written by `flow-spec init` to repository-root **`./AGENTS.md`** as the Codex project entry. **`./.codex/AGENTS.md`** is only a pointer. The knowledge-base root is **`./.flow-spec/`**.

## Do These Two Things First

1. **On the first repository-related turn in this conversation, read `./.flow-spec/manifest-routing.json`.**
2. **Before executing any `fs-*` skill, `Read("flow-spec.config.json")`.**

```text
Must execute: Read(".flow-spec/manifest-routing.json")
Must execute: Read("flow-spec.config.json")  <- only before entering an fs-* skill
```

Do not enter any `fs-*` skill-body step before reading `flow-spec.config.json`.

## Configuration Switches (disk is authoritative)

The table below explains field semantics and the defaults written by `flow-spec init`; the source of truth is the result of `Read("flow-spec.config.json")` in this turn (the user may have edited values).

{{FLOW_SPEC_PROJECT_CONFIG}}

- When `subAgent=true`, the main agent must make **one explicit split/no-split decision** near the start of the skill body and state why; even when deciding not to split, it must output the no-split reason. When `subAgent=false`, do not split to sub-agents.
- When `intentRecognition=false` or the field is missing, do not auto-enter any skill; enter only on explicit user trigger or high-confidence routing allowed by current rules.

For the detailed config table and supplemental rules, see **`./.codex/fs-rules/fs-config-check.md`**.

## KB Routing Rules

- The machine-readable source of truth is only **`./.flow-spec/manifest-routing.json`** plus the **`./.flow-spec/matchers/*.json`** file pointed to by each `matcherPath`.
- Execute `match -> expand -> verify -> act`: after the primary match, expand `topicDependencies`, then check for missing critical context.
- Cross-matcher full supplemental search is allowed only when there is no hit, the top candidates are too close, the gap check fails, or the user explicitly asks for a full check.
- `fallbackTopic` is only a low-confidence fallback and is not final execution authority.

## Ordinary-Q&A Closing Gate

- If ordinary Q&A / troubleshooting / explanation needs to drill into business source code, first follow **`./.codex/fs-rules/fs-knowledge-preflight.md`** for the initial read and gap note.
- If this turn read business source code and the final answer cites source-code facts, run the four-case closing in **`./.codex/fs-rules/fs-kb-feedback-closing.md`** before sending the answer; the answer must explicitly append either **`flow-spec-base follow-up suggestion`** or **`flow-spec base already covers this`**. Do not silently omit the closing marker.
- If this turn already entered an `fs-*` skill, `implement-tech-design`, `fs-git-commit`, or another existing follow-up flow, do not append the ordinary-Q&A closing prompt again.

## Progressive Reading Order

1. `./.flow-spec/manifest-routing.json`
2. The matched `./.flow-spec/matchers/<id>.json`
3. The relevant `./.flow-spec/topics/<topic>.md`
4. Only if the topic points there or context is still missing, read `./.flow-spec/index.md` / `stock-docs` / `req-docs`
5. Drill into business code last

Do not skip `manifest-routing.json` and jump straight to full-repository search.
Do not use `./.flow-spec/stock-docs/` as the direct input for implementing code from a spec.
Within the same task line, do not repeatedly reread the full manifest unless the user explicitly says routing/knowledge changed.

## Execution Authority

flow-spec execution authority is limited to:

- repository-root **`./AGENTS.md`**
- **`./.codex/fs-rules/fs-*.md`**
- **`./.codex/skills/`**

**`.codex/AGENTS.md`** is only a pointer and cannot replace root `AGENTS.md`.

## Codex Rule Mirrors (open on demand)

These files are mirrored by `flow-spec init codex` from rule templates into `.codex/fs-rules/`. They are not automatically loaded in full; open them only when the current task needs the details.

| Rule | Path | When to read |
| --- | --- | --- |
| Unified entry | `./.codex/fs-rules/fs-flow-spec-unified-entry.md` | When executing an `fs-*` skill or deciding KB routing, sub-agent, or verification semantics |
| Config preflight | `./.codex/fs-rules/fs-config-check.md` | When checking `flow-spec.config.json`, `subAgent`, or `changeTracking` details |
| Ordinary-Q&A initial gate | `./.codex/fs-rules/fs-knowledge-preflight.md` | Before ordinary Q&A drills into source code |
| Ordinary-Q&A closing | `./.codex/fs-rules/fs-kb-feedback-closing.md` | After ordinary Q&A reads source code and may need a KB follow-up suggestion |
| Intent routing | `./.codex/fs-rules/fs-intent-routing.md` | Only when `intentRecognition=true` and deciding whether to auto-enter a skill |

Open long-form topics such as `implement-tech-design` or `fs-doc-routing` only when the matched topic requires them.

## Codex Hooks

`flow-spec init codex` writes **`.codex/hooks.json`**. In Codex, flow-spec currently uses hooks only for:

- `SessionStart` configuration-summary reminder: `.codex/hooks/fs-config-session.js`
- `SessionStart` knowledge-base version check: `.codex/hooks/fs-update-check.js`

These hooks are only reminders / checks. They do not replace `Read("flow-spec.config.json")` or the KB routing gate.

## flow-spec Skills

Available skills live under **`./.codex/skills/`**. Enter a skill only when the user explicitly triggers it or the current routing rules allow automatic entry.

{{FLOW_SPEC_CODEX_SKILLS_SUMMARY}}
