[中文](../命令说明.md) | [English](./commands-reference.md)

# Workflow and Skill Reference

## Command Quick Reference

| Command | Purpose | Category |
|---|---|---|
| `/f2s-doc-arch` | Scan project, generate architecture draft | Doc Curation |
| `/f2s-doc-final` | Convert PDF / draft to standardized final-draft format | Doc Curation |
| `/f2s-kb-build` | Sync final drafts into knowledge base routing (topics / matchers / manifest) | Doc Curation |
| `/f2s-kb-add <path>` | Aggregate multi-file implemented capabilities into knowledge base | Doc Curation |
| `/f2s-kb-rm` | Remove knowledge topic and index mapping for a stock-docs document | Doc Curation |
| `/f2s-doc-pdf` | Convert PDF technical proposal to Markdown, save to req-docs | Doc Curation |
| `/f2s-req-clarify` | Clarify requirements via multi-round Q&A | Requirements |
| `/f2s-req-tech` | Generate technical proposal from clarified requirements | Requirements |
| `/f2s-req-plan` | Break a technical proposal into a task checklist and implement (always creates tasks, regardless of `changeTracking.*` config) | Requirements |
| `/f2s-git-commit` | Commit code; checks knowledge base coverage by default, skips that check in "quick commit" mode | Commit |
| `/f2s-kb-feat` | Add new capability + sync knowledge base | KB Maintenance |
| `/f2s-kb-fix` | Fix a bug + auto-sync knowledge base | KB Maintenance |
| `/f2s-kb-distill` | Extract reusable knowledge facts from Q&A and auto-commit to knowledge base | KB Maintenance |
| `/f2s-kb-sync` | Sink implemented capabilities from the conversation into the knowledge base | KB Maintenance |
| `/f2s-kb-merge` | Resolve knowledge base conflicts after a Git merge | KB Maintenance |
| `/f2s-kb-upgrade` | Upgrade knowledge base template, align manifest + matchers shards | KB Maintenance |

