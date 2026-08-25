[中文](../使用说明.md) | [English](./usage-guide.md)

# Flow2Spec Usage Guide

## 1. What `init` Does

Execute in the project root:

```bash
flow2spec init [cursor|claude|codex|dsh ...]
# To force reset .Knowledge from template:
flow2spec init [cursor|claude|codex|dsh ...] --reset-knowledge
```

| What `init` does | What `init` does NOT do |
|---------|----------|
| Fills in missing directories and template files | Write or update business document content |
| Writes agent config root `rules/` `skills/` | Update `includeAny` business terms |
| Aligns `manifest-routing` + `matchers/` package-level structure | Replace `f2s-*` skills for writing business semantics |
| Overwrites `.Knowledge` template files with `--reset-knowledge` | Override existing `.Knowledge` content (without this flag) |

> **`init` and "knowledge base upgrade" are two different things**: `init` only handles structural alignment — business semantics (topics content, routing terms, stock-docs/req-docs) are maintained by skills like `f2s-kb-add`, `f2s-kb-fix`, `f2s-kb-feat`, `f2s-kb-sync`, `f2s-kb-build`, etc. For cross-version upgrades, use `f2s-kb-upgrade`. **Do not treat a standalone `init` as an upgrade command.**

### `f2s-*` and `flow2spec.config.json`: Multi-Client, Multi-Layered Reminders (Authority Remains the Disk JSON)

Before executing any **`f2s-*` skill**, the Agent needs to obtain the actual values of **`subAgent` / `switchAgentVerification` / `changeTracking`**, etc. Flow2Spec enforces this via **different mechanisms** on **different clients**; they **complement** each other and do **not** replace one another. **Authority always** resides in the project root **`flow2spec.config.json`** (call **Read** to verify against disk before proceeding into skill body).

| Client | `init` Output & Behavior | Description |
| --- | --- | --- |
| **Cursor** | `.cursor/rules/f2s-config-check.mdc` (`alwaysApply`) | Config reading remains rule-based: **Read(`flow2spec.config.json`)** before entering skill body. Cursor hooks are used for update checks only, not automatic config reads. |
| **Claude Code** | `.claude/hooks/f2s-config-session.js` + `.claude/hooks/f2s-config-inject.js` + `.claude/settings.json` | `SessionStart` injects one config summary; `PreToolUse` only guards **`f2s-*` Skill** calls by reminding the agent that the first skill-body action must be **Read**. Neither replaces the disk read. |
| **Codex** | root `AGENTS.md` mandatory step + `.codex/topics/f2s-config-check.md` + `{{FLOW2SPEC_PROJECT_CONFIG}}` field-semantics table + `.codex/hooks/f2s-config-session.js` | `SessionStart` injects one configuration summary; config reading still relies on text rules and **Read** as a hard requirement; the table explains field semantics only, does not write current values, and disk Read is authoritative. Codex has no Claude-style `PreToolUse` guard, so when `subAgent=true` the skill body must explicitly decide whether to split; even when it does not split, it must output the no-split reason. |
| **DeepSeek Harness** | native plugin `@double-coding/flow2spec-deepseek-harness`; or `flow2spec init dsh` writing root `AGENTS.md` (generated only when absent) + `.dsh/skills/` + `.dsh/topics/` | Prefer the [Flow2Spec-DeepSeek-Harness](https://github.com/double-coding-lab/Flow2Spec-DeepSeek-Harness) native Cordis plugin. Without the plugin, Harness loads project instructions from repository-root `AGENTS.md` and discovers project skills from `.dsh/skills/<name>/SKILL.md`; Flow2Spec mirrors long-form rules to `.dsh/topics/`. |
| **Knowledge Base (optional)** | When `.Knowledge/manifest-routing` hits **`config-precheck`** | `.Knowledge/topics/f2s-config-precheck.md` is a **routing summary** that links to the Codex long-form article; Flow2Spec does **not** maintain a second full copy in `.Knowledge`, nor does it replace a `Read` of the JSON. |

For field semantics and default value rules, see [Commands Reference § 6) Sub-Agent Configuration](./commands-reference.md). For the design perspective, see [Design Principles § 4.5.1](./design-principles.md).

---

## 2. Directory Conventions

Core distinction: `stock-docs/` holds solidified documents (driving knowledge routing), `req-docs/` holds technical designs (driving coding implementation); they are not interchangeable.

See [Directory Conventions](./directory-conventions.md) for the full directory description.

---

## 3. Typical Workflows

### Change Tracking and Cross-Session Continuation (Recommended)

Enable `changeTracking` per skill in `flow2spec.config.json` (each sub-field is independent):

