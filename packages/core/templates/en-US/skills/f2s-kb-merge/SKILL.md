---
name: f2s-kb-merge
description: Resolve editor-context conflicts after a Git merge; optionally accept conflict files; implementation-side conflicts are only summarized for user confirmation; triggers: 合并上下文冲突、f2s-kb-merge、merge context conflicts、resolve kb merge
---

## Orchestration (main / sub-agent)

- The meaning of `subAgent` / `switchAgentVerification` uses the unified entry as the only source of truth: **Cursor/Claude** read the configuration-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`). This skill does not repeat those definitions.
- **Sub-agent responsibility** (only when `subAgent=true`): perform only **conflict scanning + categorized comparison table**. Each entry contains five fields: `file` / `category` (document index / overview rule / module rule / skill / explanatory document / implementation / dependency metadata) / `ours_summary` / `theirs_summary` / `recommendation` (union / keep one side / merge mandatory items / needs user choice).
- **Sub-agents do not produce finished merged drafts**, to avoid forcing the main agent to rewrite them again.
- **Main-agent responsibility**: write files according to the strategy, make implementation-side decisions, and verify.
- By default, the writing side verifies its own work; this skill does not bind cross-agent verification.

# Resolve Context Merge Conflicts (f2s-kb-merge)

When `<<<<<<<` / `=======` / `>>>>>>>` appears after **rebase / merge**, first automatically merge files related to **AI and developer context** so indexes, rules, skills, and explanatory docs stay aligned. Conflicts involving executable implementation, deployment, or dependency declarations must **not** be merged without authorization; show the differences between both sides and wait for user confirmation before editing.

## Arguments (Optional)

- **No arguments**: search the workspace for files that still contain conflict markers, then classify and process them according to this skill (including a summary after the full scan).
- **With arguments**: the user may specify **one or more files that still contain conflicts** (via attached files or listed paths). The assistant **prioritizes only those files**. If any specified file falls into a "do not auto-merge" category, only list the differences and recommendation; **do not write changes without permission**. After the specified files are handled, you may ask whether the user wants an additional workspace scan.

## Applicable Scope (Auto-Merge Allowed)

Conflicts in the following **categories** are handled by this skill's **merge strategy** and do **not** require line-by-line confirmation unless the two sides are **mutually exclusive** and the correct result cannot be determined.

| Category | Description |
| --- | --- |
| Document index | Index-table files carrying "document <-> rule / skill" mappings |
| Project overview rule | Main entry files in the rules directory |
| Module rule | Other rule fragments in the same rule directory |
| Skill | SKILL documentation files under the skills directory |
| Context explanatory document | Markdown docs paired with rules and skills |
| Index-linked pure explanatory document | Conventionally stored docs that are referenced only by indexes or rules and **do not contain executable implementation semantics** |

## Auto-Merge Forbidden (User Confirmation Required)

The following conflicts **must not** be merged before the user makes an explicit choice:

- **Application or service implementation source code** (business logic, interface implementation, data access, etc.).
- Configuration that **changes externally exposed behavior** (routes, function registration, middleware chains, runtime entry points, etc.).
- **Dependency and build metadata** (dependency declarations, lockfiles, build and deployment scripts, etc.).
- **Implementation modules that centrally maintain external-resource inventories**: if the two sides have different **item sets or registration content**, this is a runtime-behavior difference. The user must confirm the kept scope; the assistant may recommend "union + dedupe", but writes only **after user approval**.

**Handling method**: list conflict files, briefly summarize each side's intent, provide a recommendation, and **ask the user to choose** before modifying files in the above scope.

## Merge Strategy (Context Files)

1. **Remove all** Git conflict markers (`<<<<<<<` / `=======` / `>>>>>>>`); none may remain.
2. **Index tables**
   - For **Rules / Skills / link columns** in the same index row: take the **union**, dedupe paths, and separate with spaces.
   - For **independent index rows** that appear only on one side: **keep** them after the merge to avoid losing entries.
3. **Overview rules**
   - Multiple bullets under the same topic should be merged into **one complete bullet or several parallel bullets**; do **not discard** constraints or references unique to either side.
4. **Tables in long documents**
   - Rows describing **different capability dimensions**: keep the **union**.
   - Duplicate rows describing **the same topic**: merge into **one** coherent row covering both sides' points.
5. **rules / skills**
   - Prefer wording that is **more specific and clearer in constraints**; merge any unique **must / must not** clauses from the other side to avoid rule regression.
6. **Links and paths**
   - Normalize to repository-resolvable relative paths, consistent with index entries in the overview rule.

## Execution Steps

1. **Determine scope**: if the user specified conflict files, use only those files; otherwise scan the full workspace for conflict markers (or combine with the IDE conflict list). Then classify according to **applicable scope**.
   - If sub-agent splitting is enabled, the sub-agent outputs the categorized comparison table using the schema `file` / `category` / `ours_summary` / `theirs_summary` / `recommendation`; the main agent takes over writing / decisions / verification.
2. **Context files**: edit and save directly using the merge strategy.
3. **Implementation files**: only output comparison summaries and recommendations; **do not modify files** until the user confirms.
4. **Output summary** (Markdown): resolved files + key points; pending files + differences + recommendations.
5. Confirm again that **processed files** contain **no** conflict markers. If a full scan was not performed, optionally ask whether to run an additional scan.

## Relationship to Related Commands

- **`/修正实现规则` (`f2s-kb-fix`)**: targeted correction and documentation/rule sync after the user has identified a problem.
- **This skill**: batch conflicts caused by a merge, focused on separating **editor context and explanatory docs** from **implementation-side** files.

## When to Use

- After merge / rebase, **rules / skills / indexes / paired explanatory docs** have conflicts (can handle all conflicts or only user-specified conflict files).
- You need to align "index <-> rule <-> skill <-> explanatory doc" in one pass while **avoiding accidental merges of implementation or deployment changes**.
