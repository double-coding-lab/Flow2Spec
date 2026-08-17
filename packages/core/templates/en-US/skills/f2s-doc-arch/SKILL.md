---
name: f2s-doc-arch
description: Generate a first draft of project architecture documentation from user notes, documents, or code scanning; no fixed format is required as long as the explanation is clear. Triggers: 项目架构说明、f2s-doc-arch、架构初稿、architecture draft、project architecture
---
> Execution scope: this skill writes its artifact to `.Knowledge/stock-docs/` by default; later knowledge-base skill chains such as `f2s-doc-final` and `f2s-kb-build` sync it into `.Knowledge/topics/index/manifest`.

## Orchestration (main / sub agent)

- The semantics of `subAgent` / `switchAgentVerification` use the unified entry as the only source of truth: **Cursor/Claude** read the config-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`). This section does not restate those semantics.
- When `subAgent=true`, choose one of the following sub-agent strategies:
  - **Mode B (default, single-round parallel)**: the main agent first produces an "inventory" (entry points + core module names, handwritten by the main agent) and a "scanning contract" (readable paths / directories forbidden to scan / unified output fields). Sub agents then perform parallel read-only scans and return tables. The main agent merges and deduplicates once, writes the `stock-docs` draft, and keeps user confirmation and acceptance in the main agent.
  - **Mode C (multi-round correction)**: switch to this mode when any of the following is true: multiple workspaces / monorepo; extremely deep directories or > 20 source paths; the first-round sub-agent tables are contradictory or obviously thin; multiple source narratives overlap or conflict heavily.
- **Sub-agent delivery hard constraint**: sub agents must not trim directory scope on their own. They must follow the main agent's handwritten inventory. Their delivery must follow the "sub-agent delivery YAML schema" (fields: `source` / `scope` / `cross_refs` / `pending`); prose-style returns are forbidden.
- **Write-authority hard constraint**: `.Knowledge/index.md` / `manifest-routing.json` are always written by the main agent. Sub agents must not touch them.
- The writing side self-verifies. This SKILL does not bind to cross-agent verification.

# Generate Project Architecture Documentation (Draft)

This skill helps users generate **project architecture documentation** in a **draft** form. There is no fixed format; the goal is to **explain things clearly**. The user may provide plain-text notes, an existing document, or, when no input is provided, allow the AI to scan code as a fallback (not recommended; fallback only).

**Division of responsibility with f2s-kb-add**: this skill is responsible **only** for the "architecture documentation **draft**" step. By default, it does **not** write the final version in the same skill and does not directly run **f2s-kb-build**. If the user wants to parse an **already completed capability** into the knowledge base **in one pass** from multiple related file paths (draft -> final -> topics/index/manifest), use **`f2s-kb-add`**. **Do not use this skill to impersonate that workflow**.

---

## Inputs (All Optional)

| Parameter | Description |
| -------------- | -------------------------- |
| **First argument** | Optional. One of: **a plain-text description** written after the command, or **a local document path** such as `.Knowledge/stock-docs/xxx.md`, `.Knowledge/req-docs/README.md`, or `README.md`. If omitted, enter the "no input" flow. |
| **Second argument** | Optional. Output file path. If omitted, default to `.Knowledge/stock-docs/architecture-overview_draft.md` (the project name may be inferred from `package.json` `name` or the directory name, then sanitized for a valid filename). |

**Note**: when no description or document is provided, the skill uses **AI scanning of project code and directories** to generate the architecture draft, and **quality is not guaranteed**. Before executing, you **must first ask the user**: "Do you confirm that no arguments will be provided and that AI should still scan the code to generate the draft? (quality not guaranteed)" Continue only after the user explicitly confirms.

---

## Execution Flow

### 1. If the User Provides Notes or a Document

1. **Read and understand**
   - If the first argument is a **document path**: read that file under the parent directory of the config root (supports text formats such as .md and .txt).
   - If the first argument is a **plain-text description**: use the user input directly as "user notes".
2. **Supplement with project context**
   - Based on clues in the user notes such as **code paths, module names, and entry points**, combine the actual directory structure and key files under the parent directory of the config root (for example package.json, entry files, config files) to **summarize and complete** the architecture.
   - If the user notes are broad (for example "an admin system"), **actively guide** the user to add: main code paths, module/package split, entry points and startup approach, boundaries with external systems, and similar details, so the architecture documentation is more accurate.
3. **Generate the draft**
   - If splitting is enabled (Mode B), sub agents must scan according to the main agent's handwritten inventory, and their delivery must follow the sub-agent delivery YAML schema.
   - Produce a **project architecture document**. It may include, but is not limited to: project positioning, technology stack, directory/module split, key paths and entry points, configuration and deployment notes, and how this document maps to documentation artifact stages if applicable.
   - **No fixed format**: clear headings and paragraphs are enough. Do not force the `final-overview-template`.
4. **Output**
   - Default output: `.Knowledge/stock-docs/architecture-overview_draft.md`. If the user provides a second argument, write to that path.
   - If the directory does not exist, create it first.

### 2. If the User Provides No Notes or Document

1. **Warn and confirm**
   - Clearly state: "**No arguments were received.** Without notes or a document, AI will scan project code and directories to generate an architecture draft. **Quality is not guaranteed**, and it may miss key points or fail to distinguish priority. I recommend providing a brief description or existing document (such as README or design doc) before running this skill."
   - **Must ask the user**: "Do you confirm that no arguments will be provided and that AI should still scan the code to generate the draft? (quality not guaranteed)"
   - Continue to Step 2 only after the user **explicitly confirms** (for example "确认", "yes", "directly scan"). If the user does not confirm or cancels, do not scan or generate.
2. **Scan and generate**
   - Based on the parent directory of the config root: list main directories and representative files (with package.json, common entry names, and config filenames when useful), and summarize "directory structure, likely modules, entry points, and configuration".
   - Generate an **architecture draft**, and state inside the document: "This draft was generated by scanning the project structure; it should be further completed with business notes and code details."
3. **Output**
   - Same as above: default `.Knowledge/stock-docs/architecture-overview_draft.md`, or the second argument specified by the user.

---

## Guidance and Iteration

- If the user's description has a **large scope** (for example "the entire middle platform"), suggest adding **main code paths, submodule/package names, external entry points, dependencies**, and similar details. The user may add them in this or later conversations and rerun this skill to update the draft.

## Large-Feature Split Recommendation

After scanning or understanding the source/notes, if any of the following signals appear, output a "拆分建议" section at the **end** of the draft for the user's reference (does not block generation):

- Total source volume exceeds **~5000 lines**, or more than **20 files** are involved;
- More than **3 unrelated responsibility domains** are clearly identifiable (for example API layer / core rules / data model / external dependencies are independent);
- The user notes already mention "multiple submodules" or "multiple features".

**Split recommendation format** (write at the end of the draft as a standalone section):

```
## Split Recommendation

