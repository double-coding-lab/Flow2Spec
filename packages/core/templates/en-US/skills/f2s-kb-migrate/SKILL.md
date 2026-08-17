---
name: f2s-kb-migrate
description: Migrate a legacy knowledge base to `.Knowledge` in one pass: use the configuration-root `docs-index.md` plus the unified rule entry (legacy `rules/main.md(c)` or current package `rules/f2s-flow2spec-unified-entry.md(c)`) as primary index clues; fully process business `rules/` and business `skills/` (excluding `f2s-*` package skills), and fully migrate `stock-docs`/`req-docs`; **after migration acceptance, must write** `.Knowledge/migration-report.md` (migration mapping table + proposed deletion path list); **closing must delete** migrated legacy `rules/`, migrated business `skills/`, and legacy `docs-index.md`/`index-doc.md`; the user only **reviews/revises the deletion list (exclusions)**; triggers: f2s-kb-migrate、知识库迁移、旧版迁移、knowledge-base migration、legacy migration
---

> Execution scope: this is an `f2s-*` skill workflow, not a CLI subcommand. Migration targets include:
> 1) Structure layer: `.Knowledge/topics`, `.Knowledge/index.md`, `.Knowledge/manifest-routing.json`, `.Knowledge/matchers/*.json`
> 2) Document layer: `.Knowledge/stock-docs`, `.Knowledge/req-docs`
>
> **Hard boundary**: `skills/f2s-*` (under each agent configuration root) are Flow2Spec package skills / execution-layer capabilities. They **must not** be written into `.Knowledge` (including `topics/stock-docs/req-docs`) and must not be used as sources for "business skill migration". They also **must not** be deleted in this workflow (version alignment is handled by `flow2spec init` / package upgrade).
>
> **Baseline rule keep-list (must not delete)**: `rules/f2s-flow2spec-unified-entry.md(c)`, `rules/f2s-implement-tech-design.md(c)`, `rules/f2s-stock-docs-vs-req-docs.md(c)`.

## Orchestration (main / sub-agent)

