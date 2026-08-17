---
description: Closing rule for knowledge-base follow-up suggestions after source code was read during ordinary Q&A; only suggest f2s-kb-distill, do not write automatically
alwaysApply: true
---

# Flow2Spec Knowledge-Base Feedback Closing

This rule governs knowledge-base follow-up suggestions after ordinary Q&A reads business source code. It only decides whether the final answer should append one minimal suggestion.

## Scope

Run this rule only when all of the following are true:

- This turn is **ordinary Q&A / troubleshooting / explanation**;
- This turn has **not entered** an `f2s-*` skill, `implement-tech-design`, `f2s-git-commit`, or another existing follow-up flow;
- This turn read business source code and the final answer cites source-code facts.

**Prohibited**: Do NOT output **any** of this rule's case 1–4 closing blocks in either of the following situations —

1. **This turn has already entered `f2s-kb-distill`**: `f2s-kb-distill` is the skill that ingests this turn's knowledge into the KB; appending its own ingestion hint is both redundant and self-referential.
2. **This turn entered a process-orchestration skill**: `f2s-req-clarify` / `f2s-req-tech` / `f2s-req-plan` / `f2s-doc-arch` / `f2s-doc-final` / `f2s-doc-milestone` / `f2s-doc-pdf`. The deliverable of these skills is a **`.Knowledge/req-docs/*`, `docs/*`, or task-planning artifact for this specific delivery**; reading source code serves that deliverable, it is not "picking up a piece of general knowledge on the side". Even if source code was read and its facts were written into the clarification / design / planning document, **do not** append a distill hint (clarification / design docs live under `req-docs`, not under `topics` / `stock-docs`; planning artifacts are archived with the task; doc skills each have their own write target).

Other `f2s-kb-*` skills (e.g., `f2s-kb-feat` / `f2s-kb-fix` / `f2s-kb-sync`) **still judge per the four cases** after they finish: if this turn's answer contains reusable knowledge facts **outside the main path** that the current SKILL **did not ingest** (typical scenarios: while fixing a bug you incidentally read another module's source, or you answered a follow-up unrelated to the current SKILL's main subject), output the closing block as usual; the agent judges by what was actually written this turn, not by a blanket prohibition.

## Judgment Timing and Basis

**Judgment timing**: After generating the final answer, judge based on the knowledge content actually included in the answer, not the reading process.

**Judgment basis**:
- What knowledge did the final answer supplement that the KB did not write or wrote insufficiently
- Does this knowledge belong to "reusable knowledge facts"
- Not: all files/information encountered during the reading process

**Reusable knowledge facts** include:
- Core mechanisms (e.g., cache semantics, retry strategy, fallback logic)
- State transitions (e.g., order state machine, session lifecycle)
- Return value / error code contracts (e.g., HTTP status code semantics, business error code meanings)
- Configuration switch impacts (e.g., switch X affects behavior Y)
- Failure fallback strategies (e.g., fallback plan when primary path fails)
- Module boundaries or calling conventions (e.g., module A calling module B contract)
- Data models and field semantics (e.g., business meaning of key fields)

**Evidence only, do not trigger sync** includes:
- Line numbers (e.g., `client.py:51`)
- Function names (e.g., `send_message_to_session()`)
- Code snippets (concrete implementation code for demonstration)
- Call paths (e.g., `A → B → C` call chain)
- Local implementation expanded to answer user follow-up questions
- Source-code verification of facts already written in the topic (KB wrote it clearly, source code only confirms)

## Mechanical Gate