The table above lists conversation-triggered `/f2s-*` skills. The repository also provides shell commands: `flow2spec kb status / check / plan / apply / build` handles collaborative knowledge merges (see [§ 7](#7-flow2spec-kb-cli-for-collaborative-merges)), while `flow2spec doctor` performs a read-only project health check (see [§ 8](#8-flow2spec-doctor-project-health-check)).

---

## 1) Document Curation (stock-docs Pipeline)

### `f2s-doc-arch`

**Purpose**: Generates an architecture overview draft based on user descriptions or code scanning. No fixed format required; it should clearly describe the system structure, module relationships, and key decisions.

**How It Works**: Centered on inventory-driven scanning: the main agent first produces a module inventory and a scan contract (which entry points to read, which dimensions to focus on), then performs read-only code scanning according to that inventory, and finally aggregates the results into a human-readable architecture draft persisted under `stock-docs/`. The flow does not change code; it is one-way "code → document" extraction only.

**Use Cases**:
- A new project needs architecture documentation
- An existing project needs architecture descriptions supplemented
- Architecture descriptions need updating after a system refactor

**Relationships**:
- **Prerequisite**: None
- **Next Step**: `f2s-doc-final` (normalized final draft) → `f2s-kb-build` (**final draft input only**; do not run build on `_draft` / `_初稿` files)
- **Output**: `.Knowledge/stock-docs/<Architecture Overview>_draft.md`

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent scans the code and generates the output
- `subAgent: true`: Defaults to **B Mode** (main agent produces inventory + scan contract, sub-agents do parallel read-only table scans, main agent merges and persists); upgraded to **C Mode** (multi-round correction) when any of the following conditions are met: multi-workspace / monorepo, more than 20 source paths, first-round sub-tables have conflicts or gaps, or multi-source narratives have severe contradictions

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Produces inventory (entry points + core module names) and scan contract, aggregates sub-agent deliverables, persists stock-docs draft |
| Sub-Agent (B/C Mode) | Performs parallel read-only scans per the main agent's written inventory, delivers in a unified YAML schema (`source / scope / cross_refs / pending`), must not self-crop the scope |

---

### `f2s-doc-final`

**Purpose**: Converts PDF technical proposals or draft documents into the standardized "Final Draft Template" format, unifying the document structure for subsequent knowledge base ingestion.

**How It Works**: Unstructured or heterogeneous documents (PDF/drafts) are normalized against the built-in final-draft template: core concept tables, business rules, key flows, configuration, error handling, and other standard sections are extracted; missing section markers are filled in; the output is a consistently structured `_final.md`. The final draft is the standard input for `f2s-kb-build`, keeping knowledge-base entry structure uniform.

**Use Cases**:
- PDF technical proposals need conversion to Markdown
- Draft documents need normalization for long-term storage
- External documents need to be incorporated into Flow2Spec management

**Relationships**:
- **Prerequisite**: PDF document or draft document
- **Next Step**: `f2s-kb-build` (final draft imported into the knowledge base)
- **Output**: `.Knowledge/stock-docs/<Document>_final.md`

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent completes the full workflow
- `subAgent: true`: When the PDF exceeds 50 pages or 5MB, sub-agents may be used for template application and layout drafting; sub-agents must not ask the user questions, write process descriptions, or claim final-draft compliance; the main agent identifies format gaps and accepts the finalized draft

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Identifies format gaps, accepts the finalized draft against the template and clarification document |
| Sub-Agent | Applies templates and produces layout drafts; does not ask users questions or write process descriptions |

---

### `f2s-kb-build`

**Purpose**: Synchronizes documents from `stock-docs/` (architecture, final drafts) into the knowledge base routing system, generating/updating topic files, the index, manifest-routing, and matchers.

**How It Works**: Starting from a final-draft document, it runs a three-step "document → routing" mapping: (1) extract capability topics and keywords from the draft; (2) generate `topics/<topic>.md` (routing summary with execution boundaries and next-step pointers) and `matchers/<id>.json` (machine-readable `includeAny` terms); (3) register task→topic rules in `manifest-routing.json` and update the human-readable `index.md`. After that, the task routing engine can hit the topic via keywords.

**Use Cases**:
- After a final draft is complete, the knowledge base needs to "know about" these documents
- A new business domain needs routing mappings established
- Document content has been updated and the knowledge base index needs to be synced

**Relationships**:
- **Prerequisite**: `f2s-doc-arch`, `f2s-doc-final`, or a directly authored final draft
- **Next Step**: None (ready for use once imported into the knowledge base)
- **Input**: `.Knowledge/stock-docs/*.md`
- **Output**:
  - `.Knowledge/topics/<topic>.md`
  - `.Knowledge/index.md`
  - `.Knowledge/manifest-routing.json`
  - `.Knowledge/matchers/*.json`

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent processes each document sequentially
- `subAgent: true`: Enabled when changes exceed thresholds (more than 2 topics added/modified OR more than 1 matcher added OR cross-topic bulk reference adjustments); sub-agent A writes only to `topics/`, sub-agent B writes only to `matchers/`; the main agent handles single-point edits to `manifest-routing.json` and `index.md`; sub-agents must not cross boundaries

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Single-point persist of `manifest-routing.json` and `index.md`, overall acceptance |
| Sub-Agent (topics) | Writes only topic files under `topics/`, does not touch manifest or index |
| Sub-Agent (matchers) | Writes only shard files under `matchers/`, does not touch manifest or index |

---

### `f2s-kb-add`

**Purpose**: Parses already-implemented capabilities (aggregated from multiple files) into the knowledge base. Suitable when code already exists but lacks documentation, or when multiple documents need to be imported into the knowledge base in a unified manner.

**How It Works**: Aggregates capability descriptions from multiple scattered sources (code, config, loose docs) and runs the full "draft → final draft → topics/index/manifest" pipeline. Unlike `f2s-kb-build`, the input differs: `ctx-build` is driven from a single existing final draft; `doc-add` aggregates many scattered sources first, then follows the same pipeline. It closes the gap of "implementation exists but documentation does not."

**Use Cases**:
- Existing code needs knowledge base documentation
- Multiple related documents need aggregated import
- Bulk import of third-party documents

**Relationships**:
- **Prerequisite**: None (can be triggered directly)
- **Next Step**: None (ends once imported into the knowledge base)
- **Flow**: Draft -> Final Draft -> topics/index/manifest

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent processes sequentially
- `subAgent: true`: Enabled when any of the following thresholds are met; defaults to **B Mode** (main agent produces inventory, sub-agents do parallel read-only schema-based table fills, main agent merges and persists); upgraded to **C Mode** (multi-round correction) for multi-workspace / monorepo, first-round sub-table conflicts or gaps, or severe multi-source contradictions
  - Thresholds: 5 or more input paths OR single source exceeds 3000 lines OR total across multiple paths exceeds 10000 lines

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Produces inventory and scan contract, aggregates sub-tables, persists topics/index/manifest |
| Sub-Agent (B/C Mode) | Performs read-only scans per the main agent's written inventory, delivers tables in schema format (`source / scope / capabilities / cross_refs / pending`); must not self-crop the scope, write manifest or index, or claim "already in the knowledge base" |

**Cross-Verification (when `switchAgentVerification: true`)**:
- Topic files persisted by sub-agents -> Main agent verifies routing mapping completeness and keyword coverage
- Only effective when `subAgent: true` and sub-tasks are actually dispatched; otherwise all verification happens within the main agent

---

### `f2s-kb-rm`

**Purpose**: Deletes corresponding knowledge topics and index mappings based on `stock-docs` documents. Only removes reference relationships in the knowledge base, not the source documents themselves.

**How It Works**: The inverse of `f2s-kb-build` — given a `stock-docs` document path, locate its task→topic rules in `manifest-routing.json`, the corresponding `matchers/<id>.json` shard, `topics/<topic>.md`, and entries in `index.md`, and remove those references one by one. If a topic has no remaining task references after deletion, remove that topic file. Source documents are left in place; the user may delete them physically if desired.

**Use Cases**:
- A document is deprecated and needs removal from the knowledge routing
- A document was imported by mistake and its routing mapping needs revocation
- Cleaning up old mappings after document consolidation

**Relationships**:
- **Prerequisite**: A stock-docs document that has already been imported
- **Next Step**: None
- **Note**: Only deletes routing mappings, not source documents

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent handles the full workflow (single-point deletion has low sub-agent ROI)
- `subAgent: true`: Sub-agents are used only for **batch deletion of 5 or more topics**; the main agent must control scope confirmation and `fallbackTopic` re-pointing; `manifest-routing.json` and `index.md` are always persisted by the main agent

---

### `f2s-doc-pdf`

**Purpose**: Converts PDF technical proposals to Markdown format, saves to `req-docs/`, and can supplement the process description.

**How It Works**: Extracts structured content from the PDF (API definitions, data models, sequence flows, etc.) into Markdown under `req-docs/` for editing and follow-up with `f2s-req-clarify` / `f2s-req-tech`. Unlike `f2s-doc-final`, `doc-pdf` writes to `req-docs/`; `doc-final` writes to `stock-docs/` for `ctx-build`. **Not recommended** as a shortcut for "PDF straight to coding" without clarification and a technical proposal.

**Use Cases**:
- Cross-team deliverables are in PDF format and need conversion to editable Markdown
- Historical PDF proposals need to live under `req-docs/`
- Provide a readable draft before `f2s-req-clarify` / `f2s-req-tech`

**Relationships**:
- **Prerequisite**: PDF document
- **Output**: `.Knowledge/req-docs/<Proposal>.md`
- **Next Step** (recommended): `f2s-req-clarify` → `f2s-req-tech` → implement from the technical proposal MD via `implement-tech-design`; for knowledge base archival use `f2s-doc-final` → `f2s-kb-build`

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent completes the full workflow
- `subAgent: true`: When the PDF exceeds 50 pages or 5MB, sub-agents may be used for the PDF -> MD first draft and persist to `req-docs`; sub-agents must not ask the user questions or supplement process description sections; the main agent handles follow-up questions and process description supplementation

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Asks the user for process description supplements, completes `req-docs` deposition acceptance |
| Sub-Agent | Only performs PDF -> MD first draft and persists to `req-docs`, does not ask the user questions |

---

## 2) Requirements and Proposals

### `f2s-req-clarify`

**Purpose**: Asks clarifying questions against PRDs/requirement documents, using multi-round Q&A to define requirement boundaries, non-goals, and key flows, until the requirements are clear enough for a technical proposal.

**How It Works**: Uses a "structured questioning" strategy — decomposes the requirement document along six dimensions (roles, scenarios, flows, boundaries, exceptions, non-goals), checks each for vague wording, undefined concepts, or contradictions, and generates targeted questions for each gap. Dialogue continues until all dimensions are unambiguous, then outputs a clarification record as input for `f2s-req-tech`. It turns unstructured PRDs into structured, actionable requirement constraints.

**Use Cases**:
- First step after receiving a PRD, ensuring correct understanding
- When requirement boundaries are fuzzy or acceptance criteria are missing
- Cross-team collaboration requirements that need clear interface contracts

**Relationships**:
- **Prerequisite**: None (can be triggered directly)
- **Next Step**: `f2s-req-tech` (generates a technical proposal after clarification)
- **Output**: Requirement clarification record (optionally saved to `.Knowledge/req-docs/`)

**Sub-Agent Invocation**: None (clarification relies on continuous dialogue and immediate user feedback throughout; no sub-agent splitting)

---

### `f2s-req-tech`

**Purpose**: Based on clarified requirements and the project knowledge base, generates an implementation-ready technical proposal. The content is selected by scenario: APIs, pages/components, scripts/tools, data processing, configuration, events, or module changes.

**How It Works**: Centered on "knowledge base constraints + template-guided" authoring — first pull a constraint summary for the current project from `topics/stock-docs` (architecture conventions, contract style, data and module boundaries, etc.), then choose only the relevant blocks from the technical proposal template. Do not force API, database, error-code, or message-queue sections just to fit the template. Output is persisted under `req-docs/` as the coding contract for `implement-tech-design`.

**Use Cases**:
- After `f2s-req-clarify` completes, output a proposal based on clarification results
- When clear requirement documents already exist, directly generate a technical proposal

**Relationships**:
- **Prerequisite**: `f2s-req-clarify` (recommended) or a clear requirement document
- **Output**: `.Knowledge/req-docs/<Technical Proposal>.md`
- **Next Step**: Provide the technical proposal path with instructions "implement according to the technical proposal", driven by the `implement-tech-design` rule

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent completes the proposal within the session
- `subAgent: true`: The main agent must first extract a project convention summary (under 80 lines) from topics/stock-docs (covering architecture conventions, API style, data model standards, etc. across 6 categories) as the mandatory sub-agent context, then dispatch sub-agents to write the `req-docs` draft in parallel; the main agent handles contract finalization and acceptance

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Extracts project convention summary, assigns writing tasks, finalizes the draft against the template, and writes to `req-docs` |
| Sub-Agent | Read-only access to multiple sources (topics / stock-docs / clarified req-docs / templates), writes `req-docs` draft per template; must not expand the read scope on its own |

**Cross-Verification (when `switchAgentVerification: true`)**:
- Draft proposals persisted by sub-agents -> Main agent verifies consistency across deliverables, data structures, processing flows, error handling, and project conventions
- Only effective when `subAgent: true` and sub-tasks are actually dispatched; otherwise all verification happens within the main agent

---

### `f2s-req-plan`

**Purpose**: Starting from a technical proposal or requirement description, **always creates a task checklist**, then implements the code accordingly. Does not depend on the `changeTracking` configuration; represents the user's explicit need for traceable task management.

> **About task checklists**: Task checklists are not exclusive to `/f2s-req-plan`. `/f2s-kb-feat`, `/f2s-kb-fix`, and `implement-tech-design` also create task checklists automatically when the corresponding `changeTracking.*` field is set to `true` in `flow2spec.config.json`. The distinction of `/f2s-req-plan` is that it **always creates a checklist regardless of any config** — suited for large features where the user explicitly wants to track progress across sessions.

**How It Works**: Runs a five-phase closed loop: parse → plan → confirm → implement → archive. (1) Parse the technical proposal for implementation points; (2) split into executable tasks at module/feature granularity and write to `.task/`; (3) show the draft to the user, lock the checklist after confirmation; (4) implement item by item, checking off `task.md` immediately when each item completes; (5) archive when all are done. Unlike the `implement-tech-design` rule, `req-plan` always carries task tracking and can parallelize implementation with sub-agents for large work; the rule path is lightweight, single-threaded coding.

**Use Cases**:
- A technical proposal document exists and needs to be broken down into a task list before implementation
- The requirement description is complex and the user wants to confirm the checklist before starting work
- The user wants to track implementation progress across sessions

**Relationships**:
- **Prerequisite**: Technical proposal document path (`.Knowledge/req-docs/*.md` or PDF) or requirement/change description
- **Output**: `.task/active/<task-name>/task.md` + `context.md`; implementation code
- **Next Step**: Optionally invoke `f2s-kb-sync` to supplement the knowledge base

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent completes parsing, confirmation, and implementation in full
- `subAgent: true`: Step 1 (document parsing) can dispatch sub-agents for parallel read-only; Step 2 (draft confirmation) must be done by the main agent; Step 4 (code implementation) can dispatch sub-agents per module; `todo.json` is always written by the main agent

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Outputs draft, gets user confirmation, writes `todo.json`, aggregates implementation summary |
| Sub-Agent (parsing) | Read-only document parsing, outputs parsing result summary, does not persist |
| Sub-Agent (implementation) | Implements code per module, does not touch `.task/` or `.Knowledge/` |

---

## 3) Git Commit

### `f2s-git-commit`

**Purpose**: Executes a Git commit after code is written. By default it checks changed files and knowledge base coverage, prompting the user about capabilities not yet imported. If the user explicitly asks for a "quick commit", it skips the knowledge base coverage check. Before committing, it displays the commit message subject and then runs `git commit`.

**How It Works**: Layers a "knowledge base coverage gate" on top of `git commit` — infer touched capability areas from `git diff`, cross-check against `.Knowledge/topics/` and `stock-docs/`, and decide whether changed capabilities are documented in the knowledge base. If not covered, block and offer three choices (document first / skip / cancel) to avoid silent drift where "code exists but the knowledge base does not know." Quick commit mode only skips this coverage gate; it does not skip conflict checks, message display, precise `git add`, or git hooks. Commit messages use emoji + Conventional Commits for consistent, machine-friendly `git log`.

**Use Cases**:
- Committing code after each feature implementation or bug fix
- Wanting reminders about knowledge base coverage at commit time
- Explicitly wanting to skip this commit's coverage check with a quick commit
- Needing AI help to generate meaningful commit messages

**Relationships**:
- **Prerequisite**: Code has been written (after `implement-tech-design`, `f2s-kb-fix`, `f2s-kb-feat`, etc.)
- **Next Step**: None (ends when commit completes; does not auto-push)
- **Bridging**: If the knowledge base is not yet covered, you can first run `f2s-kb-sync` or `f2s-kb-feat` to supplement before committing

**Execution Flow**:
1. `git status --short` + `git diff HEAD` to classify files into staged / unstaged / untracked; immediately terminates if merge conflict markers are found
2. By default, compare `.Knowledge/topics/` and `stock-docs/` to determine whether the changed capabilities have been imported; skips and notifies if `.Knowledge` does not exist; skips this step when the user asks for a quick commit
3. If not covered, prompt the user to choose: A) Import first, then commit / B) Commit now, import later / C) Cancel
4. Generate a commit message draft based on `git diff` content, wait for user confirmation or changes
5. `git add <specific files>` + `git commit`; if a hook fails, prompt for fix, do not skip
6. Output the commit hash; if option B was selected, include a reminder about capabilities not yet imported