```json
{
  "changeTracking": {
    "feat": true,
    "fix": true,
    "implement": true
  }
}
```

When enabled, `f2s-kb-feat` / `f2s-kb-fix` / `f2s-implement-tech-design` automatically create a checklist under **`TASK_ROOT/active/`** (see multi-developer below), check off steps, and archive on completion. In later sessions, the `f2s-task` rule matches related wording and resumes the remaining steps — no need to re-explain context.

If **`changeTracking` is off** but you still need a task checklist temporarily, call `f2s-req-plan` explicitly (always creates a checklist, ignores config) — a **fallback**, not the default path. See [Commands Reference § f2s-req-plan](./commands-reference.md).

### Team Collaboration

Flow2Spec separates personal execution state from team knowledge:

- `.task/` is local and ignored by Git. With collaboration enabled it is partitioned into `.task/<developerId>/`; continuation logic reads only the current `TASK_ROOT`.
- `.Knowledge/` is shared through Git. Knowledge skills produce a structured `kb-delta.json`, and the CLI checks topic revisions before merging it.

developerId resolution follows explicit `collaboration.developerId` -> Git email prefix -> Git user name -> legacy `.task/`. Invalid explicit ids fail instead of silently changing identity. Non-ASCII Git identities use a stable `dev-xxxxxxxx` hash fallback with a warning. Setting `collaboration.enabled: false` always selects the legacy root.

The knowledge merge commands are:

```bash
flow2spec kb status
flow2spec kb check --strict
flow2spec kb plan  .task/<id>/active/<task>/kb-delta.json
flow2spec kb apply .task/<id>/active/<task>/kb-delta.json
flow2spec kb build
```

In normal work, `f2s-git-commit` runs the relevant `check -> status -> plan -> apply -> build -> check` sequence. The shell commands are useful for diagnosis and CI. When `baseRevisions` no longer matches disk, pull the latest topic, reread its meaning, and rewrite the delta; changing only the number is not a semantic merge.

Existing topics without revisions require a one-time migration with `flow2spec kb build --fix-topics`, followed by review and `flow2spec kb check --strict`. The full model, same-topic conflict handling, and manager visibility are covered in [Team Collaboration](./team-collaboration.md).

### New Feature Development

```
f2s-req-clarify (one-line requirement or doc) → f2s-req-tech → implement <technical design> (strictly follows implement-tech-design rule)
After implementation, new capability → f2s-kb-feat
After implementation, bug fix → f2s-kb-fix
After debugging → f2s-kb-sync
Finally → f2s-git-commit
```

When requirements are already clear, `f2s-req-clarify` can be skipped, starting directly from `f2s-req-tech`. After the technical design is written into `req-docs/`, the `implement-tech-design` rule drives coding.

### Document Ingestion

```
New architecture document ingestion: f2s-doc-arch → f2s-doc-final → f2s-kb-build
PDF/draft ingestion:               f2s-doc-final → f2s-kb-build
```

Integrate architecture descriptions or PDF final drafts into knowledge routing (generates topics/matchers/manifest-routing). To ingest a PDF into the knowledge base, use `f2s-doc-final` then `f2s-kb-build`. `f2s-doc-pdf` only converts a PDF to Markdown under `req-docs/` for editing; it is **not** the recommended path for "PDF straight to coding."

### Backfilling Existing Capabilities

```
f2s-kb-add      # Aggregate multiple files, extract from source code / documents
f2s-kb-sync      # Infer already-implemented capabilities from current session
```

Use these when code has already been shipped but the knowledge base has no record. `f2s-kb-add` is suitable for batch imports; `f2s-kb-sync` is suitable for real-time consolidation at the end of a session.

### Routine Maintenance

```
f2s-kb-fix       # Fix implementation or rule errors, auto-sync knowledge base
f2s-kb-feat      # Add new capabilities, auto-sync knowledge base
f2s-kb-sync      # Periodic sync or backfill
f2s-kb-merge     # Resolve context conflicts after Git merges
```

### Cross-Version Knowledge Base Upgrade

```
Core-only update (Template Version unchanged): update Core and run one idempotent init to refresh the Hook; do not enter f2s-kb-upgrade
Template update: after init, projectRev == pkgRev takes the fast path; a difference enters the full f2s-kb-upgrade flow
Legacy layout (V1): built-in migration removed; use a historical package version (@3.4.x or earlier) for a one-time migration, or move into .Knowledge manually
```

