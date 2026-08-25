---
name: f2s-kb-build
description: Generate knowledge-routing topics and indexes from `.Knowledge/stock-docs` documents; triggers: 生成项目上下文、f2s-kb-build、终稿生成上下文、generate project context、build knowledge context
---

> Execution scope: this skill only maintains `.Knowledge` (`topics/index/manifest-routing/matchers` shards) and does not modify the configuration-root `rules/skills`. It no longer maintains `.Knowledge/manifest-matchers.json` (deprecated aggregate file; `flow2spec init` deletes legacy copies).

# Generate Project Context from Documents (topics/index/routing manifest)

## Orchestration (main / sub-agent)

- The meaning of `subAgent` / `switchAgentVerification` uses the unified entry as the only source of truth: **Cursor/Claude** read the configuration-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`). This SKILL does not repeat those definitions.
- **Preferred branch (small change -> main-only workflow)**: when this change has **<= 2 new/modified topics**, **<= 1 new matcher**, and **no batch cross-topic reference adjustment**, the main agent completes the full workflow without splitting.
- **Medium/large change branch** (`subAgent=true` and above threshold):
  - The main agent lists a **file-level contract** in the main session: sub-agent A only writes `.Knowledge/topics/<foo>.md`, sub-agent B only writes `.Knowledge/matchers/<m-foo>.json`, and paths do not overlap.
  - Sub-agents only write files inside their contract and do not cross boundaries.
  - The **main agent alone** edits `.Knowledge/manifest-routing.json` / `.Knowledge/index.md` (adding `taskToTopicRules`, `topicPaths`, `matcherPath`, `topicDependencies`, `topicMetadata`).
  - The main agent performs overall verification.
- **Not recommended**: one sub-agent modifying manifest / index / multiple topics / matchers at the same time; or "sub-agent A writes, sub-agent B verifies".
- **"One sub-agent writes, main verifies"**: acceptable only when the delivery boundary is extremely narrow, for example only producing one new matcher-shard draft while the manifest reference is still written by the main agent.
- **Write-authority hard rule**: `.Knowledge/manifest-routing.json` (including `topicMetadata`) / `.Knowledge/index.md` are **always written by the main agent**; sub-agents must not touch them.
- By default, the writing side verifies its own work; this SKILL does not bind cross-agent verification.

## Input

- Accepts one argument: a URL or local path.
- Local paths must be under `.Knowledge/stock-docs/`.
- **Must be a final draft**: recommended filename contains `_final.md`, or has been normalized by **`f2s-doc-final`**. It is **forbidden** to execute this skill directly with a `*_draft.md` produced by `f2s-doc-arch`.
- If the input path contains **`_draft`**, or the user has just completed an architecture draft but has not run `f2s-doc-final`: **stop** and reply that they must first run **`f2s-doc-final <draft-path>`**, then call this skill with the final-draft path after it is written.
- If `.Knowledge/req-docs/` is passed, tell the user to organize it into a `stock-docs` final draft before executing.

## Generation Principles

1. **Split**: when the document is long or contains multiple independent capabilities, split it into multiple topics; avoid putting unrelated capabilities into one topic.
2. **Responsibilities**:
  - `topics/`: rule and workflow body (executable knowledge)
  - `index.md`: topic index and semantic explanation (human entry)
  - `manifest-routing.json` + `matchers/*.json` pointed to by `taskToTopicRules[].matcherPath`: task routing and keyword dictionaries (machine-readable entry)

## Step 1: Get Document Content

- URL: fetch the body; if inaccessible, ask the user to first save it as `.Knowledge/stock-docs/*.md`.
- Local path: read the Markdown document and extract topics and capability boundaries.

## Step 2: Semantic Analysis (Required)

Extract from the document:

- Topic name and topic intent (can form a topic id)
- Core concepts and key flows
- Business rules and boundary conditions
- Task trigger terms (write to the corresponding `matchers/<matcherId>.json` `includeAny`)
- Dependencies on existing topics (for `topicDependencies`)

> **Authoring-side guideline**: this step involves adding/modifying topics and `topicDependencies`, so first Read the full `rules/f2s-topic-authoring.*` (**Cursor/Claude**: `rules/f2s-topic-authoring.mdc`; **Codex**: `.codex/topics/f2s-topic-authoring.md`) before continuing to step 3 / step 5. Naming, skeleton, dependency judgment, DAG minimization, and judgment timing all follow that guideline; this SKILL does not repeat them.

> **Split evaluation**: if the input stock-doc exceeds **300-500 lines**, or semantic analysis finds it covers **more than 3 unrelated responsibility domains**, state in the output summary that it is recommended to split it into multiple focused stock-docs (each corresponding to an independent topic) and execute in batches after user confirmation. If the user chooses to continue with one large topic, do not block, but record "topic is large; recommend later split" in the summary. A large feature's main topic should describe the business closure/entry/submodule stock-doc navigation links; submodule topics should match independently, and **overview/detail must not be chained via `topicDependencies`**.

## Step 3: Write topics

- Target path: `.Knowledge/topics/<topic>.md`
- If the same topic already exists: prefer incremental updates to avoid duplicate topics.
- If it is a new topic: add the file with a clear title, applicable scenarios, rules, and workflow.

## Step 4: Update index

- Update the topic routing table in `.Knowledge/index.md`.
- Guarantee "one row per topic".
- The topic routing table must maintain an "Associated documents (summary)" column: add 1-3 key document **clickable Markdown links** for each topic (format: `[title](relative path)`, preferably `stock-docs/req-docs`).
- If a topic has no public document yet, write "none" or "to be added"; do not leave it blank.
- When topics are added/deleted, update the index to avoid orphan paths.

## Step 5: Update Routing Manifest (As Needed)

- This step is written by the main agent (write-authority hard rule); sub-agents must not perform it.
- Update `manifest-routing.topicPaths` (topicId -> topic file path).
- Update `manifest-routing.taskToTopicRules[]` (task-to-topic set + matcherId).
- Update `manifest-routing.topicDependencies` (read dependency topics before main topics).
- Update `manifest-routing.topicMetadata` (as needed): write `{ "primary": "feature|module|config|policy", "tags": ["..."], "confidence": "manual|inferred" }` only for topicIds that already exist or are confirmed as created in this run; `tags` may be omitted and must not duplicate `primary`. Classification is only for governance, audit, and reading expectations; it does not participate in route matching or execution requirements. New topics may use `inferred` when evidence is clear; write `manual` only after user confirmation; if evidence is insufficient, do not write metadata and list it as pending confirmation in the summary. Do not create, rename, or split topics for classification.
- Update `matchers/<matcherId>.json` `includeAny` (keyword dictionary; path must match `taskToTopicRules[].matcherPath`).
- Validate that `fallbackTopic`, `topicPaths`, and `matcherId` references are valid.
- Make only minimal changes; do not rewrite unrelated fields.

## Path and Reference Constraints

- `sourceDoc` or document references uniformly point to `.Knowledge/stock-docs/<filename>.md`.
- Do not use `.Knowledge/req-docs/` as a topic `sourceDoc`.
- Do not rewrite the configuration-root `rules/skills`.

## Output Summary (Required)

- New/updated topic files.
- `index` updates.
- Routing-manifest updates, if any.
- Failed or skipped items and reasons.

## Complex Scenario Example

User input: `f2s-kb-build .Knowledge/stock-docs/<capability>_final.md`, and an existing `topics/<capability>.md` already exists.

- If the new document highly overlaps with the existing `<capability>` topic: update `topics/<capability>.md` in place; do not create `<capability>-v2.md`.
- If the new document adds a sub-capability: create `topics/<capability>-<subdomain>.md` if appropriate, and declare dependencies in `manifest-routing.topicDependencies`.
- After updating, sync `index` and the routing manifest, ensuring `topicPaths`, `fallbackTopic`, and `matcherId` remain valid.

## Completion Self-Check

1. `.Knowledge/topics/*.md` and `manifest-routing.topicPaths` correspond one-to-one.
2. The `index.md` topic table is consistent with the topic-file set, and each topic contains "Associated documents (summary)".
3. Every `taskToTopicRules[].matcherPath` file exists, and its `id` matches `matcherId`.
4. If `topicMetadata` was written: every key exists in `topicPaths`; `primary` / `tags` / `confidence` are valid; `tags` do not duplicate `primary`; no topic was changed just for classification.
5. The configuration-root `rules/skills` was not touched.
6. For medium/large changes, sub-agents were split by file-level contract (sub-agent A / B paths do not overlap).
7. `manifest-routing.json` / `.Knowledge/index.md` were written at a single point by the main agent, with no unauthorized sub-agent writes.