**Constraints**:
- `git add -A` / `git add .` is forbidden; only add confirmed changed files
- `--no-verify` is forbidden; hook failures must be fixed and retried
- Auto-push is forbidden
- The commit message subject must be displayed before committing; an extra user confirmation round is not required

**Sub-Agent Invocation**: None (full interactive confirmation, handled within the main agent)

---

## 4) Knowledge Base Maintenance

### `f2s-kb-fix`

**Purpose**: Fixes code based on implementation or rule errors reported by the user, and **by default automatically syncs** the knowledge base documents and index.

**How It Works**: Three steps: locate → fix → sync. From the user's description, locate context and code via the knowledge routing path (manifest → topic → stock-docs) and confirm root cause; after fixing code, automatically check whether related descriptions in `topics/stock-docs/matchers` need updates and revise in place if so (current truth only, no stacked historical negation). "Fix code, sync docs" is the core principle to prevent knowledge drift.

**Use Cases**:
- Code implementation does not match the technical proposal
- Rule understanding errors need correction
- Documentation needs to be synced after bug fixes

**Change Tracking**: If `changeTracking.fix: true`, automatically checks `.task/todo.json` before execution, creates a task checklist, and automatically archives upon completion; cross-session continuation via keywords is supported (see `f2s-task` rules).

