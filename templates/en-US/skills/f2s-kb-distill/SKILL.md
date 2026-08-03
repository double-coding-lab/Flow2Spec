---
name: f2s-kb-distill
description: Extract reusable knowledge facts from Q&A and auto-commit to KB; decide whether to create new topic or append to existing topic based on drill-down depth; trigger: f2s-kb-distill, extract knowledge from Q&A, distill knowledge from conversation
---

> **Task paths**: all `.task/` reads/writes must use **`TASK_ROOT` from `rules/f2s-task`** (` .task` or `.task/<developerId>`; config → git → legacy). Bare `.task/todo.json` / `.task/active/` below mean **`TASK_ROOT/...`**.


> Execution scope: This skill only maintains `.Knowledge`, does not modify config root `rules/skills` by default.

## KB Auto-Merge Protocol (Required)

This skill must not make manual command execution part of the user flow. After the user triggers this skill, the agent performs knowledge candidate generation, merge planning, build, and validation by itself:

1. If reusable knowledge should be recorded, first form a `kb-delta` draft in the current task context with `taskId`, `developerId`, `baseRevisions`, `changes`, and evidence summary. If there is no explicit task directory, an equivalent in-memory object is acceptable; do not create `.task` only for this skill. `changes` may use `appendBody` / `replaceBody` / `updateFrontmatter`; when a new topic is needed, use `createTopic` and optionally include `taskRule` plus `matcher` so routing is connected in the same merge.
2. Before writing `.Knowledge`, run `flow2spec kb plan <delta>` or the equivalent internal capability. If a topic revision differs, stop automatic writing and switch to semantic-merge reporting.
3. When the change is auto-mergeable, run `flow2spec kb apply <delta>` or the equivalent internal capability, then run `flow2spec kb build` and `flow2spec kb check`.
4. The user should only see "knowledge base synced / semantic conflict needs confirmation / skipped with reason"; do not ask the user to manually run `kb plan/apply/build/check`.

## Orchestration (main / sub agent)

- `subAgent` / `switchAgentVerification` semantics follow unified entry as single source of truth: **Cursor/Claude** read config root `rules/f2s-flow2spec-unified-entry.*`; **Codex** read `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`).
- This skill does not split sub by default: Q&A knowledge extraction is a single-round focused task, completed by main agent is more efficient.
- Write permission constraint: `manifest-routing.json` and `.Knowledge/index.md` are always written by main agent only.
- Verification: self-verify on the side that writes to disk.

# f2s-kb-distill: Q&A-Driven Knowledge Extraction and Ingestion

## When to Use

- User asks → agent drills down source code to answer → need to solidify discovered knowledge into KB
- Usually auto-suggested by `f2s-kb-feedback-closing` rule, can also be manually invoked by user
- Distinction from `f2s-kb-sync`: `sync` is for batch syncing multiple capabilities; `distill` focuses on knowledge extraction from single Q&A

## Input

| Parameter | Required | Description |
| --- | --- | --- |
| User question | Auto-extract | Previous user question (auto-extract from conversation history) |
| Agent answer | Auto-extract | Previous agent answer content (auto-extract from conversation history) |
| Matched topic | Optional | If triggered by `f2s-kb-feedback-closing`, carries matched topicId |
| Drilled files | Auto-analyze | Extract referenced files/functions from answer (auto-analyze) |

Abort and prompt user when no valid Q&A context exists.

## Execution Tiers (Light / Strict, agent auto-judged)

`f2s-kb-distill` has **only one** entry (no `--fast` parameter). The first thing on entering this flow is to **decide the tier**:

### Tier judgment (4 dimensions; light tier only when all 4 are satisfied)

| Dimension | How to measure | Condition for **light tier** |
| --- | --- | --- |
| Upstream `f2s-kb-feedback-closing` case | Look at the closing block at the end of this/last agent reply | **case 2 or case 3** (case 1 / no closing block → strict tier) |
| Business source files Read this turn | Agent reviews its own tool calls this turn | **≤ 3 files** |
| Function / class names cited in this turn's reply | Count backtick-wrapped `xxx()` / class names in the reply | **≤ 5** |
| Did the user reject the upstream conclusion in a follow-up? | Look at the latest user input for "no / re-analyze / that's wrong" etc. | **No** |

