---
description: Even ordinary questions must first read the .Knowledge machine-readable routing before searching code; hard constraint on the first tool call
alwaysApply: true
---

# Flow2Spec KB Preflight

This rule coexists with `f2s-flow2spec-unified-entry`; for answers involving implementation, configuration, troubleshooting, or Flow2Spec knowledge routing **inside the current repository**, this rule determines **when the on-disk knowledge base must be read first**. The read order in the unified entry continues to apply after this rule has been satisfied.

## Scope (Preflight Required)

If the user question may depend on any of the following information, it counts as requiring knowledge-base preflight:

- **Implementation code** in the current repository, directory and module conventions, build/deploy/runtime behavior, `.Knowledge/`, `f2s-*` skills, topic routing described by `manifest-routing`, and similar repository facts;
- Context that clearly depends on current-repository facts, unless the user explicitly states it is unrelated to the current repository.

## Hard Constraint: First Tool Call

Before giving a substantive conclusion or modification suggestion:

1. **For this user message**, if no tool has yet read **`.Knowledge/manifest-routing.json`**, then the **first** code/knowledge-base tool used must be:

   `Read` -> path **`.Knowledge/manifest-routing.json`** (relative to the project root, consistent with the unified entry).

2. After reading the manifest, `Read` a **single** matcher shard and **`.Knowledge/topics/<topic>.md`** (plus `topicDependencies`) **as needed** according to `taskToTopicRules` / `matcherPath`. Only then may `SemanticSearch`, `Grep`, or `Read` be used on business source paths **outside `.Knowledge/`**.

3. **Prohibited**: without step 1, directly asserting repository-specific paths, configuration, or behavior from memory/training data. If the manifest or topic already covers the point, **the KB is authoritative**; source code may verify or fill in details missing from the KB.

4. **At the end of the answer (one short line is enough)**: state the KB paths used this turn, for example "Read manifest + `topics/<topic>.md`". If the manifest did not match and the `fallbackTopic` topic was read, state that fallback triage was used.

## Rare Cases Where Preflight Can Be Skipped

- The user only asks about **IDE/editor usage itself**, unrelated to the current repository directory;
- The user provides an **absolute path + explicit instruction** (for example "only change this line to x") and the edit is purely mechanical and unrelated to business knowledge;
- In the **same session**, `.Knowledge/manifest-routing.json` has already been read for the current workspace and the user has not requested "reroute / full check"; for a direct follow-up, the answer may begin with "manifest was read earlier in this session; continuing with the previous route" and avoid reading the manifest again.

## Answer Closing Check (After Source-Code Follow-Up)

Knowledge-base follow-up suggestions after ordinary Q&A reads business source code are governed solely by **`f2s-kb-feedback-closing`**. This rule only keeps the trigger relationship: after reading the first business source file, treat this turn as having triggered `sourceFallbackUsed=true`; if the final answer cites source-code facts, the four-case self-check in `f2s-kb-feedback-closing` must run before sending the answer. If this turn has already entered an `f2s-*` skill, `implement-tech-design`, `f2s-git-commit`, or another existing follow-up flow, do not repeat the suggestion.

Consistent with **"Knowledge gaps and responses"** in **`f2s-flow2spec-unified-entry`**, when case **1b (matched but context is insufficient)** or **2 (the KB has no corresponding document)** is reached, also obey:

1. **Explain to the user before expanding tools**: after reading `manifest-routing.json` and the required `topics/*.md` (plus dependency topics), if the KB alone still cannot answer the user question precisely, **first** state in natural language: **which KB paths were read**, **what information is still missing**, and **which 1-2 source files you plan to read** or **which `req-docs`/stock-docs document the user should provide**. Do not silently stack "find another entry point" style exploration.
2. **Exploration limit**: before giving the gap note above, do **not** launch **4 or more consecutive** `Grep` calls or targetless `SemanticSearch` calls whose only purpose is broadening the search surface. After the note is given and the user tacitly allows it (or the question explicitly asks to chase it down), drill down in an orderly way.
3. **Prefer single-point drilling**: if only behavior details need confirmation, prefer to **Read one** implementation file most relevant to the question and answer from it. Do not chain into multiple files under third-party dependency directories for the same subquestion without a new hypothesis, unless the user explicitly asks to read dependencies thoroughly.