**Relationships**:
- **Prerequisite**: Problem discovered (code implementation error or rule deviation)
- **Next Step**: None (ends when fixes and sync are complete)
- **Feature**: No need for the user to explicitly request "please sync the knowledge base"; it is done automatically

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent completes fixes and knowledge base sync
- `subAgent: true`: Code sub-packages (bug fixes) can be outsourced to sub-agents; documentation sub-packages (rules/skills/topics style-related) default to the main agent writing directly; if sub-agents are used, they only output before/after diff snippets, not full-file rewrites; manifest and index are always persisted by the main agent

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Locates root cause, devises fix plan, persists style-compliant content, verifies knowledge base consistency |
| Sub-Agent (code) | Responsible for bug fixes in designated modules, outputs changes and reports impact scope |
| Sub-Agent (documentation, optional) | Only outputs before/after diff snippets, no full-file rewrites, does not touch manifest or index |

**Cross-Verification (when `switchAgentVerification: true`)**:
- Code changes persisted by sub-agents -> Main agent verifies fix correctness and knowledge base consistency
- Knowledge base sync persisted by the main agent -> Sub-agent reviews topic/manifest consistency (requires `subAgent: true` and sub-tasks actually dispatched; otherwise self-verification within the main agent)
- The reviewer and the persister must be different agent instances