- The meaning of `subAgent` / `switchAgentVerification` uses the unified entry as the only source of truth: **Cursor/Claude** read the configuration-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`). This section does not repeat those definitions.
- **Sub-agent responsibility** (only when `subAgent=true`): under the main agent's given inventory, perform moving work and generate **draft fragments** for `migration-report.md`; all outputs are submitted as patches and merged/written by the main agent.
- **Main agent must control**:
  - `.Knowledge/.migrate-state.json` **write authority belongs to main** (state-machine source of truth; concurrent main/sub writes can misalign queues).
  - The **"Deletion execution record"** section of `migration-report.md` is always appended by the main agent.
  - **Deletion-list confirmation** and closed-loop cleanup must be completed by the main agent.
- **Write-authority hard rule**: `manifest-routing.json` / `.Knowledge/index.md` / `.Knowledge/.migrate-state.json` / the migration report "Deletion execution record" are always written by the main agent.
- By default, the writing side verifies its own work; this SKILL does not bind cross-agent verification.

# f2s-kb-migrate (Legacy Knowledge Base -> New Knowledge Base)

## Why this coexists with `f2s-kb-upgrade`

| Skill | Problem solved |
| --- | --- |
| **This skill `f2s-kb-migrate`** | **One-time structural move**: legacy indexes (`docs-index.md` / `index-doc.md`), `rules/main.md(c)`, business `skills/`, scattered `stock-docs`/`req-docs` -> **`.Knowledge`**, plus deletion list and `migration-report.md`. |
| **`f2s-kb-upgrade`** | **Knowledge-base template upgrade skill (the only "upgrade" meaning)**: execute the full **`skills/f2s-kb-upgrade/SKILL.md`** workflow. It runs **`flow2spec init`** inside the process to align **`manifest-routing` + `matchers/`** and each agent's **`rules`/`skills`**. It includes **V1 / current repository (V2+)** branching (legacy projects must **migrate first, then run this skill**; **V2+ includes npm v3.x and other projects already using `.Knowledge`**, see `f2s-kb-upgrade` step 0). |

- **After migration acceptance and deletion-list confirmation are complete**: remind the user to execute, or execute for them, the **full `f2s-kb-upgrade` skill** (whose **step 2** runs **`flow2spec init`**) to align the Flow2Spec package version, routing shards, and configuration-root artifacts to the current package. **Do not** let the user think that running `init` alone completes knowledge-base template upgrade.
- **Projects already stably using `.Knowledge` with no legacy-index burden**: do not run this skill again; daily package/template alignment uses **`f2s-kb-upgrade`** only (not just `init`).

**Why does each agent directory have a same-named `SKILL.md`?** Each tool reads only its own configuration-root `skills/`; `flow2spec init` **syncs** the current-language skill content into the selected agent directories.

## What This Command Does (External Wording)

Move the legacy "scattered configuration-root document index + rules + business skills + stock/req document trees" **as a whole into the new `.Knowledge`**, then perform **legacy entry and legacy business-artifact cleanup**, cutting over from the old knowledge-base organization.

Objects that must be covered:

1. **Index entry**: business docs and rule clues declared/mapped in configuration-root `docs-index.md` (compatible with `index-doc.md`).
2. **Rule entry**: the rule set declared/referenced in `rules/main.md` / `rules/main.mdc` (common legacy form) or `rules/f2s-flow2spec-unified-entry.md` / `rules/f2s-flow2spec-unified-entry.mdc` (compatible with historical `rules/flow2spec-unified-entry.md(c)`), plus other business rule files under `rules/`.
3. **Business skills**: business skill directories under each agent configuration-root `skills/`, excluding `f2s-*` (full inventory).
4. **Document trees**: legacy `stock-docs/`, `req-docs/` (or synonymous directories) fully migrated into the corresponding `.Knowledge` directories.

For objects **not covered by the index**:

- First output a candidate list (path + inferred reason: naming/directory/reference relationship).
- **By default, user confirmation is required** before including them in migration. Only when evidence is very strong (for example explicitly referenced by `rules/main` / `f2s-flow2spec-unified-entry`, or clearly referenced by an indexed document) may the Agent decide to include them, and the basis must be written in the migration summary.

Cleanup after migration (mandatory closing; only when migration has no failures and no pending confirmations; **`skills/f2s-*` are never deleted**):

- **Must execute**: delete migrated business rule files in legacy **`rules/`** (including `main.md(c)` if it is only a legacy entry), but **must not delete** the three `f2s-*` root rule files in the baseline keep-list.
- **Must execute**: delete migrated **business** subdirectories under legacy **`skills/`** (**excluding** `f2s-*`; if a directory still has unmigrated items, do not delete it until completed or removed from the list).
- **Must execute**: delete legacy entry **`docs-index.md`** (compatible with **`index-doc.md`**) to avoid dual entry points with `.Knowledge/index.md`.
- **Default optional deletion sub-list** (the user may exclude): legacy **`stock-docs/`** and **`req-docs/`** source directories, only when the corresponding document-layer migration has passed acceptance with no failures and no pending confirmations.

**Meaning of user confirmation (important)**:

- This is **not** asking "whether to clean up"; cleanup is part of the workflow.
- Instead, output the default-selected **"deletion path list"** (rule files one by one, business skill directories one by one, index filenames, and optional legacy document root directories) and ask the user to **review**. The user can only:
  - Reply "**确认清单**" to delete according to the current list; or
  - Reply "**排除：<路径…>**" to remove specified items from the list before deletion (removed items must be written to `.migrate-state.json` `notes[]` with reasons).
- If the user asks to **defer deleting a path**, keep that item in the list, end the cleanup round with `status=paused`, and **do not** pretend migration closure is complete.

## Applicable Scenarios

- The project still uses legacy knowledge organization (`docs-index.md` / `index-doc.md` + `rules/main.md(c)` or `rules/f2s-flow2spec-unified-entry.md(c)` (compatible with old `flow2spec-unified-entry.md(c)`) + business `skills/` + scattered `stock-docs`/`req-docs`).
- The user wants to migrate to the new `.Knowledge` format and confirm topic by topic to avoid one-shot large changes.
- The user needs **all req-docs / stock-docs** migrated into `.Knowledge` and wants to cut over from legacy knowledge-base directories/wording (paths, index, topic text unified to the new architecture).

## Input

- Optional inputs:
  - Legacy unified rule entry path: `rules/main.md` / `rules/main.mdc` and/or `rules/f2s-flow2spec-unified-entry.md` / `rules/f2s-flow2spec-unified-entry.mdc` (compatible with old `rules/flow2spec-unified-entry.md(c)`)
  - Legacy `index-doc.md` (or `docs-index.md`) path
  - Legacy stock document directory (for example `stock-docs/`, `docs/stock/`)
  - Legacy requirement document directory (for example `req-docs/`, `docs/req/`)
  - Migration scope (all topics / specified topics)
- If not provided, locate the above files in the repository first and ask the user to confirm.

## Resumable Migration State File (Required)

- State file path: `.Knowledge/.migrate-state.json`
- Purpose: record migration progress and support recovery after session interruption without migrating completed items again.
- Initialization timing: create immediately after the user confirms "start migration".
- Ending timing:
  - All migration complete and user confirms completion: delete the state file.
  - User actively says "stop": keep the state file for later recovery.
- `.migrate-state.json` is written only by the main agent; sub-agents submit patch fragments for the main agent to merge (write-authority hard rule).

Recommended fields (minimal set):

```json
{
  "version": "1",
  "status": "running",
  "currentStage": "inventory|orphans|topics|stock-docs|req-docs|cleanup",
  "topicQueue": [],
  "topicDone": [],
  "bizRuleQueue": [],
  "bizRuleDone": [],
  "bizSkillQueue": [],
  "bizSkillDone": [],
  "stockQueue": [],
  "stockDone": [],
  "reqQueue": [],
  "reqDone": [],
  "pendingManual": [],
  "failed": [],
  "notes": [],
  "updatedAt": "ISO-8601"
}
```

Update rules (required):

1. After completing each topic, business skill directory, business rule file, or document file, immediately write the state-file update.
2. When receiving "重试 <topic|file>", roll back that item's state before retrying.
3. When receiving "继续", read the state file first and continue from unfinished queues.
4. When receiving "停止", write `status=paused` and end this round.
5. When receiving a resume request, first show a state summary (current stage, remaining counts, failed/pending items) and wait for user confirmation to continue.

## Mandatory Flow (Phased Execution)

### Step 1: Read Legacy Mappings

1. Read `docs-index.md` (compatible with `index-doc.md`) and extract "business document -> rule/topic" mappings (**primary index**).
2. Read **`rules/main.md` (compatible with `main.mdc`)** or **`rules/f2s-flow2spec-unified-entry.md` (compatible with `f2s-flow2spec-unified-entry.mdc`; compatible with old `flow2spec-unified-entry.md(c)`)** (usually only one exists), and extract module/topic directory clues (**cross-check with the index**).
3. **Full inventory of business rule files**: scan files under `rules/` except the following, and build `bizRuleQueue` (deduped):
   - Unified entry: `main.md(c)`, `f2s-flow2spec-unified-entry.md(c)`, `flow2spec-unified-entry.md(c)` (compatible with old name)
   - Baseline keep: `f2s-implement-tech-design.md(c)`, `f2s-stock-docs-vs-req-docs.md(c)`
4. **Full inventory of business skills**: scan each agent configuration-root `skills/` directory; **exclude** `f2s-*`; all other directories enter `bizSkillQueue` (deduped).
5. Scan legacy `stock-docs` and `req-docs` candidate source directories if they exist.
6. Generate the migration inventory and show it to the user for confirmation:
   - Topic list (deduped, sorted)
   - Business rule file list (`bizRuleQueue`)
   - Business skill directory list (`bizSkillQueue`)
   - `stock-docs` file list
   - `req-docs` file list
7. Document classification rules (must be explicit):
   - Source path matches `stock-docs` (including synonyms such as `docs/stock`) -> migrate to `.Knowledge/stock-docs`
   - Source path matches `req-docs` (including synonyms such as `docs/req`) -> migrate to `.Knowledge/req-docs`
   - Unclassifiable files -> put into "manual confirmation list"; do not migrate before confirmation
8. Compute "out-of-index candidates" (`orphans`):
   - Files in `bizRuleQueue` not covered by `docs-index` / unified entry (`rules/main` or `f2s-flow2spec-unified-entry`)
   - Directories in `bizSkillQueue` not covered by index mappings
   - By default, require user confirmation for every item; only in high-confidence reference scenarios may the Agent include it autonomously, and the basis must be appended to state-file `notes[]` (without breaking JSON parseability).
9. After the user confirms the inventory, initialize the state file and write queues (inventory/orphans/topics/stock/req).

### Step 2: Migrate Topic by Topic (Structure-Layer Core)

For each topic, execute in this order:

1. Collect legacy materials for the topic:
   - Related `rules/*.md(c)` (business rules)
   - Related **business** `skills/<non-f2s-*>` (merge their content into the topic narrative/workflow; do not copy them as skill files under `.Knowledge`)
   - **Business document** paths in index mappings
   - **Must not** include any file under `skills/f2s-*`
2. Generate or update `.Knowledge/topics/<topic>.md`:
   - Body text uses the new architecture vocabulary (`.Knowledge` layering, `manifest` routing, `stock-docs`/`req-docs` responsibilities).
   - Remove legacy-only paths/terms (such as old `docs-index` root paths or scattered legacy directory names) and replace them with `.Knowledge/...` or stable paths relative to `.Knowledge`.
   - **Authoring-side guideline**: if this step generates/rewrites a topic or adjusts `topicMetadata` / `topicDependencies`, first Read the full `rules/f2s-topic-authoring.*` (**Cursor/Claude**: `rules/f2s-topic-authoring.mdc`; **Codex**: `.codex/topics/f2s-topic-authoring.md`) before writing.
3. Update the topic index row in `.Knowledge/index.md`, and maintain the "Associated documents (summary)" column (1-3 key `stock-docs/req-docs` **clickable Markdown links** per topic, format: `[title](relative path)`).
4. Update the routing manifest as needed:
   - `.Knowledge/manifest-routing.json`: `topicPaths`, `taskToTopicRules[]`, `topicDependencies`, `topicMetadata`, `fallbackTopic`
   - `.Knowledge/matchers/<matcherId>.json`: `includeAny` (consistent with `manifest-routing.taskToTopicRules[].matcherPath`)
5. Output this topic's migration summary and **pause**, prompting the user:
   - Reply "继续" to migrate the next topic
   - Or reply "停止" to stop this round
   - Or reply "重试 <topic>" to redo the current topic

> Before receiving "继续", do not migrate the next topic.
> After completing each topic, update the state file before waiting.

### Step 3: Migrate `stock-docs` (Document Layer)

After step 2 completes, execute:

1. Migrate into `.Knowledge/stock-docs/<relative-path>` according to "source-directory relative path"; do not flatten.
2. Default scenario is first migration from a legacy repo into the new knowledge base, so target paths are treated as "not existing".
3. After each file migration, output a result and pause, waiting for "继续 / 停止 / 重试 <文件>".
4. After all files complete, output a `stock-docs` sub-summary (success/failure/pending confirmation).

> Before receiving "继续", do not migrate the next file.
> After completing each file, update the state file before waiting.

### Step 4: Migrate `req-docs` (Document Layer)

After the `stock-docs` phase completes, execute:

1. Migrate into `.Knowledge/req-docs/<relative-path>` according to "source-directory relative path"; do not flatten.
2. Default scenario is first migration from a legacy repo into the new knowledge base, so target paths are treated as "not existing".
3. After each file migration, output a result and pause, waiting for "继续 / 停止 / 重试 <文件>".
4. After all files complete, output a `req-docs` sub-summary (success/failure/pending confirmation).

> Before receiving "继续", do not migrate the next file.
> After completing each file, update the state file before waiting.

### Step 5: Closing After All Migration Completes (Required: Migration Report + Deletion-List Confirmation)

When topic migration (step 2) and document-layer `stock-docs` / `req-docs` migration (steps 3-4) have **all passed acceptance** (no failures and no blocking pending confirmations, or pending items are separately listed in the report), execute the following substeps in order.

#### 5.0 Migration Report (Required: Write Project Markdown)

1. **Must** create or overwrite this file in the project repository: **`.Knowledge/migration-report.md`** (relative to project root; same repo as `.Knowledge`, convenient for review and traceability).
2. The report body must contain at least two major blocks (tables or nested lists are allowed; all paths use POSIX style relative to project root):
   - **"Migration mapping table"**:
     - **Topics**: each migrated `topic` -> legacy sources (corresponding `rules/*.md(c)`, business `skills/<dir>`, `docs-index` mapping-line summary) -> new path `.Knowledge/topics/<topic>.md`; also indicate whether `.Knowledge/index.md` / routing-manifest fields were modified.
     - **`stock-docs`**: every **source path -> `.Knowledge/stock-docs/...` target path** (include skipped files and reasons; write "none" if none).
     - **`req-docs`**: same as above.
   - **"Proposed deletion path list"**: exactly consistent with the **default-selected deletion list** shown to the user in step 5.2 (each file under `rules/`, each business `skills/` directory to delete, `docs-index`/`index-doc`, and optionally legacy `stock-docs/`/`req-docs/` roots). Prefer `- [ ] <path>` for each item so humans can review/check.
3. If the user later sends **"排除：<路径…>"** in step 5.2, update the same file **before physical deletion**: append or write in a "User exclusions" section the excluded paths and reasons, and sync the "Proposed deletion path list" checkbox state or list so the report on disk matches the final deletion set.
4. After physical deletion is executed according to the final list in step 5.2 step 3, append a **`## Deletion Execution Record`** section at the **end of the same file** (include execution time and actual deleted paths; for undeleted items, state reason and `status=paused`, etc.). Do not leave this only in the conversation.
5. The migration report "Deletion execution record" section is always appended by the main agent; sub-agents must not write it directly (write-authority hard rule).

> **Forbidden**: entering physical deletion or ending the migration closure before `.Knowledge/migration-report.md` is written.

#### 5.1 Overall Summary (In Conversation, May Match Report Summary)

- Migrated topic list
- New/updated `.Knowledge` files
- Migrated `stock-docs` files
- Migrated `req-docs` files
- Unmigrated or failed items

#### 5.2 Required Cleanup Phase (Deletion-List Confirmation; Must Not Skip)

1. Output the default-selected **"deletion path list"** (same source as the "Proposed deletion path list" in `migration-report.md`), including at least:
   - Every **business rule** file path under legacy **`rules/`** to delete (may include `main.md(c)`; **must not include** the baseline `f2s-*` root rules)
   - Every subdirectory path under legacy **business** `skills/` to delete (**excluding** `f2s-*`)
   - Legacy **`docs-index.md` / `index-doc.md`**
   - (Optional sub-list) legacy **`stock-docs/`** and **`req-docs/`** root directories, only when document migration has passed acceptance and no pending items remain; the user may exclude them.
2. Wait for the user to reply **"确认清单"** or **"排除：<路径…>"** to update the list. **Do not** ask a binary "whether to clean up" question.
3. Delete according to the **final list**; **do not** delete paths outside the list; **do not** delete **`skills/f2s-*`**.
4. After closing is complete, handle the state file:
   - Fully completed round: delete `.Knowledge/.migrate-state.json`
   - Paused/aborted round: keep `.Knowledge/.migrate-state.json` (`status=paused`) and record undeleted paths and reasons

## Output Summary Format (Recommended)

```markdown
## Topic Migration Complete: <topic>

### Sources
- rules: <legacy paths...>
- business docs: <document paths from index mappings...>
- mapping: <docs-index / index-doc row or document name>

### Written
- .Knowledge/topics/<topic>.md
- .Knowledge/index.md (updated <x> rows)
- .Knowledge/manifest-routing.json (updated fields: ...)
- .Knowledge/matchers/<id>.json (updated `includeAny`, etc.: ...)

### Next Step
- Reply "继续" to migrate the next topic
- Reply "停止" to stop migration
```

```markdown
## Document Migration Complete: <stock-docs|req-docs>/<file>

### Source
- source: <legacy path...>

### Written
- .Knowledge/<stock-docs|req-docs>/<relative-path>

### Next Step
- Reply "继续" to migrate the next file
- Reply "停止" to stop migration
```

## Constraints

- Must confirm topic by topic; do not skip confirmation and migrate everything in batch.
- `stock-docs` / `req-docs` must confirm file by file; do not batch-migrate without confirmation.
- Document migration must preserve source-directory relative paths; do not flatten to single-layer filenames.
- **`f2s-*` skills must not enter `.Knowledge` and must not be merged into topics during topic migration.**
- **Business** `skills/` (non-`f2s-*`) must be fully inventoried; out-of-index items require user confirmation by default before migration.
- Before all topics complete, do not delete legacy business `rules/` or old business `skills/` that are **non-`f2s-*`**; the baseline `f2s-*` root rule files are never deleted.
- Before document migration completes, do not delete legacy document directories.
- Before deleting legacy directories, complete **"deletion path list"** review (exclusions allowed); **do not** replace list confirmation with "whether to clean up".
- During migration, modify only `.Knowledge` and (after **final deletion-list** confirmation) deletion of old paths in the list; do not modify business code.
- Must maintain `.Knowledge/.migrate-state.json`; do not keep migration progress only in memory.
- After topic and document-layer migration acceptance, **first** write `.Knowledge/migration-report.md` (including migration mapping table and proposed deletion path list), then enter physical deletion; report and in-conversation deletion list must share a traceable source.
- `.migrate-state.json` / `migration-report.md` deletion execution record / `manifest-routing.json` / `.Knowledge/index.md` are always written by the main agent.

## Migration Report Template (Recommended Structure for `migration-report.md`)

The following skeleton may be copied and filled; all paths are relative to project root.

```markdown
# Knowledge-Base Migration Report

- **Generated at (ISO-8601)**: <...>
- **Configuration root (for example `.cursor/`)**: <...>

## Migration Mapping Table

### Topics (legacy sources -> new path)

| topic ID | legacy rules / legacy business skills / index clues | new path |
| --- | --- | --- |
| <id> | <...> | `.Knowledge/topics/<id>.md` |

### stock-docs (source -> target)

| source path | target path | note |
| --- | --- | --- |
| <...> | `.Knowledge/stock-docs/...` | success / skip reason |

### req-docs (source -> target)

| source path | target path | note |
| --- | --- | --- |
| <...> | `.Knowledge/req-docs/...` | success / skip reason |

## Proposed Deletion Path List (default selected; same as in-conversation list)

- [ ] `<path>` (each file under `rules/`)
- [ ] `<path>` (business `skills/<dir>`, excluding `f2s-*`)
- [ ] `.cursor/docs-index.md` (or actual path)
- [ ] (optional) legacy `stock-docs/` / `req-docs/` root directories

## User Exclusions (if any)

- (write "none" if none)

## Failed or Unmigrated Items (if any)

- (write "none" if none)

## Deletion Execution Record

(Append only after physical deletion: time, deleted list, undeleted items and reasons)
```

## Completion Self-Check

1. Topic count aligns with the legacy mapping count (unless the user explicitly skipped items).
2. Every `manifest.topics[].path` exists.
3. `index` can locate every migrated topic.
4. `topicMetadata` only references topicIds that exist in `topicPaths`; `primary` / `tags` / `confidence` are valid.
5. `.Knowledge/stock-docs` and `.Knowledge/req-docs` match the confirmed migration lists.
6. Manual confirmation list is empty; if not, deleting legacy document directories is forbidden.
7. Legacy business `rules/`, old business `skills/` that are **non-`f2s-*`**, legacy indexes, and legacy document directories (if listed) were deleted according to the **final deletion list**; the three `f2s-*` root rules in the baseline keep-list are still kept.
8. Legacy entries `docs-index.md` / `index-doc.md` and `rules/main.md(c)` were deleted according to the list (and `.Knowledge` can replace their responsibilities), or explicitly kept due to user exclusion and written to `notes[]`.
9. State file matches migration result (delete if complete; keep with `status=paused` if paused).
10. `.Knowledge/index.md` has synced the "Associated documents (summary)" column for every topic (may write "none", but not blank).
11. `skills/f2s-*` were not accidentally deleted and were not written into `.Knowledge`.
12. `.Knowledge/migration-report.md` is written and contains the **migration mapping table** and **proposed deletion path list**; if deletion was executed, **`## Deletion Execution Record`** was appended and matches actual disk state.
13. State-machine file and deletion execution record were not written by sub-agents without authority; manifest / index were written by the main agent only.