**All 4 satisfied** → **light tier**: skip step 2.1 (quantitative scoring) / 2.4 (existing topic description depth) / step 3 (decision matrix) / step 4.1's "read neighboring topics for style alignment"; adopt the upstream "this round will ingest: <summary>" directly to decide strategy and target topicId, then proceed to step 4 to generate content.

**Any one fails** → **strict tier**: run the full 6 steps.

> **Business source defined**: a Read whose path is **not** under `.claude/` / `.cursor/` / `.codex/` / `.Knowledge/` / `.task/` counts. Rule files / topics / config / task lists do not count.

### Why these dimensions are enough (design intent)

- **Case type** filters out the "new topic" scenario: creating a new topic must read neighboring topics for style, configure matcher `includeAny`, and update `taskToTopicRules` — none of these can be skipped;
- **Read count + function-citation count** reflects whether this turn's knowledge is "light enough": only light supplements may skip judgments. Deep ingestion (many files + many functions) skipping them risks "description depth mismatch ≥ 2 levels" incidents;
- **User rejection signal** backstops the "upstream case judged wrong" edge.

### Steps 5 / 6 never skipped

Regardless of tier, **step 5 routing / matcher / index sync** and **step 6 write + self-check** always run in full — these are hard correctness constraints.

## Mandatory Flow (cannot be reordered)

### Step 0: Read Config and Rules

1. Read `flow2spec.config.json` (get `subAgent` / `switchAgentVerification`)
2. Read `rules/f2s-kb-feedback-closing.mdc` (get "reusable knowledge facts" definition)
3. Read `rules/f2s-topic-authoring.mdc` (get topic authoring guidelines)

### Step 1: Extract Q&A Context

Extract from previous conversation turn:

1. **User question**: Original question text
2. **Agent answer**: Complete answer content
3. **Matched topic**: Extract matched topicId if `f2s-kb-feedback-closing` already analyzed; otherwise re-route based on question
4. **Drilled files**: Extract all referenced file paths, function names, line numbers from answer
5. **Referenced code**: Extract code snippets quoted in answer

### Step 2: Analyze Drill-Down Depth and Knowledge Nature

> ****Light tier** skips**: sections 2.1 / 2.4 are skipped entirely; 2.2 (extract knowledge facts) must run; 2.3 (knowledge description depth) is reduced to **a brief annotation** (one line stating "summary-level / detailed-level / implementation-level", no multi-dimensional evaluation).

#### 2.1 Calculate Drill-Down Depth Score

Accumulate following indicators (each 0-10 points, total 0-50):

- **Files read count**:
  - 0 files: 0 points
  - 1-2 files: 3 points
  - 3-5 files: 7 points
  - 6+ files: 10 points

- **Segmented read count** (same file read multiple times at different line ranges):
  - 0-1 times: 0 points
  - 2-4 times: 3 points
  - 5-8 times: 7 points
  - 9+ times: 10 points

- **Function/class reference count**:
  - 0-2: 0 points
  - 3-5: 3 points
  - 6-10: 7 points
  - 11+: 10 points

- **Code snippet length**:
  - 0-50 lines: 0 points
  - 51-150 lines: 3 points
  - 151-300 lines: 7 points
  - 301+ lines: 10 points

- **Answer length**:
  - 0-200 chars: 0 points
  - 201-500 chars: 3 points
  - 501-1000 chars: 7 points
  - 1001+ chars: 10 points

**Drill-down depth classification**:
- **Shallow** (0-15 points): Simple Q&A, minimal source code reference
- **Medium** (16-30 points): Medium complexity, multi-file consultation
- **Deep** (31-50 points): Deep exploration, extensive source code analysis

#### 2.2 Extract Reusable Knowledge Facts

Extract following types of knowledge from answer (refer to `f2s-kb-feedback-closing`):