---

### `f2s-kb-feat`

**Purpose**: When adding a new capability, completes both the implementation and the knowledge base; if the capability is already implemented, only syncs the knowledge base.

**How It Works**: Three phases: assess → implement → ingest. First assess whether the described capability is not implemented, partially implemented, or already implemented in code; if not or partial, complete the code first; then sync the knowledge base: write a capability description in `stock-docs`, generate or update `topics` summaries, register routing in `manifest-routing` and `matchers`. Unlike `f2s-kb-fix`, `kb-feat` targets **new** work; `kb-fix` targets **correcting existing** work.

**Use Cases**:
- New feature development
- Adding knowledge base documentation for an existing feature

**Change Tracking**: If `changeTracking.feat: true`, automatically checks `.task/todo.json` before execution, creates a task checklist, and automatically archives upon completion; cross-session continuation via keywords is supported (see `f2s-task` rules).

**Relationships**:
- **Prerequisite**: None (can be triggered directly)
- **Next Step**: None (ends when implementation + sync are complete)
- **Feature**: Knowledge base sync is automatic; no additional user request needed

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent completes everything
- `subAgent: true`: Code sub-packages (new implementation) can be outsourced to sub-agents; documentation sub-packages (rules/skills/topics style-related) default to the main agent writing directly; if sub-agents are used, they only output before/after diff snippets; manifest and index are always persisted by the main agent

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Defines capability boundaries and implementation scope, persists style-compliant content, performs final verification of knowledge base consistency |
| Sub-Agent (code) | Responsible for code implementation (APIs, logic, data layer), outputs implementation checklist |
| Sub-Agent (documentation, optional) | Only outputs before/after diff snippets, no full-file rewrites, does not touch manifest or index |

**Cross-Verification (when `switchAgentVerification: true`)**:
- Topics persisted by documentation sub-agents -> Main agent verifies consistency between the capability description and the implementation code
- Only effective when `subAgent: true` and sub-tasks are actually dispatched; otherwise all verification happens within the main agent

---

### `f2s-kb-distill`

**Purpose**: Extracts reusable knowledge facts from a Q&A session and automatically commits them to the knowledge base; decides whether to create a new topic or supplement an existing one based on drill-down depth and matched topics.

**How It Works**: After the Agent answers a user question by drilling into source code, this skill analyzes the current conversation for reusable knowledge facts (core mechanisms, state transitions, return-value contracts, config-switch effects, failure fallback strategies, module boundaries, etc.) and determines whether they are already covered in the knowledge base. Uncovered facts are written to a new or extended topic; covered facts that lack detail get supplemented. Distinction from `f2s-kb-sync`: `sync` is for batch syncing multiple capabilities; `distill` focuses on incremental knowledge extraction driven by a single Q&A.

**Execution Tiers (agent auto-judges, no command parameter)**:

| Tier | Skips | Applies when |
| --- | --- | --- |
| **Light tier** | Step 2.1 (quantitative drill-down scoring) / 2.4 (existing topic description-depth eval) / 3 (decision matrix) / 4.1 (reading neighboring topics for style alignment) | Upstream already gave a definite ingestion conclusion + this turn's knowledge is light + user did not reject the upstream conclusion |
| **Strict tier** | Nothing — runs the full 6 steps | Any of the three conditions above is not met |

**Tier judgment (all 4 dimensions must be satisfied for light tier)**:

| Dimension | Condition |
| --- | --- |
| Upstream `f2s-kb-feedback-closing` case | **case 2 or case 3** (case 1 / no closing block → strict tier) |
| Business source files Read this turn | **≤ 3 files** |
| Function / class names cited in this turn's reply | **≤ 5** |
| Did the user reject the upstream conclusion in a follow-up? | **No** |

**Business source defined**: a Read whose path is **not** under `.claude/` / `.cursor/` / `.codex/` / `.Knowledge/` / `.task/` counts.

**Why this design**:

- "Upstream already gave a definite conclusion" → the decision matrix can be skipped; we just adopt the "this round will ingest" summary
- "This turn's knowledge is light" → no risk of the "description-depth mismatch ≥ 2 levels" incident (light supplements are naturally at the same level as the existing topic)
- "User did not reject" → the upstream conclusion itself is not invalidated

**Steps 5 / 6 never skipped**: regardless of tier, **routing / matcher / index sync** and **write + self-check** always run in full — these are hard correctness constraints.

**Use Cases**:
- After a Q&A drills into source code and the topic doesn't cover it or lacks detail
- Automatically suggested by the `f2s-kb-feedback-closing` rule
- User wants to persist the conclusions of a Q&A session into the knowledge base

**Relationships**:
- **Prerequisite**: A Q&A session that included source code drill-down (context auto-extracted from conversation history)
- **Next Step**: None (ends when ingestion is complete)
- **Feature**: Only maintains `.Knowledge/`; does not touch `rules/skills` config root

