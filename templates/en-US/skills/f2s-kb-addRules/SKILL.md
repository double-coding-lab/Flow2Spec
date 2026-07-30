---
name: f2s-kb-addRules
description: Capture user-spoken rules into the knowledge base, automatically decide "create new topic / merge into existing topic", and sync routing; does not write code or create `.task/`; triggers: f2s-kb-addRules、新增规则、口述规则、把这条记到知识库、add rule、capture spoken rule
---

> **Task paths**: all `.task/` reads/writes must use **`TASK_ROOT` from `rules/f2s-task`** (` .task` or `.task/<developerId>`; config → git → legacy). Bare `.task/todo.json` / `.task/active/` below mean **`TASK_ROOT/...`**.


> Execution scope: this skill only maintains `.Knowledge` (`topics/index/manifest-routing/matchers` shards), does not modify the configuration-root `rules/skills`, does not touch business code, and does not create `.task/` (spoken rules are meta-configuration changes, not business change tracking).

# f2s-kb-addRules: Put User-Spoken Rules into the Knowledge Base

## Boundary with Existing Skills

- Different from `f2s-kb-feat`: `f2s-kb-feat` is strongly tied to "code implementation + KB sync" and creates `.task/` when `changeTracking.feat` is hit; this skill **only captures rules**, does not change code, and does not track tasks.
- Different from `f2s-kb-build`: `f2s-kb-build` takes `.Knowledge/stock-docs/<file>_final.md` as input; this skill takes **rule text spoken by the user in the current conversation**.
- Different from `f2s-kb-add`: `f2s-kb-add` aggregates "multiple source/config files" into stock-docs; this skill skips stock-docs and writes directly to topics.

## Orchestration (main / sub-agent)

- The meaning of `subAgent` / `switchAgentVerification` uses the unified entry as the only source of truth (**Cursor/Claude** read `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md`). This SKILL does not repeat it.
- By default, the main agent performs the full workflow: a spoken rule is usually a short text, so sub-agent splitting has lower benefit than context-switching cost.
- **Write-authority hard rule**: `.Knowledge/manifest-routing.json` / `.Knowledge/index.md` are always written by the main agent.
- The writing side verifies its own work.

## Input

- One rule sentence or paragraph spoken by the user (free text; no fixed format).
- The user **does not need** to specify a target topic, filename, `alwaysApply`, or similar parameters; this skill judges and proposes them.

## Mandatory Prerequisite: Read Authoring-Side Guideline

Before executing any step, **Read** the full `rules/f2s-topic-authoring.*` (**Cursor/Claude**: `rules/f2s-topic-authoring.mdc`; **Codex**: `.codex/topics/f2s-topic-authoring.md`). All later naming, skeleton, dependency judgment, DAG minimization, and write ownership follow that guideline.

## Step 1: Normalize Intent

Normalize the user's spoken text into a writeable "rule unit":

- Extract **constraint phrasing** ("when doing X, must / must not / prefer Y") or **workflow description** ("the processing order of X is A -> B -> C").
- Identify the rule's **applicable scenario** (trigger condition, file-path scope, lifecycle phase, etc.).
- Do not infer boundaries the user did not state; write only what was spoken, and keep unclear parts for questions in step 3.

## Step 2: Scan Existing Topics (Required)

- Read `.Knowledge/manifest-routing.json` to get the full `topicPaths` set.
- Read the topic table in `.Knowledge/index.md`, scanning once by topic id + one-sentence intent.
- When necessary, Read the first 10-30 lines of candidate `topics/<id>.md` files by **keywords** in the rule body (do not load all topics in full).
- Output a **candidate list** (highest to lowest overlap, at most 3) as input to step 3.

## Step 3: Decide New vs Merge (Required, Confirm with User)

Show the **candidates** to the user and propose one branch:

