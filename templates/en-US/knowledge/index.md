# flow-spec Knowledge Index

> **Path convention**: paths such as **`.flow-spec/`** and **`manifest-routing.json`** below are relative to **this repository root** (the current project where `flow-spec init` has been run).

This file is **human-readable navigation**: topic descriptions, related-document summaries, and semantic boundaries.
The **machine-readable source of truth** is `.flow-spec/manifest-routing.json` plus the `.flow-spec/matchers/*.json` shards pointed to by `taskToTopicRules[].matcherPath` (`.flow-spec/manifest-matchers.json` is no longer used).

---

## Recommended Reading Order

1. `.flow-spec/manifest-routing.json` (task routing, `topicPaths`, `topicDependencies`, `fallbackTopic`)
2. As needed: read `.flow-spec/matchers/<id>.json` from `matcherPath` (`includeAny` keywords)
3. As needed: this `index.md` (topic semantics and boundaries)
4. `.flow-spec/topics/<topic>.md` (execution constraints and flows)
5. As needed: `.flow-spec/stock-docs/`, `.flow-spec/req-docs/`
6. Drill into business code only if still insufficient

---

## Topic Overview

| Topic | Path | Applies when | Related documents (summary) |
| --- | --- | --- | --- |
| implement-tech-design | `.flow-spec/topics/fs-implement-tech-design.md` | Implement code from a technical spec | req: [technical spec](.flow-spec/req-docs/<technical-spec>.md) (required) |
| fs-doc-routing | `.flow-spec/topics/fs-stock-docs-vs-req-docs.md` | stock-docs / req-docs directory responsibilities | stock: [directory boundary notes](.flow-spec/stock-docs/<directory-boundary-notes>.md) (optional) |
| fallback-triage | `.flow-spec/topics/fs-fallback-triage.md` | No hit or low confidence: triage and clarification | stock: [routing triage notes](.flow-spec/stock-docs/<triage-notes>.md) (optional) |
| config-precheck | `.flow-spec/topics/fs-config-precheck.md` | Read `flow-spec.config.json` / orchestration switches before executing `fs-*` | Codex long-form: repository-root `.codex/fs-rules/fs-config-check.md`; [routing summary](topics/fs-config-precheck.md) |
| fs-task | `.flow-spec/topics/fs-task.md` | Change tracking, `.task/` task lists, and cross-session resume | Long-form: configuration-root `rules/fs-task.*`; Codex: `.codex/fs-rules/fs-task.md` |
| fs-req-plan | `.flow-spec/topics/fs-req-plan.md` | Requirement/spec planning and implementation; always maintain `.task/` | Skill: `skills/fs-req-plan/SKILL.md`; depends on `fs-task` |

Keep **1-3** clickable summary links per topic. Full path mappings are written to `.flow-spec/migration-report.md` in migration scenarios.
Among these, **`implement-tech-design`**, **`fs-doc-routing`**, **`config-precheck`**, and **`fs-task`** are **routing summaries** under `topics/`; long-form execution instructions live in configuration-root **`rules/fs-*.md(c)`**. When using Codex, see **`.codex/AGENTS.md`** and **`.codex/fs-rules/fs-*.md`** (`fs-config-check` shares the same pre-step source as `AGENTS`; open on demand). **`fs-knowledge-preflight`** and **`fs-kb-feedback-closing`** are gates for initial reads in ordinary Q&A and closure after source-code supplementation. They are effective as configuration-root rules / Codex long-form topics and are not written into `topicPaths` or `taskToTopicRules`.

---

## Match and Execute (consistent with the unified entry)

- **Routing**: `taskToTopicRules` maps tasks to topic sets; **keywords** live in matcher-shard `includeAny`.
- **Dependencies**: before using the main topic, read dependency topics according to `topicDependencies`.
- **Fallback**: `fallbackTopic` points to a triage topic (such as `fallback-triage`) and is only low-confidence context. It **must not** be treated as a final hit for direct code changes.
- **Execution chain**: `match → expand → verify → act`; `expand` must include dependency expansion and keep the next-highest candidate for validation.
- **Full supplemental search**: cross-matcher supplemental search is allowed only when there is no hit, candidate margins are too small, the gap check fails, or the user explicitly requests a "full check".

---

## Directory Responsibilities

| Directory | Responsibility |
| --- | --- |
| `topics/` | Topic rules and execution flows |
| `matchers/` | Matcher shards (pointed to by `matcherPath`) |
| `stock-docs/` | Existing knowledge deposits (architecture, final drafts, etc.) |
| `req-docs/` | Requirements and technical specs (implementation drivers) |
| `template/` | Final-draft and spec templates |

The routing manifest is maintained by `fs-*` skill flows and does not depend on an additional CLI subcommand.

---

## How to Handle Common Gaps (consistent with the unified entry)

| Situation | What to do |
| --- | --- |
| Docs exist but are not routed (1a) | Maintenance side: use `fs-kb-build` / `fs-kb-sync` / `fs-kb-add` to supplement routing and `includeAny`. Execution side: use the triage topic to clarify task type; **do not** replace the manifest with full-repository scanning. |
| Routed but insufficient (1b) | Follow dependencies and next-highest candidates -> in `verify`, name the missing document; if still missing, ask the user for the path or add `req-docs`. |
| Not in the KB (2) | Acknowledge the gap -> drill into code or ask the user to add requirement/spec documents. |
| Repeated manifest reads waste tokens (2a) | Within the same task line, treat routing as a snapshot; read only the single matcher for the hit; do not enumerate the entire `matchers/` directory; do not repeatedly refresh `index.md` and routing against each other. |

**Note**: "routing/knowledge has been updated" means output from `fs-*` flows (such as `fs-kb-build`, `fs-kb-sync`, `fs-kb-add`, `fs-kb-fix`) or manual edits to `manifest-routing` / `matchers` shards. **`flow-spec init` does not author business documents**; it mainly fills templates and writes configuration roots. Do not confuse it with knowledge-base content updates.
