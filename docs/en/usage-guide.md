[中文](../使用说明.md) | [English](./usage-guide.md)

# flow-spec Usage Guide

## 1. What `init` Does

Execute in the project root:

```bash
flow-spec init [cursor|claude|codex ...]
# To force reset .flow-spec from template:
flow-spec init [cursor|claude|codex ...] --reset-knowledge
```

| What `init` does | What `init` does NOT do |
|---------|----------|
| Fills in missing directories and template files | Write or update business document content |
| Writes agent config root `rules/` `skills/` | Update `includeAny` business terms |
| Aligns `manifest-routing` + `matchers/` package-level structure | Replace `fs-*` skills for writing business semantics |
| Overwrites `.flow-spec` template files with `--reset-knowledge` | Override existing `.flow-spec` content (without this flag) |

> **`init` and "knowledge base upgrade" are two different things**: `init` only handles structural alignment — business semantics (topics content, routing terms, stock-docs/req-docs) are maintained by skills like `fs-kb-add`, `fs-kb-fix`, `fs-kb-feat`, `fs-kb-sync`, `fs-kb-build`, etc. For cross-version upgrades, use `fs-kb-upgrade`. **Do not treat a standalone `init` as an upgrade command.**

### `fs-*` and `flow-spec.config.json`: Multi-Client, Multi-Layered Reminders (Authority Remains the Disk JSON)

Before executing any **`fs-*` skill**, the Agent needs to obtain the actual values of **`subAgent` / `switchAgentVerification` / `changeTracking`**, etc. flow-spec enforces this via **different mechanisms** on **different clients**; they **complement** each other and do **not** replace one another. **Authority always** resides in the project root **`flow-spec.config.json`** (call **Read** to verify against disk before proceeding into skill body).

| Client | `init` Output & Behavior | Description |
| --- | --- | --- |
| **Cursor** | `.cursor/rules/fs-config-check.mdc` (`alwaysApply`) | Config reading remains rule-based: **Read(`flow-spec.config.json`)** before entering skill body. Cursor hooks are used for update checks only, not automatic config reads. |
| **Claude Code** | `.claude/hooks/fs-config-session.js` + `.claude/hooks/fs-config-inject.js` + `.claude/settings.json` | `SessionStart` injects one config summary; `PreToolUse` only guards **`fs-*` Skill** calls by reminding the agent that the first skill-body action must be **Read**. Neither replaces the disk read. |
| **Codex** | root `AGENTS.md` mandatory step + `.codex/fs-rules/fs-config-check.md` + `{{FLOW_SPEC_PROJECT_CONFIG}}` field-semantics table + `.codex/hooks/fs-config-session.js` | `SessionStart` injects one configuration summary; config reading still relies on text rules and **Read** as a hard requirement; the table explains field semantics only, does not write current values, and disk Read is authoritative. Codex has no Claude-style `PreToolUse` guard, so when `subAgent=true` the skill body must explicitly decide whether to split; even when it does not split, it must output the no-split reason. |
| **Knowledge Base (optional)** | When `.flow-spec/manifest-routing` hits **`config-precheck`** | `.flow-spec/topics/fs-config-precheck.md` is a **routing summary** that links to the Codex long-form article; flow-spec does **not** maintain a second full copy in `.flow-spec`, nor does it replace a `Read` of the JSON. |

For field semantics and default value rules, see [Commands Reference § 6) Sub-Agent Configuration](./commands-reference.md). For the design perspective, see [Design Principles § 4.5.1](./design-principles.md).

---

## 2. Directory Conventions

Core distinction: `stock-docs/` holds solidified documents (driving knowledge routing), `req-docs/` holds technical designs (driving coding implementation); they are not interchangeable.

See [Directory Conventions](./directory-conventions.md) for the full directory description.

---

## 3. Typical Workflows

### Change Tracking and Cross-Session Continuation (Recommended)

Enable `changeTracking` per skill in `flow-spec.config.json` (each sub-field is independent):

```json
{
  "changeTracking": {
    "feat": true,
    "fix": true,
    "implement": true
  }
}
```

When enabled, `fs-kb-feat` / `fs-kb-fix` / `fs-implement-tech-design` automatically create a checklist under **`TASK_ROOT/active/`** (see multi-developer below), check off steps, and archive on completion. In later sessions, the `fs-task` rule matches related wording and resumes the remaining steps — no need to re-explain context.

If **`changeTracking` is off** but you still need a task checklist temporarily, call `fs-req-plan` explicitly (always creates a checklist, ignores config) — a **fallback**, not the default path. See [Commands Reference § fs-req-plan](./commands-reference.md).

### Multi-developer task isolation (P0)

- **Shared**: `.flow-spec/` (team truth). **Isolated**: task progress under `TASK_ROOT`.
- **developerId resolve** (only three steps): `collaboration.developerId` in config → git `user.email` / `user.name` (sanitized) → legacy single-root `.task/`.
- **`collaboration.enabled: false`**: always legacy `.task/`.
- **`TASK_ROOT`**: `.task/<developerId>` or `.task` (legacy). Resume must **not** scan other developers' todos (see `rules/fs-task`). Helper: `lib/developerId.js`.

### New Feature Development

```
fs-req-clarify (one-line requirement or doc) → fs-req-tech → implement <technical design> (strictly follows implement-tech-design rule)
After implementation, new capability → fs-kb-feat
After implementation, bug fix → fs-kb-fix
After debugging → fs-kb-sync
Finally → fs-git-commit
```

