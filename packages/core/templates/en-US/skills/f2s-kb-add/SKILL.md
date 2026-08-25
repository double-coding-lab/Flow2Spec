---
name: f2s-kb-add
description: Parse already implemented capabilities into the knowledge base during work (multi-file aggregation): draft -> final draft -> topics/index/manifest; triggers: f2s-kb-add、已有能力进知识库、多文件生成上下文、add existing capability to knowledge base、multi-file context generation
---

> Execution scope: this skill only maintains `.Knowledge`; it does not modify the configuration-root `rules/skills`.

## Orchestration (main / sub-agent)

- The meaning of `subAgent` / `switchAgentVerification` uses the unified entry as the only source of truth: **Cursor/Claude** read the configuration-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`).
- Do not split by default: the main session completes the full workflow; below the threshold, sub-agent benefit is lower than context-switching cost.
- Split threshold (only when `subAgent=true` and any condition is met): (1) input paths >= 5; (2) a single source file > ~3000 lines; (3) total across paths > ~10000 lines.
- **Split strategy (enabled only when the split threshold is reached and `subAgent=true`)**:
  - **Mode B (default, single-round parallel)**: main first produces an "inventory" (source document path list to parse + core capability names, handwritten by main; sub-agents may not add/remove paths) + "scan contract" (which sections/line ranges to read for each source, forbidden scan directories, unified output fields and table headers) -> sub-agents read only and fill the table in parallel -> main merges + dedupes in one round -> writes `.Knowledge/stock-docs/<design-name>_draft.md` -> main performs user confirmation and acceptance. Suitable when source boundaries are clear, scale is medium, and a first version is needed quickly.
  - **Mode C (large repository / high risk, multi-round correction)**: before B or replacing B's first round, main creates the inventory -> sub-agents submit tables -> main performs one dedicated **table comparison** round (mark overlaps / conflicts / missing dependencies / cross-source boundaries) -> if needed, assign small follow-up tasks for conflicts or main reads key points directly -> main writes / finalizes. Suitable for multi-workspace / monorepo, very deep directories, source paths > 20, first-round sub-agent tables with obvious conflicts or holes, or severe overlap/conflict among sources.
  - **Switch criteria** (switch to C if any is true): multi-workspace / monorepo; very deep directories or source paths > 20; first-round sub-agent tables have obvious conflicts / holes; source narratives overlap / conflict severely.
- **Sub-agent delivery hard rule**: sub-agents may not trim the source path scope on their own; they must follow the handwritten main inventory. Delivery must use the "sub-agent YAML schema" (fields: `source` / `scope` / `capabilities` / `cross_refs` / `pending`); prose replies are forbidden. Sub-agents must not write `manifest-routing.json` / `.Knowledge/index.md`, and must not independently announce "added to knowledge base".
- Main agent must control overlap judgment, final-draft finalization, `f2s-kb-build` dispatch, and overall acceptance.
- Write-authority hard rule: `manifest-routing.json` and `.Knowledge/index.md` are always written by the main agent.
- The writing side verifies its own work.

# f2s-kb-add: Multi-File Aggregation -> Draft -> Final Draft -> Knowledge Routing Sync

## When to Use

- A capability has already been implemented in code, but information is scattered across multiple files and needs to be captured as searchable knowledge.
- Different from `f2s-doc-arch`: `doc-arch` produces an architecture draft; `doc-add` produces the knowledge-capture chain for an "already implemented capability".

## Input

| Parameter | Required | Description |
| --- | --- | --- |
| File path list | Yes | One or more paths (space/newline/`@`); supports source code, config, and docs |
| Plan name | No | Used to generate `<design-name>_draft.md` and `<design-name>_final.md` |
| Draft/final path | No | Defaults to `.Knowledge/stock-docs/` |

Abort and ask the user for valid paths if no valid path is provided.

## Step 0: Overlap Check (Important)

Before execution, compare against:

- `.Knowledge/index.md`
- `.Knowledge/topics/*.md`
- `.Knowledge/stock-docs/*.md`

If the same topic has already been captured, update it in place first to avoid duplicate topics and duplicate index rows.

## Step 0.5: Multi-Module Detection (Required when input paths >= 2)

1. **Directory aggregation**: group files by functional-layer directories in paths (for example `src/<module-name>/`, top-level directory names).
2. **Judgment rules** (any one hit means "multi-module"):
   - Files belong to >= 2 different top-level functional directories (for example `auth/`, `payment/`).
   - The user explicitly mentions "multiple features / different modules / handle separately" or similar.
   - Filename prefixes are clearly different and have no common parent directory.
3. **Single module (no trigger)**: do not interrupt; continue to step 1 and generate `<design-name>_draft.md` using the existing single-output logic.
4. **Multi-module (triggered)**: **pause**, show the grouping result to the user, and ask:
   - **Option A (recommended)**: generate knowledge files by module -> each group independently runs steps 1 -> 2 -> 3 -> 4 and outputs `<module-name>_draft.md` / `<module-name>_final.md`.
   - **Option B (merge)**: ignore module boundaries and generate one `<design-name>_draft.md` (original behavior).
   - It is **forbidden** to default to option B and continue before the user explicitly chooses.
5. **Single module but large stock-doc**: if one input document or aggregated source exceeds **300-500 lines**, or covers **more than 3 unrelated responsibility domains**, suggest to the user that it can be split into multiple focused stock-docs, each corresponding to an independent topic. If the user confirms continuing, do not block, but record "recommended later split" in the output summary.

## Step 1: Moderate-Depth Analysis

- Read small files fully.
- For large files, prioritize structure and key fragments (exports, interfaces, config, flows).
- Mark uncertain content explicitly as "pending confirmation"; do not invent.
- If any split threshold is met (input paths >= 5 / single source > ~3000 lines / total across paths > ~10000 lines) and `subAgent=true`, split into parallel read-only scans using Mode B (default) or Mode C (when switch criteria are met); otherwise the main agent performs the full workflow. **When sub-agents are enabled, they must follow the main agent's handwritten inventory and scan contract; they must not add/remove source paths on their own.**

## Step 2: Generate Draft

- Default output: `.Knowledge/stock-docs/<design-name>_draft.md`
- Recommended draft structure:
  - Overview
  - Source list (including unreadable files)
  - Module-by-module summary
  - Cross relationships
  - Pending confirmations

## Step 3: Generate Final Draft

- Reference `.Knowledge/template/final-overview-template.md`
- Output: `.Knowledge/stock-docs/<design-name>_final.md`
- **Must fill the `## 来源文件` section**, listing the original source file paths actually read in step 1.
- If the user asks to "review the draft first", stop at the draft and wait for confirmation.

## Step 4: Sync Knowledge Routing

Based on the final draft, use the `f2s-kb-build` approach to update:

- `.Knowledge/topics/`
- `.Knowledge/index.md`
- Routing manifest (when needed)
- `manifest-routing.json.topicMetadata` (as needed): write `primary` / `tags` / `confidence` only for topicIds that already exist or are confirmed as created in this run; `tags` may be omitted and must not duplicate `primary`. Classification is only for governance, audit, and reading expectations; it does not participate in routing or execution requirements. If evidence is insufficient, do not write metadata and list it as pending confirmation in the summary. Do not create, rename, or split topics solely for classification.

> **Authoring-side guideline**: this step triggers adding/modifying topics and `topicDependencies`, so first Read the full `rules/f2s-topic-authoring.*` (**Cursor/Claude**: `rules/f2s-topic-authoring.mdc`; **Codex**: `.codex/topics/f2s-topic-authoring.md`) before invoking the `f2s-kb-build` approach to sync.

## Output Summary (Required)

1. Draft/final-draft paths.
2. Updated topic/index/routing-manifest paths.
3. Incomplete items and reasons (for example invalid paths or insufficient information).

## Complex Scenario Examples

The user provides 6 files (mixed code, config, old docs), and 2 paths are unreadable.

- Continue processing readable files first, and explicitly list unreadable paths and gaps in the draft. Do not abort the whole flow because of partial failure.
- If an existing `.Knowledge/stock-docs/<capability-name>_final.md` is found, revise that final draft first instead of creating a duplicate final draft.
- If the user asks to "review the draft first", stop at the draft, wait for confirmation, then generate the final draft and enter `f2s-kb-build` sync.

The user provides 3 files: `src/auth/login.ts`, `src/payment/checkout.ts`, `src/notification/email.ts`.

- Step 0.5 detects that the files belong to `auth/`, `payment/`, and `notification/`, three different top-level functional directories, and classifies this as "multi-module".
- Show the grouping to the user: `auth` group 1 file, `payment` group 1 file, `notification` group 1 file; ask for option A (separate generation) or option B (merge).
- User chooses option A: run steps 1 -> 2 -> 3 -> 4 for the `auth`, `payment`, and `notification` groups separately, outputting `auth_draft.md`, `payment_draft.md`, and `notification_draft.md`.
- It is **forbidden** to directly merge the three modules into `综合_draft.md` before the user chooses.

## Constraints

- Final-draft `sourceDoc` only points to `.Knowledge/stock-docs/*`.
- Do not modify the configuration-root `rules/skills`.
- Prefer updating the same topic; do not create duplicate parallel knowledge.
- `manifest-routing.json` and `.Knowledge/index.md` are always written by the main agent (write-authority hard rule); sub-agents must not touch them.

## Completion Self-Check

1. Draft/final-draft paths are under `.Knowledge/stock-docs/`.
2. Duplicate creation for the same topic was avoided.
3. topic/index/manifest semantics are consistent with the final draft.
4. If `topicMetadata` was written: it only covers topicIds that already existed or were created in this run; `primary` / `tags` / `confidence` are valid; type-prefix naming and renaming were avoided.
5. When input paths >= 2, step 0.5 multi-module detection was performed; if classified as multi-module, grouping was shown to the user and an explicit choice was awaited, with no default merged output.