The current feature is large. Split it into multiple focused stock-docs, each mapped to an independent topic:

| Suggested document | Main content | Suggested topic primary |
|---|---|---|
| <feature-name>-overview_draft.md | Entry boundaries, submodule relationships, quick index | feature |
| <feature-name>-business-rules_draft.md | Core flows, gates, state machine | policy |
| <feature-name>-data-model_draft.md | Table structure, enums, model conventions | module |
| <feature-name>-external-dependencies_draft.md | SOA/QMQ/Redis/risk-control wrappers | config |

After splitting, each sub-topic is independently matched through its own matcher, while the main topic body contains navigation links.
Do not chain "overview -> details" through topicDependencies (see f2s-topic-authoring section 5).
```

The user may choose: **A) run `f2s-doc-arch` separately for each split recommendation** (recommended), or **B) continue with the current single draft** for later steps.

## Next Step After Completion (Hard Constraint)

This skill **only produces a draft**. At the end, guide the user in the following order. **Do not** let the user skip the final version and directly run `f2s-kb-build`:

1. Tell the user the draft path and recommend reviewing and completing it first.
2. **The next step must be `f2s-doc-final`**: use the draft path as input and produce `.Knowledge/stock-docs/<design-name>_final.md` in the `final-overview-template` standard format.
3. **Only after the final document is written** guide the user to **`f2s-kb-build`**, and its input must be the final path (containing `_final` or just generated by `f2s-doc-final`).
4. **Do not** write only "please run `f2s-kb-build`" in the completion reply with input pointing to `*_draft.md`; **do not** present `f2s-kb-build` and `f2s-doc-final` as alternatives.
5. **Only exception**: the user **explicitly requests** skipping the final step, and the draft has already been manually made compliant with the `final-overview-template`. First explain the risk of skipping finalization, then allow `f2s-kb-build`.

**Completion reply template** (must include both `f2s-doc-final` and `f2s-kb-build`, with ctx-build after the final document):

> Architecture draft generated: `<draft-path>`. Please review and edit it first; next run **`f2s-doc-final <draft-path>`** to convert it to a final document, then run **`f2s-kb-build <final-path>`** to sync knowledge routing topics and indexes.

---

## Path and Output Conventions

- All paths are relative to the **parent directory of the config root**.
- **Default output**: `.Knowledge/stock-docs/architecture-overview_draft.md`; the project name is taken from `package.json` `name` (with scope and illegal characters removed) or the current directory name.
- If the user provides the second argument as an output path, use it first. If the directory does not exist, create it first.

---

## Constraints and Notes

- **No mandatory format**: this skill produces an "architecture documentation draft"; clarity is the priority. It does not need to conform to the `final-overview-template` or a fixed section structure.
- **Must confirm when no arguments are provided**: if the user provides no argument, first ask "Do you confirm that no arguments will be provided and that AI should still scan the code to generate the draft? (quality not guaranteed)". Execute scanning and generation only after explicit confirmation.
- Summarize according to the "completion reply template" above: draft path + **must run `f2s-doc-final` before `f2s-kb-build`**; do not recommend build only.