- **High overlap** (the spoken rule is clearly a refinement / supplement / exception of an existing topic) -> propose "**merge into** `topics/<existing>.md`", and identify the intended insertion point (section name / paragraph anchor).
- **No overlap / low overlap** (no suitable host found) -> propose "**create** `topics/<new-id>.md`"; generate the new id from the rule body in **kebab-case**, following `f2s-topic-authoring` naming constraints (no version suffix, no personal nickname, no conflict with existing `index.md` titles).
- **Crosses multiple topics** (one spoken rule constrains >= 2 topics) -> **pause** and present split options:
  - Option A: split into >= 2 rule units and merge each into the corresponding topic.
  - Option B: choose one primary topic to merge into, and add one-line cross-references in the other topics.
  - Option C: create a **general** topic to govern them, and add references from old topics; use only when the rule truly cuts across multiple domains.

> Before the user confirms, writing `topics/` / `manifest-routing.json` / `index.md` is **forbidden**.

## Step 4: Write to Disk (After User Confirmation)

### 4a. Write `topics/<id>.md`

- **Create**: write the five skeleton items from `f2s-topic-authoring` section 2 "topic body skeleton" one by one (title and one-sentence intent / applicable scenario / core rules / dependency declaration / boundaries and forbidden items).
- **Merge**: perform **surgical insertion** at the confirmed section / paragraph: only add sentences or paragraphs directly related to this rule; do not rewrite the whole file or restate background opportunistically.
- Writing style follows `f2s-flow2spec-unified-entry` "knowledge-base writing style": **affirmative wording first**; mutually exclusive choices are exceptions.

### 4b. Judge `topicDependencies` (Required)

Use the four questions + reverse exclusion + DAG minimization in `f2s-topic-authoring` section 4. Scan newly written text for **backtick references to other topic ids / rule filenames**, and judge each one:

- Hit -> add an edge to `manifest-routing.topicDependencies`, **and** write an explicit sentence in the new/modified topic body: "Before execution, read dependency topic `<dep>` first".
- No hit -> do not write a dependency; rely on `taskToTopicRules` second-highest candidates + `expand` supplemental recall.

When merging into an existing topic, if the change only refines an existing rule and does not introduce a strong reference to a new topic, usually no new dependency edge is needed.

### 4c. Sync Routing (Main Agent Only)

- **New topic**:
  - Add `manifest-routing.topicPaths`: `<id> -> .Knowledge/topics/<id>.md`.
  - Add `manifest-routing.topicMetadata` as needed: spoken-rule topics are usually `{ "primary": "policy", "confidence": "inferred" }`; write `manual` when the user explicitly confirms the classification. If it also contains config/module/capability characteristics, write `tags` that do not duplicate `primary`; if evidence is insufficient, do not write metadata and list it as pending confirmation in the summary. Classification is only for governance, audit, and reading expectations; it does not participate in route matching or execution requirements.
  - Add `taskToTopicRules[]` only when this rule should be matched as **user task routing** (see `f2s-topic-authoring` section 5 criteria); internal rules that are only referenced by other rules / SKILLs **do not enter** `taskToTopicRules`.
  - If `taskToTopicRules[]` is added, create `.Knowledge/matchers/<matcherId>.json`, extracting `includeAny` keywords from the user's wording (the original words + 1-2 obvious synonyms; prefer missing terms over over-broad terms).
- **Merge into existing topic**:
  - `topicPaths` does not change.
  - Fill this topic's `topicMetadata` as needed, but do not create, rename, or split topics for classification.
  - Only when the spoken rule **adds a trigger scenario**, minimally update the corresponding `matchers/<id>.json` `includeAny`; otherwise leave the matcher unchanged.

### 4d. Update `index.md`

- New topic: add one row to the topic table (one-row-per-topic principle). In the "Associated documents (summary)" column, write "none" or "to be added" (spoken rules usually have no stock-docs / req-docs anchor); do not leave it blank.
- Merge into existing topic: update that row's "topic intent" summary only if the topic intent changes; otherwise leave it unchanged.

## Step 5: Output Summary (Required)