- Core mechanisms (cache semantics, retry strategy, fallback logic)
- State transitions (state machine, lifecycle)
- Return value / error code contracts
- Configuration switch impacts
- Failure fallback strategies
- Module boundaries or calling conventions
- Data models and field semantics

**Extraction result**:
- Each knowledge fact includes: type, description, source (file:line)
- Sorted by importance

#### 2.3 Judge Extracted Knowledge Description Depth

Evaluate detail level of extracted knowledge facts (judged by content characteristics, not length):

- **Summary level**: Only conclusive description ("what it is", "what it does"), no conditions/flows/function details
  - Example: `Cache-first, fallback to OCR`
- **Detailed level**: Includes mechanism explanation, process steps, key judgment conditions ("when X", "if Y then", "first...then...")
  - Example: `Cache-first: use cached coordinates when hit; fallback condition: popup not dismissed, coordinates out of bounds`
- **Implementation level**: Includes function call relationships, state transition details, boundary condition handling, code examples
  - Example: `Cache read: call _get_cached_point_in_bounds("chat.input"), fallback when returns None; failure detection: VisualSearchPopup.find(timeout=0.08) is None`

#### 2.4 Evaluate Existing Topic Description Depth (only when "matched")

If matched an existing topic, need to evaluate its description depth (judged by content, not length):

1. **Read target topic content**
2. **Randomly sample 3-5 entries** (from different paragraphs)
3. **Judge each entry's description depth**:
   - **Summary level characteristics**: Only says "what it is", "what it does", enumeration style, no conditions/flows/function details
   - **Detailed level characteristics**: Contains "when X", "if Y then", "first...then...", judgment conditions, mechanism explanation
   - **Implementation level characteristics**: Contains function names `xxx()`, class names, file paths, parameters, code examples, state transition logic
4. **Majority level of entries = overall topic description depth**

**Judgment examples**:

| Topic Content | Judgment | Reason |
|--------------|----------|--------|
| `- Cache-first, fallback to OCR`<br>`- Send message action chain detection` | Summary | Only says "what", no details |
| `- Cache-first: use cached coordinates when hit`<br>`- Fallback: clear cache and re-OCR when popup not dismissed` | Detailed | Has condition explanation ("when...") |
| `- Cache read: _get_cached_point_in_bounds("chat.input")`<br>`- Failure detection: VisualSearchPopup.find(timeout=0.08) is None` | Implementation | Has function names, parameters |

**Important**: A 300+ line topic where every entry is "Module X: responsible for YYY" is still summary level; a 50 line topic where every entry has "conditional judgment + function call" is implementation level.

### Step 3: Decide Ingestion Strategy

> ****Light tier** skips the entire decision matrix**: adopt the upstream `f2s-kb-feedback-closing` "this round will ingest: <summary>" conclusion directly:
> - Summary contains "append to / supplement / fill in `<topicId>` section X" → strategy = **append to existing topic**, target topicId = the topic named in the summary;
> - Summary contains "first-time ingestion", "new `<capability>`", "new `<module>`" → strategy = **new topic** (default small topic; step 4.3 internally upgrades to "new independent module topic" when drill-down is deep and the module is standalone);
> - Summary contains "fix `<topicId>` entry X" → strategy = **append to existing topic** (overwrite-style append; the original wording is rewritten during content generation).

Decide based on following decision matrix:

| Drill-Down Depth | Matched Topic | Existing Topic Depth | Extracted Knowledge Depth | Strategy |
|-----------------|---------------|---------------------|--------------------------|----------|
| Shallow | Matched | Summary | Summary | **Append to existing topic** (add brief note) |
| Shallow | Matched | Summary/Detailed | Detailed | **Append to existing topic** (add detailed paragraph) |
| Shallow | Matched | Summary | Implementation | **Create sub-topic** (existing too brief, new too detailed) |
| Shallow | Not matched | - | Any | **Create new topic** (small topic) |
| Medium | Matched | Summary | Summary/Detailed | **Append to existing topic** (add detailed paragraph) |
| Medium | Matched | Summary | Implementation | **Create sub-topic** (gap ≥ 2 levels) |
| Medium | Matched | Detailed/Implementation | Detailed/Implementation | **Append to existing topic** (levels match) |
| Medium | Not matched | - | Any | **Create new topic** (medium topic) |
| Deep | Matched | Summary | Any | **Create sub-topic** (independent topic + stock-doc) |
| Deep | Matched | Detailed/Implementation | Detailed/Implementation | **Append to existing topic** or **Create sub-topic** (judge by semantic focus) |
| Deep | Not matched | - | Any | **Create independent module topic** (complete topic + stock-doc) |

