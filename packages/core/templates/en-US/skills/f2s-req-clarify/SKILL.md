---
name: f2s-req-clarify
description: Clarify a PRD or requirement through follow-up questions until it is actionable, then use f2s-req-tech to produce a technical design; triggers: 需求澄清、PRD 澄清、requirement clarification、PRD clarification
---

## Orchestration (main / sub agent)

- The semantics of `subAgent` / `switchAgentVerification` use the unified entry as the only source of truth: **Cursor/Claude** read the config-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`). This skill does not restate those semantics.
- This skill does **not** split work by default: regardless of the `subAgent` value, the clarification process stays entirely in the main conversation. Follow-up questions and alignment with the user strongly depend on continuous context; sub-agent splitting would break that context.
- Verification is performed by the agent that writes the artifact. This skill does not bind to cross-agent verification.

# Requirement Clarification

> Execution scope: clarification documents are written to `.Knowledge/req-docs/`.

**Input**: Optional. The full PRD, a requirement description, or a document path (for example `.Knowledge/req-docs/xxx.md`). If omitted, clarify based on the current conversation. Later replies may add requirement conditions.

**Behavior**: Identify vague wording, undefined concepts, missing information, contradictions, and implementation-relevant details that are not specified. Group them, ask concrete answerable follow-up questions, then iterate based on the answers until the flow, boundaries, exceptions, and key concepts are unambiguous. Do not make business assumptions for the user; ask when something is unclear.

**Completion (write clarification doc → auto-chain to technical design)**: When the information is clear enough, output a Markdown "requirement clarification document" that can be written directly to disk. The document must include at least: background and goals, scope (included / excluded), key flows, boundaries and exceptions, key concept definitions, acceptance criteria, and open questions if any. Save it under `.Knowledge/req-docs/` (recommended name: `<capability>_需求澄清.md`).

**After the clarification document is written to disk, this skill auto-chains to `f2s-req-tech` within the same turn**: feed the just-written clarification path directly into technical-design generation without waiting for another user trigger. Before chaining, emit a one-line notice "Clarification document ready: `<path>`; proceeding to generate the technical design via `f2s-req-tech`", then continue.

**Exceptions — stay at clarification, do NOT auto-chain to technical design** (any one triggers a stop):
- The clarification document's "open questions" section still has items that materially shape the design structure (e.g., core contracts for tables / APIs / state machines are undefined) — in that case, list the remaining questions, wait for answers, then write and chain;
- The user explicitly says "only produce the clarification / don't rush the design / discuss first" or a similar stop phrase during clarification;
- The user explicitly specifies a different next action (e.g., "stop after clarification", "break down tasks first").

**Prohibited**:
- Appending an `f2s-kb-distill` closing hint at the end of the clarification document or immediately after it (see the prohibited section of `rules/f2s-kb-feedback-closing.*` — process-orchestration skills do not trigger distill on write);
- Auto-chaining to `f2s-req-tech` before the clarification document is written to disk (the auto-chain requires an on-disk clarification path);
- Skip-chaining to `f2s-req-plan` / `implement-tech-design` / any other `f2s-*` skill in the same turn (only one hop — to `f2s-req-tech` — is allowed; subsequent skills still require a new user turn).