```markdown
## Rule Capture Result

### Spoken Rule
> <user original text, 1-3 lines>

### Write Decision
- Mode: create / merge / cross-topic split
- Target: .Knowledge/topics/<id>.md (section: <optional>)

### Knowledge-Base Changes
- .Knowledge/topics/<id>.md: <new/revision description>
- .Knowledge/manifest-routing.json: <whether topicPaths / taskToTopicRules / topicDependencies were updated and why>
- .Knowledge/matchers/<id>.json: <whether includeAny was updated and why>
- .Knowledge/index.md: <whether updated and why>

### Follow-up for User
- <if no taskToTopicRules, say "this rule is not currently matched by task routing; add it later if needed"; list other follow-ups>
```

## Constraints

- Do not write code, do not touch the configuration-root `rules/skills`, and do not create `.task/`.
- Before the user confirms "create / merge / cross-topic split", writing is forbidden.
- Prefer merging into the same topic to avoid creating near-duplicate topics (see the "do not" naming items in `f2s-topic-authoring`).
- `manifest-routing.json` and `.Knowledge/index.md` are always written by the main agent (write-authority hard rule).
- The routing manifest receives only minimal changes; unrelated fields are not rewritten.
- Writing style follows the unified entry "knowledge-base writing style" and single-file length soft constraints (spoken rules usually need <= 30 added lines of body text).

## Complex Scenario Examples

**Scenario A: High-overlap merge**

User says: "When writing commit messages, the first line must start with a Chinese emoji."
The scan finds existing `topics/f2s-git-commit.md` (describes the git commit flow).
- Step 3 proposes: **merge into** the "commit style" section of `topics/f2s-git-commit.md`.
- Step 4a appends a rule paragraph to that section and does not change other sections.
- Step 4b adds no dependency.
- Step 4c leaves manifest unchanged, only adding 1-2 keywords to the topic's matcher if one exists.
- Step 4d leaves index unchanged.

**Scenario B: New topic**

User says: "All user-facing error messages must start with a verb, such as 'Retry' or 'Check X', instead of 'Error: X failed'."
The scan finds no suitable host.
- Step 3 proposes: **create** `topics/error-message-style.md`.
- Step 4a writes it using the skeleton.
- Step 4b evaluates whether it depends on existing i18n / copywriting convention topics, and declares the dependency if hit.
- Step 4c judges whether daily user conversations will trigger "error-message copy" task routing. If yes, add `taskToTopicRules` + create matcher; if it is only an internal convention referenced by other SKILLs, **do not add** `taskToTopicRules`.
- Step 4d adds one index row.

**Scenario C: Cross-topic split**

User says: "When implementing from a design, do not edit docs while coding; before submitting a PR, tests must be run first."
This clearly involves two topics: `f2s-implement-tech-design` (implementation discipline) and `f2s-git-commit` (submission flow).
- Step 3 pauses and presents options A / B / C.
- User chooses A -> split into two rule units and merge them into the two topics separately.
- Step 4 writes to both topics, and the output summary lists both changes.

## Completion Self-Check

1. The full `rules/f2s-topic-authoring.*` was Read before writing.
2. No files were written before the user confirmed "create / merge / cross-topic split" (must be false).
3. New topic: `topicPaths` is complete; the body contains the five skeleton items; `taskToTopicRules` and matcher `includeAny` satisfy the criteria for whether a rule needs topic routing.
4. If `topicMetadata` was written: the key exists in `topicPaths`; `primary` / `tags` / `confidence` are valid; no topicId / filename was changed for classification.
5. Merged topic: only surgical insertion was performed; unrelated sections were not rewritten opportunistically.
6. `topicDependencies` was judged by the four questions; no redundant transitive edge or cycle was introduced.
7. `index.md` and `topics/` file set correspond one-to-one; new topics fill the "Associated documents (summary)" column.
8. The configuration-root `rules/skills` was not touched; `.task/` was not created.
9. Output summary is complete (original text / decision / changes / follow-ups).