**Decision keys**:
- **Description depth gap ≥ 2 levels** (summary vs implementation) → force create sub-topic, avoid style inconsistency
- **Description depth gap = 1 level** (summary vs detailed, or detailed vs implementation) → can append, but write detailed paragraphs
- **Description depth matches** (same level) → normal append
- **Drill-down depth ≥ deep** → prefer create sub-topic, unless existing topic already very detailed and semantics fully overlap

**Decision output**:
- Strategy type: `Append to existing topic` / `Create sub-topic` / `Create independent module topic`
- Target topicId: Existing topic id or suggested id for new topic
- Update content: Content to append or structure of new topic
- Description depth match: same level / 1 level gap / ≥ 2 level gap

### Step 4: Generate Knowledge Content

> **Authoring guidelines**: This step triggers creation/modification of topics and possible `topicDependencies`, must follow already-read `f2s-topic-authoring` guidelines.

#### 4.1 Append to Existing Topic

If strategy is "append to existing topic":

1. Read current content of target topic
2. Read style samples from 2-3 neighboring topics (for style alignment)  
   ****Light tier** skips this**: do not read neighboring topics; just match the list / paragraph form already used in the target topic itself.
3. Generate content to append:
   - **Position**: Find most relevant paragraph, append after it
   - **Format**: Keep list/paragraph style consistent with existing topic
   - **Length**: Decide based on knowledge description depth:
     - Summary level: 1-3 lines
     - Detailed level: 5-10 lines, include mechanism explanation
     - Implementation level: 10-20 lines, include process steps and key functions

#### 4.2 Create Sub-Topic

If strategy is "create sub-topic":

1. Generate new topicId (based on parent topic + focus point)
2. Create new topic content:
   - Title and one-sentence intent
   - Applicable scenarios / trigger words
   - Core mechanism details (generated from extracted knowledge facts)
   - Dependency declaration (depends on parent topic)
   - Boundaries and prohibitions
3. Update parent topic:
   - Append link to sub-topic in relevant paragraph
   - Explain focus point of sub-topic
4. Update `topicDependencies`:
   - Add `sub-topic → parent topic` dependency edge

#### 4.3 Create Independent Module Topic

If strategy is "create independent module topic":

1. Generate new topicId (based on module name or problem domain)
2. Decide whether to create stock-doc:
   - Drill-down depth ≥ deep: create stock-doc (`<topicId>_final.md`)
   - Drill-down depth < deep: only create topic, no stock-doc
3. If creating stock-doc:
   - Structure: overview, core mechanisms, source files, key functions and flows
   - Content: generated from extracted knowledge facts and referenced code snippets
   - Length: 100-500 lines depending on drill-down depth
4. Create topic:
   - If has stock-doc, topic serves as summary + pointer
   - If no stock-doc, topic contains complete mechanism explanation

### Step 5: Sync Routing and Index

#### 5.1 Update manifest and matcher

- If creating new topic:
  - Add entry in `manifest-routing.json.topicPaths`
  - Create corresponding `matchers/<id>.json`, including:
    - Keywords extracted from user question
    - Terms extracted from answer
    - Suggested `includeAny`: 5-10 trigger words
  - Add routing rule in `taskToTopicRules`

- If updating existing topic:
  - Check if matcher needs new trigger words
  - Extract uncovered keywords from user question, append to `includeAny`

#### 5.2 Update index.md

- If creating new topic:
  - Add new entry in `.Knowledge/index.md`
  - Format: `- **[topic title](topics/<topicId>.md)** - one-line description | Related docs: [Final](stock-docs/<doc>.md)` (if any)