**Sub-Agent Invocation**: None (single-round focused task; completed by the main agent end-to-end)

---

### `f2s-kb-sync`

**Purpose**: Sinks already-implemented capabilities from the conversation back into the knowledge base. Can accept an explicit capability description or infer with zero input.

**Use Cases**:
- Implementation is complete within the conversation and needs knowledge base documentation
- Reverse-documenting knowledge from code
- Periodic knowledge base organization

**Relationships**:
- **Prerequisite**: None (can be triggered directly, or with zero-input inference)
- **Next Step**: None
- **Feature**: First outputs a knowledge base update outline, then writes only after user confirmation
- **Difference from `f2s-kb-build`**: `ctx-build` is driven from `stock-docs`; `kb-sync` infers from the conversation/code

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent completes inference and sync
- `subAgent: true`: Steps are split -- **Step 1** (aggregation and inference) can dispatch sub-agents for parallel read-only access to conversation history; **Step 2** (user confirmation of the outline) must be done by the main agent; **Step 3** (persist sync) can dispatch sub-agents to write topic/matcher files, but sub-agents must read 2-3 neighboring topic summaries for style alignment before persisting; manifest and index are always persisted by the main agent

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Outputs outline and gets confirmation, single-point persists manifest and index, final acceptance |
| Sub-Agent (aggregation) | Read-only access to conversation history, infers capability points, generates structured update outline fragments |
| Sub-Agent (sync) | Writes topic/matcher per outline, loads neighboring topic summaries for style alignment before persisting, does not touch manifest or index |

**Cross-Verification (when `switchAgentVerification: true`)**:
- Topics/matchers persisted by sync sub-agents -> Main agent verifies cross-topic routing completeness and `includeAny` keyword coverage
- Only effective when `subAgent: true` and sub-tasks are actually dispatched; otherwise all verification happens within the main agent

---

### `f2s-kb-merge`

**Purpose**: Resolves editor context conflicts after Git merges. An optional conflict file path can be provided.

**How It Works**: Layered by file kind — split conflict files into "safe to auto-merge" (structured files such as index, manifest, matchers, using union or latest) vs "needs user judgment" (implementation code, business rules, and other semantic files). Auto-resolve the former; for the latter, produce a comparison table (ours/theirs summary + recommendation) and list differences for the user to decide item by item. Design idea: knowledge-base metadata can be automated; business semantics must not be decided unilaterally.

**Use Cases**:
- Context conflicts arise after a Git merge/rebase
- Knowledge base file conflicts caused by multi-person collaboration
- Need to unify knowledge base state after branch merging

**Relationships**:
- **Prerequisite**: Conflicts generated by a Git merge
- **Next Step**: None (ends when conflicts are resolved)
- **Feature**: Implementation-side conflicts are only listed for the user to confirm

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent analyzes and resolves conflicts
- `subAgent: true`: Sub-agents can be dispatched for conflict scanning and classification into a comparison table (`file / category / ours_summary / theirs_summary / recommendation`); sub-agents must not merge files on their own; the main agent persists per strategy, handles implementation-side decisions, and completes acceptance

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Persists merge results per strategy, handles implementation-side conflict decisions, acceptance |
| Sub-Agent | Only performs conflict scanning and classification, delivers comparison table in the five-field schema, does not merge files on its own |

---

### `f2s-kb-upgrade`

**Purpose**: Knowledge base template upgrade. Aligns manifest-routing and matchers shards.

**How It Works**: Uses "version branching + delegated init" — detect whether the current knowledge base is V1 (legacy structure) or V2+ (already has `.Knowledge`): V1 no longer has built-in migration support — the skill stops and tells the user how to proceed (one-time migration with a historical package version, or manual move into `.Knowledge`); V2+ runs `flow2spec init` directly for incremental package alignment (new templates, manifest schema upgrades, matcher shard format alignment). After upgrade, re-read SKILL.md to see if certain steps must be re-run. Unlike a standalone `init`, `kb-upgrade` includes version routing and re-run logic; `init` alone is a one-shot structural fill-in. For **non-topic version updates** (`projectRev == pkgRev` after init), the agent may directly run `flow2spec init` on the user's behalf without entering this skill's full flow.

**Use Cases**:
- After a `flow2spec` package version upgrade, upgrade the project knowledge base template
- Upgrade an old project to the latest structure
- When interactive `flow2spec version` / `flow2spec init` detects a newer npm version, the CLI prompts you to run `flow2spec update`, then execute this skill in the Agent conversation
- When Cursor detects an older knowledge-base version through `.cursor/hooks.json` on `sessionStart`, it prompts you to execute this skill
- When Codex detects an older knowledge-base version through `.codex/hooks.json` on `SessionStart`, it prompts you to execute this skill (new or changed hooks must be trusted through `/hooks` first)

**Relationships**:
- **Prerequisite**: an existing `.Knowledge/` (legacy V1 structures no longer have automatic migration support)
- **Includes**: Internally invokes `flow2spec init` for structural alignment
- **Note**: A standalone `flow2spec init` is **not** an upgrade command

**Flow Differences (in-skill routing codes, **not** equivalent to npm major versions)**:
- **V1**: Built-in migration is no longer available; the skill stops and tells the user how to proceed (one-time migration with a historical package version / manual move into `.Knowledge`)
- **Current Knowledge Base (V2+)**: When `.Knowledge` + `manifest-routing` are already stable, runs `flow2spec init` to align manifest-routing + matchers shards (**includes Flow2Spec npm v3.x, etc.**; see `skills/f2s-kb-upgrade/SKILL.md` Step 0 for details)

