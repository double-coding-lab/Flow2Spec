---
name: f2s-doc-pdf
description: Convert a PDF technical design into Markdown and save it under req-docs, with optional flow-description completion; triggers: PDF转MD、按方案实现前的 PDF、PDF to Markdown、technical design PDF
---

> Execution scope: technical design documents are written to `.Knowledge/req-docs/`; rule capabilities are still loaded from the config-root `rules/skills`.

## Orchestration (main / sub agent)

- The semantics of `subAgent` / `switchAgentVerification` use the unified entry as the only source of truth: **Cursor/Claude** read the config-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`). This document does not restate those semantics.
- **Do not split by default**: follow-up questions and disk writes must be completed in the main agent session. A sub agent cannot ask the user follow-up questions.
- **Optional split**: enable only when `subAgent=true` and the PDF exceeds the threshold (**> 50 pages or > ~5MB of text**). The sub agent is responsible only for the first PDF-to-MD draft and writes `.Knowledge/req-docs/<name>.md`; it must **not ask follow-up questions and must not write the "Flow Description" section**. The main agent then handles follow-up questions and flow-description completion.
- Verification is performed by the writing agent by default. This skill does not bind to cross-agent verification.

# Convert a PDF Technical Design to Markdown (and Complete Flow Descriptions)

The user provides **one argument** after this skill: the local path to the **PDF technical design document** (for example `~/Downloads/技术方案.pdf` or `.Knowledge/req-docs/某草稿.pdf`). Follow the steps below to convert the PDF into Markdown, save it under `.Knowledge/req-docs/`, and guide the user to complete flow descriptions when needed.

## Step 1: Read the PDF and Convert It to Markdown

1. If sub-agent splitting is enabled (PDF > 50 pages or > ~5MB), the sub agent is responsible only for the PDF-to-MD draft and writes `req-docs/<name>.md`; it does not ask follow-up questions and does not write flow descriptions. The main agent takes over the following steps. **Read** the PDF file provided by the user, extract its **text content** (preserving tables, sections, lists, code blocks, and other structure as much as possible), and organize it as Markdown.
2. **Save it to** `.Knowledge/req-docs/`. Recommended path: `.Knowledge/req-docs/<design-name>.md`. The filename should be the original PDF filename with `.pdf` replaced by `.md`.
3. If the directory does not exist, create it before writing.
4. After saving, tell the user: "The PDF has been converted to Markdown and saved as `xxx.md`."

---

## Step 2: Ask the User for Flow Diagrams (Optional but Recommended)

Embedded **flow diagrams** in the PDF cannot be parsed directly into steps and branches. If code will be implemented based on the diagram, the user needs to provide additional material.

1. Tell the user: "The document may contain flow diagrams, and I cannot reliably parse the steps and branches inside those diagrams from the PDF. If you will later implement code from this technical design (see the `implement-tech-design` rule), I recommend completing the flow description:
  - **Option 1**: send the relevant flow diagram images in this conversation; I will parse them and write a textual version into the MD file above.
  - **Option 2**: describe each API/flow in text directly (for example: 1. Is the user logged in? 2. Query a table. 3. Check a field -> return the result); I will write it into the MD file as provided.
   If the document has no flow diagram or you do not want to provide one now, reply `skip`, and I will finish this skill."
2. **If the user replies `skip` or clearly says no flow description is needed**: tell the user, "Provide the MD path above in the conversation and say that you want to implement code from the technical design; I will follow the `implement-tech-design` rule." Then stop.
3. **If the user provides a flow diagram image or text**: proceed to Step 3.

---

## Step 3: Write the Flow Description into the MD File

1. If the user provides an **image**: parse the steps, decision branches, and returns in the image, then organize them as textual steps.
2. If the user provides **text**: use it directly.
3. **Append** the flow content to the end of that MD file, or add a new "Flow Description" section. Example format:

```markdown
## Flow Description (provided by the user / parsed from a flow diagram)

### Example API A
1. Frontend sends the request
2. Backend queries the latest record from a table
3. Check: does a certain ID exist? yes -> return true, no -> return false
4. Return result

### Example API B
1. Is the user logged in? -> no: return 401
2. Is it expired? -> yes: return 403
…
```

1. After saving, tell the user: "The flow description has been written to `xxx.md`. Next, provide this MD path in the conversation and say that you want to implement code from the technical design; I will follow the `implement-tech-design` rule."

---

## Constraints and Summary

- **Path**: the PDF path provided by the user may be absolute or relative to the project root. The output MD should be saved to `.Knowledge/req-docs/<design-name>.md` (`req-docs` stores implementation documents, while `stock-docs` stores knowledge-source documents).
- **This skill only handles**: PDF -> Markdown conversion plus optional flow-description completion. It does not implement code. After completion, you may tell the user: provide the generated MD path in the conversation and say that implementation should follow the technical design; the AI will follow **f2s-implement-tech-design.mdc**.