`flow2spec version` shows CLI, Core, Core Range, Template, and Protocol. `flow2spec update --check|--cli|--core` checks updates, updates CLI, or updates a compatible Core. SessionStart Hooks compare Core and Template independently: Core-only updates do not trigger knowledge upgrade; Template updates use `projectRev` / `pkgRev` after init to decide whether to run `f2s-kb-upgrade`. Failed checks are skipped silently; CLI self-checks do not interrupt `CI` or runs with `FLOW2SPEC_SKIP_UPDATE_CHECK=1`.

After `flow2spec init codex`, Codex projects include `.codex/hooks.json`, `.codex/hooks/f2s-config-session.js`, and `.codex/hooks/f2s-update-check.js`. On Codex `SessionStart` for `startup|resume`, the first script injects one configuration summary and the second checks the knowledge-base version automatically. When the hook is first generated or changed, trust it through `/hooks` in Codex. Set `updateCheck.enabled=false` in `flow2spec.config.json` to skip only the version check.

Prefer the native Cordis plugin `@double-coding/flow2spec-deepseek-harness` from [Flow2Spec-DeepSeek-Harness](https://github.com/double-coding-lab/Flow2Spec-DeepSeek-Harness). Without the plugin, run `flow2spec init dsh`: Flow2Spec writes project skills to `.dsh/skills/`, mirrors long-form rules to `.dsh/topics/`, and writes `.dsh/AGENTS.md` as a directory pointer. If the repository has no root `AGENTS.md`, init generates a Harness-compatible full entry; an existing root file is preserved.

After `flow2spec init cursor`, Cursor projects include `.cursor/hooks.json` and `.cursor/hooks/f2s-update-check.js`. The hook runs on Cursor `sessionStart` and injects upgrade reminders through `additional_context`. Set `updateCheck.enabled=false` in `flow2spec.config.json` to skip the check.

After `flow2spec init claude`, Claude projects include `.claude/settings.json`, `.claude/hooks/f2s-config-session.js`, `.claude/hooks/f2s-config-inject.js`, and `.claude/hooks/f2s-update-check.js`: `SessionStart` injects the configuration summary and checks Core/Template independently, while `PreToolUse Skill` only guards `f2s-*` Skill calls. The Hook injects the relevant Core-only or Template-update action through `additional_context`; an unresolved same-day cache is reminded again, and completion clears `.Knowledge/update-check.json`.

---

## 4. Agent Execution Configuration

Controlled via the project root `flow2spec.config.json`. For complete field rules, see [Commands Reference § 6) Sub-Agent Configuration](./commands-reference.md). **How each client is reminded to read the config, and why `Read` remains authoritative** — see **§ 1** (this § only explains **when** to toggle each switch).

**When to enable `subAgent: true`**: When the task is large (multi-module parallel implementation, batch document ingestion, large-scale migration). When enabled, each skill decides whether to actually split based on its own size threshold; tasks below the threshold are still completed within the main agent.

**When to enable `switchAgentVerification: true`**: When higher write consistency is needed (large-scale migration, critical design implementation). The trade-off is increased execution rounds; for routine maintenance, the default `false` is sufficient. Requires `subAgent: true` to trigger the "main-writes, sub-verifies" cross-check direction.

**When to enable `changeTracking.*`**: When you want each skill execution to automatically leave a resumable task checklist. Each skill sub-item is independently configurable without mutual interference:

```json
{
  "changeTracking": {
    "feat": true,
    "fix": false,
    "implement": true
  }
}
```

Use `f2s-req-plan` only when all `changeTracking` sub-fields are off and you still need a checklist (see § 3 footnote).

---

## 5. Customization Suggestions

- When customizing the "implement from technical design" logic for your project, prioritize adjusting **`f2s-implement-tech-design`**: Cursor `.cursor/rules/f2s-implement-tech-design.mdc`, Claude `.claude/rules/f2s-implement-tech-design.md`; Codex uses `.codex/AGENTS.md` and associated `skills/` as the source of truth.
- Running `init` again by default only fills in missing templates and performs package-level structural alignment — it does **not** replace `f2s-*` skills for maintaining business content. To reset `.Knowledge` from the template, add `--reset-knowledge`.

---

## 6. Skill Identification

Skills are triggered by matching `name` and `description`. Files are located under `config-root/skills/*/SKILL.md`.

---

## 7. Related Documents

- [Flow2Spec Introduction](./Flow2Spec-Introduction.md)
- [Commands Reference](./commands-reference.md)
- [Directory Conventions](./directory-conventions.md)
- [Architecture](./architecture.md)
- [Usage Scenarios](./usage-scenarios.md)
- [Team Collaboration](./team-collaboration.md)
- [Project Milestones](./milestones.md)