- If updating existing topic:
  - Check if description in index needs update
  - If added stock-doc, update "Related docs" column

#### 5.3 Handle topicMetadata (optional)

If has clear evidence, write to `topicMetadata`:

- Judge `primary` type from extracted knowledge facts:
  - Core mechanism/state transition/failure fallback → `policy`
  - Config switch impact → `config`
  - Module boundary/calling convention → `module`
  - Implemented capability/business logic → `feature`
- Set `confidence` to `inferred`
- Don't write when no clear evidence, list as "unclassified" in output summary

### Step 6: Write to Disk and Self-Check

Write in following order:

1. If has stock-doc: write to `.Knowledge/stock-docs/<doc>.md`
2. Write or update `.Knowledge/topics/<topicId>.md`
3. Update `.Knowledge/manifest-routing.json`
4. Update `.Knowledge/matchers/<id>.json`
5. Update `.Knowledge/index.md`

Self-check list:

1. Does topic content include extracted core knowledge facts
2. Does new topic have corresponding entry in index.md
3. Do topicPaths / taskToTopicRules in manifest reference valid paths
4. Does includeAny in matcher cover keywords from user question
5. If created sub-topic, is topicDependencies correctly set
6. Does appended content maintain style of existing topic (if read neighboring topics)

## Output Summary Format

```markdown
## Knowledge Extraction and Ingestion Result

- Execution tier: `Strict tier (full flow)` / `Light tier (2.1 / 2.4 / 3 / 4.1 skipped)` / `Light tier → strict tier (downgrade reason: <reason>)`

### Q&A Analysis
- User question: <question summary>
- Matched topic: <topicId or "none">
- Drill-down depth: <shallow/medium/deep> (<score>)  ← **Light tier**: `not evaluated`
- Knowledge description depth: <summary/detailed/implementation level>

### Extracted Knowledge Facts
- [Core Mechanism] <description> (source: <file:line>)
- [State Transition] <description> (source: <file:line>)
- ...

### Ingestion Strategy
- Strategy: <Append to existing topic / Create sub-topic / Create independent module topic>
- Target topic: <topicId>
- Operation: <append content / create new topic + stock-doc>

### Modified Files
- .Knowledge/topics/<topicId>.md: <modification description>
- .Knowledge/index.md: <modification description or "unchanged">
- .Knowledge/manifest-routing.json: <modification description or "unchanged">
- .Knowledge/matchers/<id>.json: <modification description or "unchanged">
- .Knowledge/stock-docs/<doc>.md: <modification description or "unchanged">

### Verification Suggestion
- When encountering similar question "<question>" next time, should match topic: <topicId>
- Suggested verification trigger words: <keyword list>
```

## Constraints

- Only maintain `.Knowledge`, do not modify config root `rules/skills`
- No user confirmation needed (Q&A already verified knowledge correctness)
- Keep lightweight, single Q&A knowledge extraction complete within 30 seconds
- Avoid over-splitting: unless drill-down depth ≥ deep and knowledge description depth ≥ detailed level, prioritize appending to existing topic
- Generated matcher includeAny should cover expressions users actually use, not just technical terms

## Self-Check After Completion

1. Correctly analyzed drill-down depth and knowledge description depth (**Light tier**: correctly parsed the strategy and target topicId from the upstream summary)
2. Extracted all "reusable knowledge facts" (refer to `f2s-kb-feedback-closing` definition)
3. Ingestion strategy conforms to decision matrix (**Light tier**: matches the case named in the upstream summary)
4. New or updated topic has entry in index.md
5. manifest / matcher correctly configured routing rules
6. Generated content maintains style of existing topic (**Light tier**: at least matches the list/paragraph form of the target topic itself)
7. **Light tier specific**: the summary header includes the "Execution tier" line; if downgraded mid-run, the downgrade reason is recorded
8. The reply does NOT append any of `f2s-kb-feedback-closing`'s case 1–4 closing blocks at the end (must be yes; this skill itself is a knowledge-base write, and by the reverse prohibition in `f2s-kb-feedback-closing`'s "Applicable Scope", pasting a distill hint here is forbidden).
