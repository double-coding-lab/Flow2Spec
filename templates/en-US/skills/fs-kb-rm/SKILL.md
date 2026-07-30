---
name: fs-kb-rm
description: Remove the knowledge topics and index mappings associated with a stock-docs document; triggers: 删除项目上下文、fs-kb-rm、remove project context、delete knowledge context
---

> Execution scope: only maintain `.flow-spec`; do not modify the configuration-root `rules/skills`.

## Orchestration (main / sub-agent)

- The meaning of `subAgent` / `switchAgentVerification` uses the unified entry as the only source of truth: **Cursor/Claude** read the configuration-root `rules/fs-flow-spec-unified-entry.*`; **Codex** reads `.codex/fs-rules/fs-flow-spec-unified-entry.md` (same source, mirrored by `flow-spec init`). Do not repeat those definitions here.
- By default, the main agent completes the full workflow (single-point deletion has low benefit from sub-agent splitting).
- Split threshold: only when `subAgent=true` and **one batch deletes >= 5 topics** may deletion and reference cleanup be delegated to sub-agents.
- Main agent must control scope confirmation and `fallbackTopic` reassignment.
- Write-authority hard rule: `manifest-routing.json` and `.flow-spec/index.md` are always written by the main agent.
- Verification: by default, the writing side verifies its own work; this SKILL does not bind cross-agent verification.

# Delete the Project Context Associated with a Document

## Input

- One argument: a `.flow-spec/stock-docs/<filename>.md` path, or a filename fragment that can match one.

## Procedure

1. Read `.flow-spec/index.md` and match topics associated with the target document.
2. Delete the corresponding `.flow-spec/topics/<topic>.md` files.
3. Remove the matching entries from `.flow-spec/index.md` and write it back.
4. Update the routing manifest:
   - `.flow-spec/manifest-routing.json`: remove invalid `topicPaths`, `taskToTopicRules`, `topicDependencies`, and `topicMetadata` references.
   - The corresponding `matchers/<matcherId>.json`: remove invalid rules or `includeAny` terms aligned with the deleted `task` / `matcherId`.
   - If the deleted topic was `fallbackTopic`, a new fallback topic must be specified.
   - **Authoring-side guideline**: this step adjusts `topicDependencies` (deleted depended-on topics or orphan edges), so first Read the full `rules/fs-topic-authoring.*` (**Cursor/Claude**: `rules/fs-topic-authoring.mdc`; **Codex**: `.codex/fs-rules/fs-topic-authoring.md`) and verify DAG and minimization constraints before writing.

## Output Summary (Required)

- List of deleted topic files.
- Entries removed from `.flow-spec/index.md`.
- Fields adjusted in the routing manifest.
- Items not executed, if any.

## Complex Scenario Example

The user provides the filename fragment "回调", and it matches 2 topic documents.

- First list the two candidates and ask the user to confirm the deletion scope to avoid accidental deletion.
- After deletion, clean up invalid routing-manifest references; if the deleted topic was `fallbackTopic`, specify a new fallback topic before writing.
- In the final summary, state which topics were deleted, which topics were kept, and why.

## Constraints

- Ask the user to confirm when the match is ambiguous.
- Delete only matched topics; do not affect other topics.
- `manifest-routing.json` and `.flow-spec/index.md` are always written by the main agent (write-authority hard rule); scope confirmation and `fallbackTopic` reassignment must not be delegated to sub-agents.

## Completion Self-Check

1. The deleted topic is no longer referenced by `manifest` (must be false).
2. `index` no longer contains invalid topic paths (must be false).
3. `topicMetadata` no longer references deleted topics (must be false).
4. `fallbackTopic` is still valid.
5. No sub-agent split was forced below the threshold (< 5 topics); manifest / index were written by the main agent only.