**Sub-Agent Invocation**:
- `subAgent: false` (default): The main agent completes the upgrade
- `subAgent: true`: Sub-agents only handle shell command execution (running `flow2spec init`), not knowledge base content persistence; the following steps must not be delegated by the main agent: version routing (V1 / Current V2+), re-reading SKILL.md after init and determining a full skill re-run, Step 3b index.md consolidation, verification summary output

**Responsibility Matrix**:
| Role | Responsibilities |
|------|-----------------|
| Main Agent | Version routing, re-reading and determining re-run after init, Step 3b index.md consolidation, verification summary; persists `manifest-routing.json` and `index.md` |
| Sub-Agent | Only runs shell commands like `flow2spec init`, does not persist knowledge base content |

**Cross-Verification**: This skill is not bound to cross-verification; self-verification by the persisting side.

---

## 5) Rule Descriptions

The following are not skill commands but rules activated by trigger words to guide Agent behavior.


---
---

### `f2s-task`

**Trigger Words**: changeTracking, change tracking, task tracking, continuation, continue last task

**Purpose**: Change tracking rules (`alwaysApply`). When the corresponding skill's `changeTracking.*` is set to `true`, automatically creates, progressively updates, and finally archives task checklists under `.task/` before and after skill execution, supporting cross-session continuation.

**How It Works**: Cross-session persistence via "disk checkpoints + keyword matching" — each active task records progress with checkboxes (`[ ]` / `[x]`) in `.task/active/<name>/task.md`, with `todo.json` as the active-task index. At the start of a new session, the rule fuzzy-matches the user's first message to each task's `keywords`; on a match, it loads the remaining steps in `task.md` and the skill file for `linkedSkill`, restoring full execution context. Completed tasks move to `completed/`. Design: the file system, not chat memory, is the source of truth so interrupted sessions do not lose progress.

**Scope**:

| Config Item | Corresponding Skill |
|-------------|-------------------|
| `changeTracking.feat` | `f2s-kb-feat` |
| `changeTracking.fix` | `f2s-kb-fix` |
| `changeTracking.implement` | `f2s-implement-tech-design` |

**Cross-Session Continuation**: When a new session starts and `.task/todo.json` exists, automatically matches the user's first message against each task's `keywords`; on a match, loads the corresponding `task.md` and `linkedSkill` skill file, displays the remaining checklist, and asks whether to continue; if there is no match, proceeds without interruption.

**Rule Location**: `Config Root/rules/f2s-task.*`

---


---
---

### `implement-tech-design`

**Trigger Words**: implement according to technical proposal, implement-tech-design, implement per proposal

**Purpose**: Implements runnable code based on technical proposal documents in `req-docs/`.

**How It Works**: "Proposal as contract" — the agent treats the technical proposal in `req-docs/` as the sole coding contract and must follow the mandatory six-step pipeline: understand proposal → output task list → ask clarifying questions before coding → implement step by step → output remaining work and post-implementation reminders. The task list and pre-implementation Q&A are non-skippable gates so coding does not start on a misunderstood spec. Unlike `f2s-req-plan`, this rule is lightweight single-threaded coding and does not force `.task/` tracking unless `changeTracking.implement: true`.

**Change Tracking**: If `changeTracking.implement: true`, after outputting the task list in Step 2.5, synchronously writes to `.task/active/<task-name>/task.md`; archives the task in Step 5 during wrap-up.

**Use Cases**:
- Technical proposal is ready and needs to be coded per the proposal
- After a proposal change, code needs to be updated accordingly

**Relationships**:
- **Prerequisite**: `.Knowledge/req-docs/<Technical Proposal>.md` (via `f2s-req-tech` or manual placement)
- **Rule Location**:
  - Cursor: `.cursor/rules/f2s-implement-tech-design.mdc`
  - Claude: `.claude/rules/f2s-implement-tech-design.md`
  - Codex: `.codex/AGENTS.md` + `.codex/topics/f2s-implement-tech-design.md`

**Execution Flow (mandatory by rules)**:
1. Input normalization
2. Understand the proposal and context
3. **Output the implementation task list** (required, cannot be skipped)
4. **Ask questions before implementing** (required, cannot be skipped)
5. Implement per task list
6. **Output the remaining checklist and post-implementation reminders** (required)

**Sub-Agent Invocation**: None (rule-driven coding; the main agent completes the full workflow)

---

## 6) Sub-Agent Configuration

Controlled via `flow2spec.config.json` at the project root. Defaults: `subAgent=false`, `switchAgentVerification=false`, `changeTracking.feat=true`, `changeTracking.fix=false`, `changeTracking.implement=true`.

### How Different Products "See" the Configuration (use with the field table below)

`subAgent` and similar fields are written to the **on-disk JSON**; products do not guarantee automatic file opening. Therefore, multi-layered hints are provided via **Cursor rules / Claude SessionStart summary + PreToolUse guard / Codex SessionStart summary + AGENTS field-semantics table / knowledge base `config-precheck` summary**, but **the authoritative source remains `Read("flow2spec.config.json")`** (design rationale in [design-principles.md — Agent Orchestration § 5.1](./design-principles.md); talk / deck pacing in [intro deck HTML](../../presentations/flow2spec-intro-public-en/index.html) (internal); Chinese source in `flow2spec-intro-draft`, config section). **The full path and table are maintained in one place**: [usage-guide.md Sec. 1, `f2s-*` and `flow2spec.config.json`](./usage-guide.md).