### Gap Gate (For "Rule Exists, Execution Skipped")

Only when **manifest + required topics** have already been read, the situation is still judged as **1b / 2**, and the **next step** is to use `Read` / `Grep` / `SemanticSearch` against the **business source tree** (not `.Knowledge/`):

- **First output** a piece of **visible natural language for the end user** (it may be shown with a brief conclusion) that includes at least: **(a)** KB paths read; **(b)** one sentence describing the gap (what kind of information the topic lacks or that the KB has no document); **(c)** the **1-2 concrete file paths** to open next, or a question asking whether the user would rather add `req-docs`/stock-docs first.
- **Prohibited**: if no visible note satisfying (a)(b)(c) has ever been output, do not launch multiple source-side tool calls used only to "find another entry point"; this is exactly the execution-level omission where "the rule says it, but the gap note was skipped."
- When source drilling later reports facts such as **behavior, status codes, or error text**, those facts **must come from source code and contracts actually read in this turn**; do not fill them from speculation or external project experience unrelated to the current repository.

The (a)(b)(c) requirements above have the same meaning as "ask the user for a document or path" and "explicitly acknowledge no KB coverage" in the **`f2s-flow2spec-unified-entry`** table. Do not substitute an internal judgment of "this is 1b" for a **written visible gap note** to the user.

### Interaction With Execution Environments (Permissions and Confirmation Noise)

In IDEs with sandbox or permission gates, launching many `Grep` / `SemanticSearch` / broad file reads in a short time often appears as repeated prompts for the same kind of permission or confirmation. This is not directly caused by whether Flow2Spec rules mention the constraint; it is usually amplified by an exploration chain that is too long and lacks stop conditions. Following this section's "gap gate", "exploration limit", and the "search volume and answer rhythm" below, while preferring single-file `Read`, can substantially reduce such interruptions.

## Search Volume and Answer Rhythm (Reduce Multi-Round Scans and Perceived Slowness)

This section targets common causes in **Codex / terminal IDE** environments where a single Q&A turn performs multiple rounds of `grep`, produces huge output, and takes a long time. It does **not conflict** with "read manifest first": still `Read` the manifest first, then narrow the search surface.

1. **`Grep` / text-search scope**: when the matched topic has already been read and gives a **specific file or directory path**, the search scope must not exceed that path. If no path is given, narrow to the **single** most likely directory, such as `src/utils/` or `src/functions/<activity-dir>/`. **Prohibited**: without an explicit user request for "full-repo check" and without meeting the unified entry's "full matcher fallback search trigger", do not run one huge broad scan across multiple parallel roots such as **`src/` root, all of `src/functions`, and `.Knowledge`**.
2. **When matches are excessive**: if one search returns obviously too many hits, stop expanding keywords or paths and instead prefer to **Read the 1-2 main files named by the topic or stock-docs**. If still insufficient, perform a **second** narrow `Grep` with a smaller pattern or directory.
3. **Two-stage answers**: if the user did not explicitly ask to "list all implementation details / read dependencies thoroughly / audit the full chain", and manifest + required topics (plus any stock/req materials named by the topic) are already enough to form a conclusion, **first output a short useful answer**. Implementation details and additional file lists should be drilled only when the user asks for evidence or expansion. Do not lengthen the exploration chain solely for self-verification completeness.
4. **Avoid repeated disk reads**: in the same session, if a file has already been fully `Read` and there is no new user instruction or hypothesis, do **not** launch an equivalent full-file `Read` again.

## Agent Self-Check

If you notice that you are answering a current-repository question without having `Read` the manifest, **stop writing immediately**, `Read` the manifest and the matched topic, then correct or continue the answer. If this turn read business source code and cites source-code facts, continue with `f2s-kb-feedback-closing` before sending the answer.
