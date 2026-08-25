---
name: f2s-doc-milestone
description: Generate a milestone document (`project-milestone-template`) from req-docs, git log, `.task`, and knowledge-topic semantics; triggers: f2s-doc-milestone、生成项目里程碑、里程碑、project milestone、generate milestone. A semantic scope may be appended after the command. This skill always uses a sub agent for generation and the main agent for verification, regardless of flow2spec.config orchestration switches
---

> **Task paths**: all `.task/` reads/writes must use **`TASK_ROOT` from `rules/f2s-task`** (` .task` or `.task/<developerId>`; config → git → legacy). Bare `.task/todo.json` / `.task/active/` below mean **`TASK_ROOT/...`**.


> Execution scope: read `.Knowledge/template/project-milestone-template.md`; write **only** `.Knowledge/stock-docs/<scope-name>-milestones.md` (no second path argument).

## Orchestration (Fixed, Not Affected by Project Config)

**This skill is not affected by** `subAgent`, `switchAgentVerification` (or old key `subAgentVerification`) in `flow2spec.config.json`: regardless of whether they are `true` or `false`, **always** use the division below. It is **forbidden** to switch to "all main session" or "sub agent self-verifies and ends" because of config values.

| Role | Steps | Responsibilities |
| --- | --- | --- |
| **Main agent** | 0, 3, 4 | Read template and knowledge topic index, parse scope, dispatch sub agent, **verify**, revise if needed, reply to user |
| **Sub agent** | 1, 2 | Collect four sources, apply template, **Write draft** |

1. **Main agent**: Step 0 -> issue the "collection contract" -> sub agent executes Steps 1-2 and writes the draft.
2. **Main agent**: Step 3 verifies against the four sources and the "important node checklist" (do not rewrite wholesale; fill gaps, correct errors, add "Pending Confirmation") -> Step 4 replies.
3. The sub agent is **forbidden** from claiming "the milestone has been accepted as complete"; the final document is the version verified by the main agent.

> Step 0 still **`Read("flow2spec.config.json")`** (satisfies the `f2s-config-check` preflight), but its `subAgent` / `switchAgentVerification` values **must not** change this skill's orchestration.

**Sub-Agent Collection Contract (Main Agent Writes into the Prompt Before Dispatch)**