### `subAgent` Field

| Value | Behavior |
|-------|----------|
| `false` (default) | All `f2s-*` skills complete within the main agent |
| `true` | Certain skills may use sub-agents per their documentation (large-scale parallel processing scenarios) |

### `switchAgentVerification` Field

| Value | Behavior |
|-------|----------|
| `false` (default) | Self-verification on the persisting side: whoever persists verifies |
| `true` | When a skill explicitly states this step, enables cross-verification: sub-agent persists -> main agent verifies; main agent persists -> sub-agent verifies (requires `subAgent: true` and sub-tasks actually dispatched) |

### `changeTracking` Field

A nested object, with each skill independently controlled:

```json
{
  "changeTracking": {
    "feat": true,
    "fix": false,
    "implement": true
  }
}
```

| Sub-field | Corresponding Skill | Effect |
|-----------|---------------------|--------|
| `feat` | `f2s-kb-feat` | Creates a task checklist before execution, archives on completion, supports cross-session continuation |
| `fix` | `f2s-kb-fix` | Same as above |
| `implement` | `f2s-implement-tech-design` | Same as above |

> `f2s-req-plan` is not constrained by this configuration; it always creates a task checklist. Legacy boolean values (`"changeTracking": true/false`) are backward-compatible and automatically expand to all three sub-fields on/off.

For full principles and design intent, see [architecture.md Sec. 7. Agent Execution Model](./architecture.md).

---

## 7) `flow2spec kb` CLI for Collaborative Merges

Unlike `/f2s-*` skills invoked in chat, `flow2spec kb *` runs in the shell. Skills describe the intended knowledge change in `.task/<id>/active/<task>/kb-delta.json`; the CLI validates and merges that change into `.Knowledge/`.

| Command | Purpose | Writes files |
| --- | --- | --- |
| `flow2spec kb status` | Report routing drift, topic health, and deltas under the current `TASK_ROOT` | No |
| `flow2spec kb check [--strict]` | Validate manifest, topics, frontmatter, and revisions; exit 1 on issues | No |
| `flow2spec kb plan <delta.json>` | Dry-run a delta and report revision conflicts | No |
| `flow2spec kb apply <delta.json>` | Re-plan, then write topics and routing when mergeable | Yes |
| `flow2spec kb build [--fix-topics]` | Normalize routing metadata from topic frontmatter; optionally add revisions to legacy topics | Yes |

All five support `--json`. `status` and `check` use exit codes `0` for healthy and `1` for issues, so they can run in CI.

### `kb-delta.json`

```json
{
  "taskId": "add-payment-rule",
  "developerId": "alice",
  "baseRevisions": { "topic-a": 3 },
  "changes": [
    { "targetTopic": "topic-a", "type": "appendBody", "content": "..." },
    { "targetTopic": "topic-c", "type": "createTopic", "content": "...", "frontmatter": { "title": "Topic C" } }
  ]
}
```

`baseRevisions` records the topic versions read when the delta was written. A mismatch at plan/apply time blocks disk writes. Accepted change types are `appendBody`, `replaceBody`, `updateFrontmatter`, and `createTopic`; append/replace content must be non-blank. `apply` owns revision increments.

Knowledge skills produce the delta; the CLI owns the merge boundary. `f2s-git-commit` can run the full sequence automatically when it finds one unambiguous, mergeable delta. A revision mismatch is resolved by pulling and rewriting the delta against the latest topic. `f2s-kb-merge` is for Git conflict markers such as `<<<<<<<`, not stale `baseRevisions`.

See [Team Collaboration](./team-collaboration.md) for the operating model and [Architecture § 6](./architecture.md) for the design rationale.

---

## 8) `flow2spec doctor` (Project Health Check)

`flow2spec doctor` provides one command for diagnosing why Flow2Spec is not behaving as expected. It is read-only, does not access the network, and never modifies project configuration or knowledge files.

```bash
flow2spec doctor
flow2spec doctor --json
```

It checks:

- whether Node.js satisfies the package's `engines.node` requirement
- whether `flow2spec.config.json`, root `AGENTS.md`, and `.Knowledge/manifest-routing.json` exist and are usable
- whether detected `.codex`, `.claude`, and `.cursor` roots contain their required entry and hook files
- the resolved `developerId`, source, and `TASK_ROOT`; falling back to the legacy `.task/` root produces a warning
- whether the root `.gitignore` ignores `.task/`
- strict knowledge graph health, topic revisions, and routing metadata drift

Human-readable output marks each check with `[PASS]`, `[WARN]`, or `[FAIL]` and includes a repair suggestion when applicable. `--json` returns a stable `ok / package / cwd / summary / checks` structure for CI and scripts.

Warnings alone return exit code `0`; any error returns `1`. Unknown flags such as `--fix` fail immediately. To repair legacy topics without a `revision`, follow the reported commands:

```bash
flow2spec kb build --fix-topics
flow2spec kb check --strict
```

---

## 9) Quick Reference

For typical work scenarios and full workflows, see [Usage Guide § 3. Typical Workflows](./usage-guide.md).

For a complete directory description, see [Directory Conventions](./directory-conventions.md).

---

Related Documents:
- [Flow2Spec Introduction](./Flow2Spec-Introduction.md)
- [Usage Guide](./usage-guide.md)
- [Directory Conventions](./directory-conventions.md)
- [Architecture](./architecture.md)
- [Usage Scenarios](./usage-scenarios.md)
- [Team Collaboration](./team-collaboration.md)
- [Project Milestones](./milestones.md)
