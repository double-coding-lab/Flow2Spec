---
name: f2s-doc-final
description: Convert a PDF or MD document into the `final-overview-template` standard format so f2s-kb-build can later sync topics/index/manifest; triggers: f2s-doc-final、转成概述模板、终稿模版、final-overview-template, final template、convert to final draft
---

> Execution scope: drafts and final documents are both written to `.Knowledge/stock-docs/`; prefer reading `.Knowledge/template/final-overview-template.md` as the template.

## Orchestration (main / sub agent)

- The semantics of `subAgent` / `switchAgentVerification` use the unified entry as the only source of truth: **Cursor/Claude** read the config-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`). This section does not restate those semantics.
- **Do not split by default**: MD / PDF -> `final-overview-template` conversion is most coherent when the main session completes understanding, template mapping, and finalization in one pass.
- **Optional split** (only when `subAgent=true` and the input is large / multi-file; threshold: PDF **> 50 pages** or **> ~5MB of text**): a sub agent may produce a **draft** for template mapping, formatting, and structural transfer; the main agent compares it against the `final-overview-template`, identifies gaps, asks the user follow-up questions, aligns with the user, and **finalizes / accepts** the document. **A sub agent must not claim the final document is compliant on its own**.
- Do not split by default just because "format conversion can be isolated": final compliance depends on template semantics plus business wording, and the main-side acceptance cost usually remains.
- Verification is performed by the writing agent. This skill does not bind to cross-agent verification.

# Convert a PDF or MD into the `final-overview-template` Standard Format (spec -> context)

The user provides **at least one argument** after this skill: the **first argument** is a local **PDF file path** or **Markdown file path** (required); the **second argument** (optional) is an output file path and overrides the default output location. Execute the following workflow based on the file type, and output a final-style Markdown document that can later be consumed by **f2s-kb-build**.

**The `final-overview-template` is only guidance**: if `.Knowledge/template/final-overview-template.md` exists, read it as a structural reference. Do not force an exact template fit.

## Embedded Template Structure (Use When `.Knowledge/template/final-overview-template.md` Does Not Exist)

Standard requirements:

- **Level-1 heading**: design name (for example `# xxx Technical Design`).
- **Level-2 headings should include at least**: `## Core Concepts`, `## Business Rules`, `## Key Flows`; add or remove others as needed (for example status and transitions, APIs, configuration/table design/error codes, implementation locations and integration approach).
- **Core concepts**: use a table listing terms, entities, and key IDs (columns: concept, description).
- **Status and transitions**: if there is a state machine, list states and transitions; otherwise summarize briefly or omit.
- **Business rules**: list constraints, validations, and configuration items.
- **Key flows**: describe the main user-side or system-side flows; list flow name, brief steps, entry API/method, and result.
- **Optional sections**: APIs, configuration/table design/error codes, implementation locations and integration approach. Keep and fill them as needed.

---

## Flow 1: The User Provides Markdown (`.md`)

1. **Read** the `.md` file provided by the user.
2. **Reference format** (not mandatory): if `.Knowledge/template/final-overview-template.md` exists, read it as structural guidance; otherwise use the embedded template structure below.
3. **Analyze and convert**:
  - Understand the source topic and structure, and extract the "design name", "core concepts", "business rules", "key flows", and other source-relevant sections (such as status and transitions, APIs, configuration/table design/error codes, implementation locations, and so on).
  - Reorganize the content into clear final-style Markdown: the level-1 heading is the design name; the document should include at least the three level-2 headings `Core Concepts`, `Business Rules`, and `Key Flows`; add or remove other sections according to the source and need. Table/list formatting may reference the template but does not need to match exactly.
  - If the source lacks a section, mark it as `（待补充）` or infer and complete it from the source. If the source structure is already clear, keep the original section names.
4. **Output**:
  - Default output is `.Knowledge/stock-docs/<design-name>_final.md` (the final artifact includes the `_final` marker).
  - If the user specifies an output path as the second argument, use that path; otherwise use the default.
5. **Reply**: tell the user that `.Knowledge/stock-docs/<design-name>_final.md` has been generated, and say they may continue with `f2s-kb-build` to sync `.Knowledge/topics`, `.Knowledge/index.md`, and `manifest` if needed.

---

## Flow 2: The User Provides a PDF (`.pdf`)

Complete this in two stages: **first PDF -> draft MD, then after user confirmation draft MD -> template-format MD**.

### Step A: First Execution (PDF Path Provided)

1. **Try to read the PDF**: read the PDF from the user-provided path (absolute or relative to the project root, for example `.Knowledge/stock-docs/xxx.pdf`).
  - If the current environment can parse PDF text: extract the body and convert it to a Markdown draft (preserve heading hierarchy, lists, paragraphs, and tables if recognizable).
  - If the PDF cannot be read directly (for example only binary data is available): ask the user to export the PDF content to `.Knowledge/stock-docs/xxx.md` and then run the skill again.
2. **Generate the draft**:
  - Save the extracted content as `.Knowledge/stock-docs/<design-name>_draft.md` (infer the design name from the PDF filename or first heading).
  - In the reply, **show the full draft or its main structure**, and clearly state:
    - "The draft has been saved as `.Knowledge/stock-docs/<design-name>_draft.md`; please review and edit it."
    - "After confirming it is correct, run: `f2s-doc-final .Knowledge/stock-docs/<design-name>_draft.md`."
3. **Do not perform template-format conversion in this round**. This round only completes PDF -> draft MD.

### Step B: Second Execution After User Confirmation (Draft `.md` Path Provided)

When the user **runs this skill again with the draft `.md` path** (for example `.Knowledge/stock-docs/技术方案设计_draft.md`):

- Execute Steps 2-5 from **"Flow 1: The User Provides Markdown"**: read the format guidance -> analyze and convert -> output template-format content.
- **Output suggestion**: generate `.Knowledge/stock-docs/<design-name>_final.md`.
- **Reply**: tell the user the standardized version has been generated, and say they may continue with `f2s-kb-build` to sync `.Knowledge/topics` and the index.

---

## Path and Output Conventions

- All paths are relative to the project root. Drafts and final documents are both placed under `.Knowledge/stock-docs/`.
- **Input**: the first argument is a required file path, such as `.Knowledge/stock-docs/方案.pdf` or `.Knowledge/stock-docs/方案_draft.md`; the second argument is optional.
- **Output**:
  - First PDF run: `.Knowledge/stock-docs/<design-name>_draft.md`
  - MD or draft MD: `.Knowledge/stock-docs/<design-name>_final.md`
- If `.Knowledge/stock-docs/` does not exist, create it before writing.

---

## Constraints and Notes

- During conversion, **do not copy the source verbatim**. Extract, summarize, and complete it according to the template so core concepts, business rules, and key flows are easy to find.
- It is recommended, but not mandatory, to keep the three level-2 headings **Core Concepts**, **Business Rules**, and **Key Flows**. Add or remove other sections based on the source and need. The `final-overview-template` is guidance only and is not mandatory.
- End with a one-sentence summary: the generated draft/final path and the next step, `f2s-kb-build`, for syncing knowledge routing topics and indexes.
