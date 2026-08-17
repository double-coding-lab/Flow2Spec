---
name: f2s-req-tech
description: Generate a technical design document from clarified requirements using the project knowledge base, Skills, and Rules; triggers: 生成技术方案、技术方案、f2s-req-tech、generate technical design、technical design
---
> Execution scope: business documents live under `/.Knowledge/`; this skill only produces `.Knowledge/req-docs` technical design documents and references knowledge under `.Knowledge`. It does not modify the config-root `rules/skills`.

## Orchestration (main / sub agent)

- The semantics of `subAgent` / `switchAgentVerification` use the unified entry as the only source of truth: **Cursor/Claude** read the config-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`). This skill does not restate those semantics.
- **Precondition for splitting (hard constraint)**: when `subAgent=true`, the main agent **must first** extract a "project convention summary" as mandatory context for the sub agent. It must cover: external contract conventions, error and return conventions, async/integration conventions, data and storage conventions, engineering structure, and module boundaries, with a total length **< 80 lines**. If this precondition is not met, **do not split**: the acceptance rework cost is greater than the benefit of splitting.
- **Sub-agent responsibility**: perform multi-source read-only analysis (`.Knowledge/topics`, `stock-docs`, clarified `req-docs`, and template), then write a `.Knowledge/req-docs` technical design draft according to `.Knowledge/template/technical-spec-template.md`.
- **Main-agent responsibility**: finalize the contract, verify against the template and clarification document, and handle consistency of delivery units and flows.
- **Verification**: performed by the writing agent by default. This skill does not bind to cross-agent verification.

# Generate a Technical Design Document from Requirements

The user provides a **clarified requirement** in the conversation (or a requirement summary / PRD path), and may optionally attach **requirement conditions** such as scope constraints, required or forbidden technologies, client-side limits, priority, and so on. You need to use the business knowledge documents (`.Knowledge/`) and currently loaded agent rules/skills to output a technical design document that can be used directly for implementation.

**Purpose**: the technical design produced by this skill is **for later code implementation**. Developers implement the feature according to this document. It is not limited to backend work; it applies to backend, frontend, full-stack, mobile, scripts/tools, and any other scenario. It is not used to generate Rules/Skills.

**Structural model**: assemble the technical design from the **optional blocks** in `.Knowledge/template/technical-spec-template.md` as needed. **Do not force a fixed section set**: write only the delivery units, data structures, configuration, dependencies, flows, or exception handling that this implementation truly needs. Within each delivery-unit section, describe both the contract/input-output and the necessary processing flow, instead of splitting repeated large chapters such as "API and flow description", "related call flow", or "flow description".

---

## Input

- **First argument (required)**: the clarified requirement description or a **requirement/PRD document path** (for example `.Knowledge/req-docs/xxx.md` or `.Knowledge/stock-docs/需求_final.md`).
- **Subsequent arguments or user additions (optional)**: requirement conditions and constraints, such as:
  - Scope (only a certain module or client)
  - Required/forbidden technology stack or API style
  - Boundaries with an existing module
  - Performance, security, or compliance requirements

---

## Output Structure

When generating the document, **first read `.Knowledge/template/technical-spec-template.md`** as structural guidance and select its section blocks as needed. Entire sections unrelated to the requirement may be omitted, and new sections not listed in the template may be added according to the project.

---

## Precondition for Sub-Agent Splitting (Optional, Only When `subAgent=true`)

Before splitting, the main agent must produce a "project convention summary" as **mandatory input** for the sub agent; otherwise, **do not split**. The summary must be **< 80 lines** and include the following six categories (technology-agnostic; fill in concrete values based on the project):

1. **External contract conventions**: naming, versioning, authentication, pagination, common return fields, and related conventions for APIs / events / messages / components / script entries.
2. **Error and return conventions**: source of the error-code system, prefix/segment rules, required fields (such as code / message / data), and status layering.
3. **Async / integration conventions**: naming, consumer grouping, retry, and idempotency conventions for message queues / event buses / scheduled tasks / external service calls.
4. **Data and storage conventions**: naming for databases / tables / fields / cache / files / search, primary key / index / time-field conventions, and sharding strategy if any.
5. **Engineering structure**: module layering (for example controller / service / dao / domain, or frontend pages / components / hooks / store, or equivalent names) and package-path / directory conventions.
6. **Module boundaries**: call and data boundaries between existing modules involved in this design and other modules.

Splitting before this precondition is complete violates the hard constraint. Only after the summary is complete may the main agent hand sub-tasks to a sub agent.

---

## Steps

1. **Clarification-completeness gate (hard constraint)**: Before entering the write phase, decide whether the current requirement is **already clarified**:
   - **Clarified** criteria (any one suffices): ① **This turn was auto-chained from `f2s-req-clarify`** with the just-written clarification document path passed in as input (this is the preferred path — the user can flow from `f2s-req-clarify` straight through to the design within one turn); ② the user explicitly provides a path such as `.Knowledge/req-docs/*_需求澄清.md` or an equivalent clarification document; ③ the user explicitly says "already clarified / requirement is settled / just draft the design"; ④ the input itself is a complete PRD (scope, key flows, boundaries, acceptance criteria) and **within this turn** contains no obvious undefined concepts or contradictions.
   - **Not-clarified** signals (any one triggers): the requirement description contains hedges such as "I understand it as / I plan to / roughly / probably / to be determined / not decided yet"; interfaces / tables / state machines / interactions with existing modules only state "what to do" without "what counts as done"; the user's input already lists three or more key questions that are still unanswered; and **this turn is not chained from `f2s-req-clarify`**.
   - **If not clarified, switch to clarify**: **do not** enter the write phase within the same turn. Instead switch into `f2s-req-clarify` to complete the clarification write, then let its auto-chain rule **come back to this skill within the same turn to continue** (this is the intended direct path; it does not interrupt the user). If switching to clarify is not possible (e.g., the user explicitly says "just do the design; skip clarification"), list 3–6 clarification questions that most affect how the design is written and wait for answers; **do not draft the design**.
2. **Read the requirement**: get requirement content from the path or text provided by the user (or the clarification path handed in by `f2s-req-clarify`); include requirement conditions if any.
3. **Load project context**: actively read and apply:
   - Relevant topic rules/flows under `.Knowledge/topics/`;
   - Background documents and historical technical designs under `.Knowledge/stock-docs/`;
   - **Structural reference** `.Knowledge/template/technical-spec-template.md`.
4. **Align with project conventions**: keep naming conventions, directory structure, configuration conventions, message queues, error codes, data models, and similar items consistent with the existing project.
5. **Write the document**: select and write section blocks from `.Knowledge/template/technical-spec-template.md` as needed. When a delivery unit involves behavior logic, write the processing flow in the same section so the deliverable and flow are not disconnected. If splitting is enabled, the sub agent must use the "project convention summary" plus the clarification document as mandatory input and must not expand the reading scope on its own.
6. **Output location**: default `.Knowledge/req-docs/<design-name>_技术方案.md`; if the user specifies a path, use that path.
7. **Closing stop (hard constraint)**: After the design is written to disk, output only a single-line hint "Technical design ready: `<path>`; run `f2s-req-plan` to break down tasks, or `implement-tech-design` to implement when you're ready", then **stop**. **Prohibited**:
   - Automatically chaining into `f2s-req-plan` / `implement-tech-design` / any other `f2s-*` skill within the same turn (`f2s-req-clarify` → `f2s-req-tech` is the allowed **single hop**; anything after the design requires a new user turn);
   - Appending an `f2s-kb-distill` closing hint at the end of the design document or immediately after it (see the prohibited section of `rules/f2s-kb-feedback-closing.*` — process-orchestration skills do not trigger distill on write);
   - Proactively listing an "A/B/C next-step menu" that funnels the user straight into the next skill.

---

## Constraints

- All paths are relative to the project root (same level as `.Knowledge`).
- Do not invent conventions that do not match the project. If uncertain, mark `confirm with project conventions`.
- **Principle**: each delivery-unit section should include the contract (input/output) and processing flow as needed. Do not split them into repeated chapters. Use `.Knowledge/template/technical-spec-template.md` as reference and select blocks as needed; do not force the whole template.
