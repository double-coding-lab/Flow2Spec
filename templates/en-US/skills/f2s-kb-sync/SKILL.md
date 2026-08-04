---
name: f2s-kb-sync
description: Accept an explicit capability list or infer from zero input; first output a knowledge-base update outline, then write topics/index/manifest after confirmation; triggers: f2s-kb-sync、全局同步、知识库同步、已实现能力、global sync、sync knowledge base、implemented capability
---

> Execution scope: this skill only maintains `.Knowledge`; by default it does not modify the configuration-root `rules/skills`.

## KB Auto-Merge Protocol (Required)

This skill must not make manual command execution part of the user flow. After the user confirms the sync outline, the agent performs knowledge candidate generation, merge planning, build, and validation by itself:

1. Convert the confirmed outline into one or more `kb-delta` drafts with `taskId`, `developerId`, `baseRevisions`, `changes`, and evidence summary. If there is no explicit task directory, an equivalent in-memory object is acceptable; do not create `.task` only for this skill. `changes` may use `appendBody` / `replaceBody` / `updateFrontmatter`; when a new topic is needed, use `createTopic` and optionally include `taskRule` plus `matcher` so routing is connected in the same merge.
2. Before writing `.Knowledge`, run `flow2spec kb plan <delta>` or the equivalent internal capability. If a topic revision differs, stop automatic writing and switch to semantic-merge reporting.
3. When the change is auto-mergeable, run `flow2spec kb apply <delta>` or the equivalent internal capability, then run `flow2spec kb build` and `flow2spec kb check`.
4. The user should only see "knowledge base synced / semantic conflict needs confirmation / skipped with reason"; do not ask the user to manually run `kb plan/apply/build/check`.

## Orchestration (main / sub-agent)