When requirements are already clear, `fs-req-clarify` can be skipped, starting directly from `fs-req-tech`. After the technical design is written into `req-docs/`, the `implement-tech-design` rule drives coding.

### Document Ingestion

```
New architecture document ingestion: fs-doc-arch → fs-doc-final → fs-kb-build
PDF/draft ingestion:               fs-doc-final → fs-kb-build
```

Integrate architecture descriptions or PDF final drafts into knowledge routing (generates topics/matchers/manifest-routing). To ingest a PDF into the knowledge base, use `fs-doc-final` then `fs-kb-build`. `fs-doc-pdf` only converts a PDF to Markdown under `req-docs/` for editing; it is **not** the recommended path for "PDF straight to coding."

### Backfilling Existing Capabilities

```
fs-kb-add      # Aggregate multiple files, extract from source code / documents
fs-kb-sync      # Infer already-implemented capabilities from current session
```

Use these when code has already been shipped but the knowledge base has no record. `fs-kb-add` is suitable for batch imports; `fs-kb-sync` is suitable for real-time consolidation at the end of a session.

### Routine Maintenance

```
fs-kb-fix       # Fix implementation or rule errors, auto-sync knowledge base
fs-kb-feat      # Add new capabilities, auto-sync knowledge base
fs-kb-sync      # Periodic sync or backfill
fs-kb-merge     # Resolve context conflicts after Git merges
```

### Cross-Version Knowledge Base Upgrade

```
fs-kb-migrate (Legacy V1: old knowledge base) → fs-kb-upgrade
fs-kb-upgrade (Current V2+: already has .flow-spec; includes npm v3.x projects, etc.; see skill step 0)
```

In interactive terminals, the flow-spec CLI checks the latest npm version with a cache when running `flow-spec version` / `flow-spec init`. If a newer version exists, it prompts you to run `flow-spec update`, then execute `fs-kb-upgrade` in the Agent conversation to align the project knowledge templates, manifest/matchers, and agent config roots. Failed update checks are skipped silently and do not affect the current command; checks are disabled in `CI`, non-TTY sessions, or when `FLOW_SPEC_SKIP_UPDATE_CHECK=1` is set.

After `flow-spec init codex`, Codex projects include `.codex/hooks.json`, `.codex/hooks/fs-config-session.js`, and `.codex/hooks/fs-update-check.js`. On Codex `SessionStart` for `startup|resume`, the first script injects one configuration summary and the second checks the knowledge-base version automatically. When the hook is first generated or changed, trust it through `/hooks` in Codex. Set `updateCheck.enabled=false` in `flow-spec.config.json` to skip only the version check.

After `flow-spec init cursor`, Cursor projects include `.cursor/hooks.json` and `.cursor/hooks/fs-update-check.js`. The hook runs on Cursor `sessionStart` and injects upgrade reminders through `additional_context`. Set `updateCheck.enabled=false` in `flow-spec.config.json` to skip the check.

After `flow-spec init claude`, Claude projects include `.claude/settings.json`, `.claude/hooks/fs-config-session.js`, `.claude/hooks/fs-config-inject.js`, and `.claude/hooks/fs-update-check.js`: `SessionStart` injects the configuration summary and checks the knowledge-base version, while `PreToolUse Skill` only guards `fs-*` Skill calls. The version-check script injects an agent-instruction notice through `additional_context`, requiring the agent to relay the message verbatim to the user. The notice format is: "Current project `<project>` knowledge-base version v<current>, lower than latest package version v<latest>. Run the fs-kb-upgrade skill to align templates and routing." If today's cache still flags a needed upgrade, every new session re-injects the reminder; after a successful upgrade, `fs-kb-upgrade` clears `.flow-spec/update-check.json` so stale reminders disappear.

---

## 4. Agent Execution Configuration

Controlled via the project root `flow-spec.config.json`. For complete field rules, see [Commands Reference § 6) Sub-Agent Configuration](./commands-reference.md). **How each client is reminded to read the config, and why `Read` remains authoritative** — see **§ 1** (this § only explains **when** to toggle each switch).

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

Use `fs-req-plan` only when all `changeTracking` sub-fields are off and you still need a checklist (see § 3 footnote).

---

## 5. Customization Suggestions

- When customizing the "implement from technical design" logic for your project, prioritize adjusting **`fs-implement-tech-design`**: Cursor `.cursor/rules/fs-implement-tech-design.mdc`, Claude `.claude/rules/fs-implement-tech-design.md`; Codex uses `.codex/AGENTS.md` and associated `skills/` as the source of truth.
- Running `init` again by default only fills in missing templates and performs package-level structural alignment — it does **not** replace `fs-*` skills for maintaining business content. To reset `.flow-spec` from the template, add `--reset-knowledge`.

---

## 6. Skill Identification

Skills are triggered by matching `name` and `description`. Files are located under `config-root/skills/*/SKILL.md`.

---

## 7. Related Documents

- [flow-spec introduction](./flow-spec-introduction.md)
- [Commands Reference](./commands-reference.md)
- [Directory Conventions](./directory-conventions.md)
- [Architecture](./architecture.md)
- [Usage Scenarios](./usage-scenarios.md)
- [Project Milestones](./milestones.md)