| Field | Content |
| --- | --- |
| `scope` | One sentence describing the user's semantic scope |
| `outputPath` | `stock-docs/<scope-name>-milestones.md` |
| `sources` | See "Four Sources" below; **must include knowledge-topic semantics** |
| `template` | `.Knowledge/template/project-milestone-template.md` (do not write the template's top explanatory blockquote) |
| `delivery` | Complete Markdown that can be directly `Write`n to `outputPath` |
| `stagePolicy` | See "Stage Granularity" below; the contract must restate it in one sentence |

## Stage Granularity (Required, Write into the Contract)

Milestones **Mx record only feature/capability changes**: deliverables that are already implemented or verifiable in the current repository (or user-specified scope), such as modules/APIs/data models/domain behavior/knowledge routing, and must be supported by the four sources.

**Do not** write the following stage types as separate overview rows or standalone `## Mx ·` sections (do not invent them without four-source delivery support; even when delivery exists, do not split them into "pure testing / pure integration" stages):

- Joint debugging, integration testing, UAT, regression, acceptance, test submission, launch checks (process-only, no functional diff)
- Environment/ops-only actions (executing DDL, filling configs, release windows, cross-repo scheduling) with **no** feature delivery in this scope
- Stages named "stabilization / engineering / wrap-up" whose substance is only the process work above

**Merge rule**: engineering changes within the same capability iteration (such as id type alignment, pagination format, locking and concurrency) are **merged into** the corresponding feature stage body, not written as a separate "joint debugging / testing / acceptance" stage.

**Gap handling**: if the four sources mention only pending joint debugging, pending acceptance, or missing environment setup without feature delivery in this scope, **do not write** a corresponding Mx. Add one sentence under **Pending Confirmation** if needed, and **do not** fill the overview table with "planned items".

## Four Sources (Both Collection and Verification Must Cover Them)

| Source | What to Read | How to Use in Milestones |
| --- | --- | --- |
| **req-docs** | In-scope `.Knowledge/req-docs/*.md` | Requirement/design nodes, delivery summaries |
| **git** | `git log --no-merges`, `git tag -l`, `package.json` version | Timeline, major versions/tags, commit anchors |
| **`.task`** | `todo.json`, `active/`, `completed/` `task.md`, etc. | Task closure, delivered steps |
| **Knowledge topics (semantics)** | See "Topic Source" below | Align with capabilities already registered in index/manifest and avoid missing stages that are already semantic in the knowledge base |

### Topic Source (Knowledge Semantics; Main Agent Step 0 Must Read, Sub Agent Step 1 Must Read)

1. **`Read(".Knowledge/manifest-routing.json")`**: extract `topicPaths`, `taskToTopicRules`, and scope-related `topicDependencies`.
2. **`Read(".Knowledge/index.md")`**: at least the "**Topic Overview**" table (topic id, applicable scenario, linked document summary).
3. **Read `.Knowledge/topics/<topic>.md` as needed**: summaries related to the scope or manifest hits (**do not** enumerate the entire `topics/` directory; read only topics named by manifest/index, usually no more than the table rows).
4. Summarize topic semantics into a list of "capability/scenario nodes" for the sub-agent contract. Milestone stages must either cover them or explain related gaps under "Pending Confirmation".

> **Source information is for collection and verification only — do not write it into the generated document.** The output must not contain a "Sources" line, topic file paths, or internal manifest names.

## Input (Only One, Optional)

After the command name, the user may append **one semantic scope** (natural language):

| User Intent | Example | Output Filename |
| --- | --- | --- |
| Entire project (default) | omitted / `entire project` / `full project` / `整个项目` / `全项目` | `project-milestones.md` |
| One requirement or capability | `callback refactor` / `login module` / `回调改造` / `登录模块` | `<summary>-milestones.md` |

**Filename rule**: suffix `-milestones.md`; entire project -> prefix `project`; single requirement -> semantic phrase or requirement title summary (keep concise).

**Scope narrowing**: filter the four sources by keyword, path, and date. If no scope is provided, all four sources are traceable in full (topic source reads full index table + manifest, and expands topics as needed).

## Step 0: Preflight (Main Agent)

1. **`Read("flow2spec.config.json")`** (do not use its `subAgent` / `switchAgentVerification` values to orchestrate this skill)
2. **`Read(".Knowledge/template/project-milestone-template.md")`**
3. **Topic source** (see above: manifest -> index topic table -> topic summaries as needed)
4. Parse the scope -> determine default path **`stock-docs/<scope-name>-milestones.md`**.
5. **Similar-file check (required before writing)**: list existing `*milestone*.md` files under `.Knowledge/stock-docs/` (including `*milestone.md`). If there is a file with the **same target path** or a **semantically similar** file (for example, another whole-project milestone such as `project-milestones.md`, or high overlap in prefix/scope keywords), **ask the user first**. Do **not** silently overwrite or invent a new filename:
   - **Overwrite**: keep the original path; the sub agent overwrites this file, and after verification it remains the final path.
   - **Generate another copy**: use a new path (recommended: scope summary + `_YYYYMMDD` + `-milestones.md`, or the user's specified `<summary>-milestones.md`), and update `outputPath` in the contract.
   - If no similar file exists, or only one file exists with exactly the target path and the user has already explicitly asked to "regenerate/overwrite" in this round, no further question is required; continue with the default path.
6. Restate to the user: scope, **final** `outputPath`, and number of topics read. If a similar-file question was asked, wait for the user's choice before continuing.
7. Assemble the "collection contract" (including final `outputPath` and topic node list) and **dispatch the sub agent** for Steps 1-2.

## Step 1: Collect Sources (Sub Agent)

- Complete **four-source** collection according to the contract. Git **must** compare tags and main version/semver transitions (based on this repository's `git tag` / `package.json`).
- Topic semantics: check whether capabilities from manifest/index align with git/req/task in the same window. Put temporarily unaligned items into internal notes for "Pending Confirmation".

If sources are empty: still generate the document and explain gaps under "Pending Confirmation"; **do not** fill deliverables from training data.

## Step 2: Apply Template and Write (Sub Agent)

**Generation principle: write for readers, not internal tooling.**

1. Document header: title `# (Scope Name) Milestones`, scope, and updated date only. **Do not write** a Sources line, topic paths, manifest names, commit hashes, npm publish status, environment status, or any other internal information.
2. **Newest first**: both the overview table and each `## Mx ·` section are ordered **latest phase first** (MN → … → M1). Each stage title must reflect a feature change; do not use "joint debugging / testing / acceptance" as a name (see "Stage Granularity").
3. Each stage body: list **delivered features only**, one item per line, verifiable. Do not include timing details, process narration, or background context.
4. **Pending Confirmation**: only list functional/delivery gaps or inconsistencies. **Do not** include internal operations, release, or environment status. Write "None" if there are no gaps.
5. Do not write the template's top explanatory blockquote.
6. **`Write`** to `outputPath`.

## Step 3: Verify (Main Agent, Required)

After the sub agent writes the draft, the main agent **must** verify whether **important nodes** are wrong, missing, or over-merged.

1. **Reread four-source essentials**: git tags/commits, req/task, and **index topic table + read topics**, then compare against the draft.
2. **Check against the important node checklist**:

| Category | What to Check |
| --- | --- |
| Version / tag | Major tags and `package.json` version transitions from the four sources are reflected in overview or Mx |
| Route/architecture turning point | Major directory restructuring or technology-route replacement in the four sources is reflected separately or merged appropriately |
| Feature delivery | Verifiable capabilities in req/git/task have corresponding stages in Mx |
| **Knowledge topics** | If manifest/index exists: topics related to the scope are covered or listed under "Pending Confirmation" |
| Task closure | If `.task/` exists: archived tasks are reflected in related Mx |
| Traceable basis | Each Mx deliverable can be traced to the four sources |
| Timeline | Ordering is reasonable; same-window multi-version changes are split if needed |
| **Ordering** | Overview table and all Mx sections are newest-first; reorder if not |
| **Stage granularity** | No Mx consists only of joint debugging/testing/acceptance/environment work without feature delivery; if found, **delete it or merge it** into an adjacent feature stage |
| **Internal information** | Document contains no Sources line, commit hashes, topic paths, or npm/environment status; **remove** if found |

3. Missing items -> add Mx (**must be feature changes**); errors -> correct according to the four sources; unknowns -> "Pending Confirmation" (**do not** replace unknowns with fake Mx).
4. Only after verification or revision is complete may Step 4 run.

## Step 4: Reply (Main Agent)

Report the disk path, stage count, one-sentence verification conclusion, and "Pending Confirmation" summary.

## Forbidden Items

- Do not use `subAgent` / `switchAgentVerification` to skip sub-agent generation or main-agent verification.
- Do not dispatch a sub agent or `Write` before the user chooses "overwrite / generate another copy" when a **similar milestone** already exists in `stock-docs/`.
- Do not use a second argument to change the output path (the path is determined by scope + similar-file choice). Do not write to `req-docs`.
- Do not write deliverables without reading the four sources. Do not let the sub agent claim completion before verification.
- Do not enumerate the entire `matchers/` directory or all topics as a substitute for "manifest + index + topics as needed".
- Do not use training data or milestone structures from other projects instead of the **current repository's** four sources. Do not write unrelated `stock-docs` documents outside this `outputPath`.
- Do not create standalone joint debugging / integration testing / UAT / acceptance / pure environment-ops Mx stages. Do not write "planned item" stages when there is no four-source feature delivery.