- After reading the first business source file, treat this turn as having triggered `sourceFallbackUsed=true`.
- When `sourceFallbackUsed=true` and the final answer cites source-code facts, this four-case self-check must run before sending the answer.
- **One of the four cases must be stated explicitly**: every closing pass must choose cases 1-4 and **output the corresponding block explicitly**; silently skipping the whole closing flow is not allowed.
- Decision logic:
  - topic matched + final answer supplemented "reusable knowledge facts" → use **case 2**
  - topic not matched + final answer supplemented "reusable knowledge facts" → use **case 1**
  - topic matched + final answer only contains "evidence content" (line numbers/function names/call paths) + KB already wrote core facts clearly → use **case 4**
  - If the gap noted before drilling down was **mechanism/contract/process-type knowledge gap**, use **case 2** afterwards
  - If the gap noted before drilling down was only **evidence/source-code location/line number/implementation provenance gap**, and the topic already covers core facts, may use **case 4**

## Four Closing Cases

1. **KB does not cover it + source code provided the answer**: append this at the end of the answer:
   ```md
   > 💡 Run `f2s-kb-distill` to ingest knowledge from this turn
   >
   > **This turn will ingest**: <one-line summary naming "what capability / which module / which kind of knowledge", e.g., module X's retry mechanism (first ingestion)>
   ```
   **Decision criteria**: no topic covers this capability / module / problem domain, and the final answer supplemented reusable knowledge facts.

2. **KB covers it but lacks detail + source code completed the answer**: append this at the end of the answer:
   ```md
   > 💡 Run `f2s-kb-distill` to ingest knowledge from this turn
   >
   > **This turn will ingest**: <one-line summary naming "which topic and which section to supplement", e.g., supplement the "failure-fallback logic" section of `<topicId>`>
   ```
   **Decision criteria**: an existing topic covers the direction but lacks details, and the final answer supplemented reusable knowledge facts (core mechanisms, state transitions, contracts, etc.).

3. **KB and source code disagree**: answer according to source-code facts and append this at the end of the answer:
   ```md
   > 💡 Run `f2s-kb-distill` to ingest knowledge from this turn
   >
   > **This turn will ingest**: <one-line summary naming "which description in `<topicId>` to fix that disagrees with source code">
   ```

4. **KB fully covers it; source code was only verification**: append this at the end of the answer:
   ```md
   > **Knowledge base already covers this**: the core facts in this answer were fully provided by `<topicId>`; source-code reading was only verification.
   ```
   **Decision criteria**:
   - The relevant KB topic already states the core answer to this question (mechanisms, transitions, contracts and other reusable knowledge facts)
   - This turn's final answer did not introduce new reusable knowledge facts outside the KB
   - Source code cited in the answer was only for evidence (line numbers, function names, call paths) or to verify KB-written content
   - If the gap noted before drilling down mentioned mechanism/contract/process-type knowledge gap, case 4 is prohibited

> **Summary requirement (required for cases 1-3)**: one line stating "what this distill run will ingest" — capability / module name + knowledge type (mechanism / transition / contract / config etc.) + whether this is first ingestion or supplementing some topic. **Do not** post only the command without the summary; the summary is what lets the user decide whether to actually run distill.

## Boundary Between Case 1 and Case 2

- **case 1** (`f2s-kb-distill` uncovered scenario): no topic covers this capability / module / problem domain
  - Example: user asks "module X's retry mechanism", but manifest has no topic related to module X
  - Example: user asks "implementation of new feature Y", but KB has no document or topic about feature Y

- **case 2** (`f2s-kb-distill` supplement scenario): an existing topic covers the direction but lacks details
  - Example: topic wrote "cache-first strategy" but did not write concrete failure-fallback logic
  - Example: topic wrote "action-chain judgment" but did not write concrete state-checking method

This avoids misjudging "already has a topic but still suggests add".

## Output Format

- Cases 1-3: output one Markdown blockquote containing, in order, the `f2s-kb-distill` command + one blank line + the **This turn will ingest** summary (one line, see "Summary requirement" above).
- Case 4: output one Markdown blockquote stating "Knowledge base already covers this" plus the related topicId.
- Do not omit this block; do not output a list of KB paths read, a coverage comparison table, explanations, or multi-line background.
- Only suggest; do not automatically run `f2s-kb-distill`.