- The meaning of `subAgent` / `switchAgentVerification` uses the unified entry as the only source of truth: **Cursor/Claude** read the configuration-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`).
- Step 1 (material collection): when `subAgent=true`, read-only collection may be split across sub-agents; they must not write files.
- Step 2 (outline + user confirmation): must be completed by the main agent; confirmation authority must not be delegated.
- Step 3 (write): when `subAgent=true`, writing may be split by confirmed outline item. Hard rule: before a sub-agent writes, it must load the opening summaries of 2-3 neighboring topics to align narrative style.
- Write-authority hard rule: `manifest-routing.json` and `.Knowledge/index.md` are always written at a single point by the main agent; delegation is forbidden.
- Verification: by default, the writing side verifies its own work; this SKILL does not bind cross-agent verification.

# f2s-kb-sync (Outline First, Then Write)

## Input (Optional)

1. The user explicitly provides an "implemented capability list".
2. Zero input: the Agent infers from current context.
3. Supporting materials: `@` files, requirement documents, architecture notes, etc.

## Mandatory Flow (Order Must Not Be Reversed)

### Step 1: Collect Materials (Read-Only)

- Summarize the user's target, scope, and priority.
- Summarize implemented capabilities (user-specified + Agent-inferred).
- Compare against the existing knowledge base:
  - `.Knowledge/topics/`
  - `.Knowledge/index.md`
  - `.Knowledge/manifest-routing.json`
  - `.Knowledge/matchers/*.json` (the shards corresponding to routing `matcherPath`)
  - `.Knowledge/stock-docs/`
- **Topic-granularity scan**: roughly scan existing topics for the following signals. If hit, list them as "recommended split" in the step 2 outline (does not block the sync flow):
  - The corresponding stock-doc exceeds **300-500 lines**.
  - `includeAny` has more than **12 terms**.
  - The topic body contains second-level headings covering more than **3 unrelated responsibility domains**.

### Step 2: Output the "Update Outline" (Required)

The outline must include at least:

1. Sync goal.
2. Capability list (user-specified / Agent-inferred / merged result).
3. Information sources.
4. Proposed file-change list (exact paths).
5. Topic sync plan: for each capability, state whether it updates an existing topic or creates a new topic, and list topicId, topic file, index row, and manifest/matcher changes. If `topicMetadata` is involved, list candidate `primary` / `tags` / `confidence` and evidence; if evidence is unclear, write "do not classify / do not write for now".
6. **Stock-doc consolidation plan (hard rule)**: For every topic being "created / updated", check whether its "Detailed background / Related materials / Long-form source / Reference documents" reference slot already has a corresponding `.Knowledge/stock-docs/*_终稿.md`:
   - **Exists** → reference it directly;
   - **Missing but the capability being synced is already implemented in code** → the outline **must list** "generate `stock-docs/<capability>_终稿.md`", noting the consolidation sources (the matching `req-docs/*_技术方案.md` + implemented code + clarification doc). Before step 3, this SKILL first triggers `f2s-doc-final` to consolidate (or waits for user confirmation to hand-write), **then** points the topic to the stock-doc;
   - **Capability is still at the req-docs stage without code** → the topic's "Long-form background" section writes a placeholder "to be generated by `f2s-doc-final` after the code lands". **Do not** list `req-docs/*` in this slot.
   - Basis: see `rules/f2s-topic-authoring.*` "Directory boundary for long-form background references (hard rule)".
7. Out-of-scope items.
8. Prompt to wait for user confirmation.

> Before confirmation, writing any changes is forbidden.

### Step 2.5: Consolidate Stock-Docs (If Step 2 Listed Any)

After the user confirms the outline and before any `.Knowledge/topics/` write, **consolidate each `stock-docs/*_终稿.md`** listed in outline item 6:

- Prefer entering **`f2s-doc-final`** directly (within the same session; no re-trigger needed);
- Or hand-write per `.Knowledge/template/` (if a final-draft template exists) and save it;
- Only after the stock-doc is written and its path is known, enter step 3 and point the topic's "Long-form background" section at that stock-doc.

**Prohibited**: skipping this step and writing a topic whose "Long-form background / Related materials" slot lists `req-docs/*` files.

### Step 3: Write After Confirmation

> Hard rule: if sub-agent splitting is enabled, a sub-agent must read the opening summaries of 2-3 neighboring topics before writing to align narrative style; `manifest-routing.json` and `.Knowledge/index.md` are written at a single point by the main agent, and sub-agents have no write authority for them.
>
> **Authoring-side guideline**: if this step adds or modifies topics, `topicMetadata`, or `topicDependencies`, first Read the full `rules/f2s-topic-authoring.*` (**Cursor/Claude**: `rules/f2s-topic-authoring.mdc`; **Codex**: `.codex/topics/f2s-topic-authoring.md`) before writing.

Update according to the outline, item by item:

- `.Knowledge/topics/*.md`
- `.Knowledge/index.md` (sync the "Associated documents (summary)" column in the topic routing table)
- Routing manifest (as needed). When creating a new topic, also sync `topicPaths` and necessary `taskToTopicRules` / matcher shards. Write `topicMetadata` only when evidence is clear; classification is only for governance, audit, and reading expectations, does not participate in route matching or execution requirements, and must not be used to create, rename, or split topics.
- `.Knowledge/stock-docs/*.md` (add source documents as needed)

### Step 4: Closing Summary

- List modified paths and purpose.
- List skipped items and reasons.

### Step 5: Write Sync Timestamp (Required; f2s-git-commit depends on it)

After this skill successfully writes to disk (Step 3 actually modified files), the main agent writes `.Knowledge/.last-sync.json`:

```json
{
  "syncedAt": "<ISO 8601 timestamp, e.g. 2026-08-04T10:30:00.000Z>",
  "skill": "f2s-kb-sync",
  "developerId": "<developerId per f2s-task rules; omit for legacy>"
}
```

- `f2s-git-commit` reads this file before its **default coverage check**; if `syncedAt` is within 30 min, it skips coverage to avoid double-syncing what was just synced.
- **When to write**: only when this turn actually wrote to disk (Step 3 modified topic / index / manifest / stock-docs). A pure "read the KB, nothing changed" pass **does not** write.
- Overwrite, do not append history.
- If writing fails (read-only disk, insufficient permission), do not block the main flow; add a warning line to the closing summary.
- Peer knowledge-base-writing skills (`f2s-kb-feat` / `f2s-kb-fix` / `f2s-kb-add` / `f2s-kb-addRules` / `f2s-kb-distill`) follow the same convention on successful write, with `skill` set to their own id.

## Output Summary Format (Recommended)

```markdown
## Knowledge-Base Sync Result

### Confirmed Capability Scope
- <capability 1>
- <capability 2>

### Modified Files
- .Knowledge/topics/<topic>.md: <change description>
- .Knowledge/index.md: <change description>
- .Knowledge/manifest-routing.json: <change description or "unchanged">
- .Knowledge/matchers/<id>.json: <change description or "unchanged">
- .Knowledge/stock-docs/<doc>.md: <change description or "unchanged">

### Skipped Items
- <item>: <reason>
```

## Complex Scenario Example

The user only says "/f2s-kb-sync sync it" and provides no capability list.

- Step 1 first makes a minimal inference (for example, identify 1-2 capability domains from `git diff` / directory names), and provides the evidence.
- Step 2 must output an outline and wait for "confirm"; before confirmation, writing any `.Knowledge` file is forbidden.
- After confirmation, execute only items in the outline. If the user narrows the scope mid-flow, record skipped items in the closing summary.

## Constraints

- Outline first, write second.
- Add in small increments; avoid whole-file rewrites.
- Prefer in-place updates for the same topic.
- Each topic in `index.md` needs summary-level **clickable Markdown links** to `stock-docs/req-docs` (format: `[title](relative path)`, 1-3 links; "none" is allowed).
- Do not modify the configuration-root `rules/skills`.

## Completion Self-Check

1. No writes happened before confirmation (must be false).
2. Topic files and index rows correspond one-to-one, and the "Associated documents (summary)" column has been updated.
3. `topics` / `taskToTopicRules` / `topicDependencies` in manifest still reference valid paths.
4. If `topicMetadata` was written: every key exists in `topicPaths`; `primary` / `tags` / `confidence` are valid; type-prefix naming was avoided.
5. The configuration-root `rules/skills` was not modified (must be false).
6. The step 2 outline + user confirmation were not delegated to a sub-agent; before step 3 sub-agent writes, 2-3 neighboring topic summaries were loaded; manifest / index were written by the main agent only.
7. **For every topic created or updated**, its "Long-form background / Detailed materials / Related materials / Long-form source / Reference documents" reference slot **points only at `.Knowledge/stock-docs/*_终稿.md`** (or a finalized stock-doc); it **must not** list `.Knowledge/req-docs/*` files as the long-form source of truth. If the code has landed but the corresponding stock-doc is missing, step 2.5 consolidation must have been completed.
