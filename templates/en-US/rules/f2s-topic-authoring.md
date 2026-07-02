---
description: Flow2Spec topic-authoring guidelines: topic naming / skeleton / topicMetadata / topicDependencies decisions / whether a rule needs a corresponding topic / disk-write ownership pointers
alwaysApply: false
---

# Flow2Spec Topic Authoring Guidelines

This rule is the single source of truth for the **authoring side**. Whenever an `f2s-*` skill adds or modifies `.Knowledge/topics/<topic>.md`, adjusts `manifest-routing.topicMetadata` / `manifest-routing.topicDependencies`, or deletes / migrates a topic, it **must Read this full rule first**, then continue with the corresponding SKILL steps. It coexists with `f2s-flow2spec-unified-entry` (the consumption side); in hard conflicts, the unified entry wins.

## Scope

This rule is touched when any of the following is true:

- Add or rewrite `.Knowledge/topics/<topic>.md`;
- Modify an existing topic's title / applicable scenarios / key flow boundaries;
- Add, delete, or adjust `manifest-routing.topicMetadata`;
- Add, delete, or adjust dependency edges in `manifest-routing.topicDependencies`;
- Add a reference to a topic id in `taskToTopicRules[].topics`;
- Delete or migrate a topic (`f2s-kb-rm` / `f2s-kb-migrate` / `f2s-kb-upgrade`).

## 1. Topic Naming

- **id**: `kebab-case`, matching the key in `manifest-routing.topicPaths`.
- **Filename**: `.Knowledge/topics/<topic-id>.md`. If the topic is strongly bound to an `f2s-*` skill / rule of the same name (for example `f2s-task` / `f2s-req-plan`), the filename may include the `f2s-` prefix to show shared origin.
- **Avoid**: version suffixes (`-v2` / `-new`), personal nicknames, and synonyms that conflict with heading-level titles in `index.md`.

## 2. Topic Positioning and Body Skeleton

**Topic positioning**: executable routing summary + key boundaries. A topic may contain necessary boundary notes, key flow steps, prohibited items, and configuration summaries. After reading it, the Agent should be able to execute or decide whether more drilling is needed. It **should not carry** complete implementation details, long-form background, or raw content that can be found in a stock-doc. Stock-docs carry full background and long-form details; topics point to them.

**Directory boundary for long-form background references (hard rule)**: in a topic, reference slots that point at long-form sources — sections titled "Detailed background / Related materials / Long-form source / Reference documents" — **may only** point at `.Knowledge/stock-docs/*_终稿.md` or already-finalized `stock-docs/*`. **Do not** put `.Knowledge/req-docs/*` (clarifications / technical designs / SQL / PRDs) in these slots: `req-docs` are **temporary inputs** for a given delivery — they get archived or migrated once the delivery lands, so using them as a topic's long-form source of truth leaves a dangling reference. If the corresponding `.Knowledge/stock-docs/*_终稿.md` does not yet exist when syncing / creating a topic, **first trigger `f2s-doc-final`** to consolidate the stock-doc (or confirm with the user and hand-write it), and only then point the topic at that stock-doc; you may not skip stock-doc consolidation and mount the topic on `req-docs`. **Allowed**: the topic body may **briefly cite** a single sentence or a field name from a design document as evidence (e.g., "see `.Knowledge/req-docs/xxx_技术方案.md`" as an occasional inline pointer), but the **long-form background reference slot** (the whole "Detailed background / Related materials" section) still must point at a stock-doc.

Every topic must include at least:

1. **Title and one-sentence intent** (one line stating "what this topic solves");
2. **Applicable scenarios / trigger words** (semantically consistent with the corresponding `matchers/<id>.json` `includeAny`);
3. **Core rules / flow** (executable knowledge; steps must be reproducible by an Agent);
4. **Dependency declaration** (if dependencies exist in `topicDependencies`, the body must explicitly state "before executing, read dependency topic `<dep>` first"; use the first paragraph of `topics/f2s-req-plan.md` as a reference);
5. **Boundaries and prohibited items** (avoid expanding into neighboring topics);
6. **Long-form background / detailed materials reference** (when the topic needs to carry business background): list only clickable Markdown links to `.Knowledge/stock-docs/*_终稿.md` (1–3 links); **do not** list `.Knowledge/req-docs/*` here. If no stock-doc has been consolidated yet, **generate the stock-doc first** and then fill this section.

## 3. topicMetadata Decision Criteria

`topicMetadata` is governance metadata. It only affects inventory, audit, and reading expectations; it does not participate in matcher hits, does not decide whether a topic is read, and does not change execution mandatoryness. Execution mandatoryness comes from explicit requirements in `AGENTS.md`, rules, skills, and topic bodies.

Fields:

- `primary`: main category, single value from `feature` / `module` / `config` / `policy`.
- `tags`: optional array, values from the same set as `primary`, and must not repeat `primary`. Used to describe secondary properties when a topic also contains them; only for audit/reading expectations, not routing or execution.
- `confidence`: `manual` / `inferred`.

Decision rules:

1. A `topicMetadata` key must exist in `topicPaths`; write metadata only for a topicId that already exists or is confirmed to be created in this turn.
2. `primary` should capture the topic's most central nature: read the topic body, decide which type its main content belongs to, and write that into `primary`.
3. `config`: configuration items, switches, defaults, initialization parameters. Use as `primary` only when these form the topic's main semantics.
4. `policy`: processes, rules, constraints, gates, prohibited items, agent orchestration, skill steps. Use as `primary` only when these form the topic's main semantics.
5. `feature`: implemented business / product capability.
6. `module`: shared capability, shared package, module boundaries, and engineering structure.
7. When a topic covers multiple properties, put the most important one in `primary`; put other clearly present properties in `tags` (optional array, values from the same set as `primary`, not repeating `primary`).
8. Use `manual` only when the user or maintainer explicitly confirms the category value. If there is clear evidence but no human confirmation of the category value, write `inferred`. When evidence is insufficient, **do not write metadata**, but list the inferred direction and evidence in the summary (for example, "suggest policy; the body contains multiple mandatory constraints") so the user can confirm and manually write `manual`. **Do not infer classification only from the topicId name; Read the topic body before deciding.** **`inferred` does NOT require prior user consent before being written**: when evidence is sufficient, write it directly per this clause; escalate to `manual` only when the user/maintainer actively specifies a category or when evidence conflicts and requires a decision. Treating `inferred` as "awaiting user approval" is a common misreading — it turns "evidence-backed auto-classification" into "mandatory human confirmation", which conflicts with clause 7's allowance for direct `inferred` writes.

Prohibited: creating, renaming, or splitting topics solely for classification; duplicating classification blocks in topic markdown bodies or `index.md`.

## 4. topicDependencies Decision Criteria

Let the current topic be A and the candidate dependency be B. **Declare `A -> B` if any of these four questions hit**:

1. **Strong reference to a prerequisite rule**: A's execution steps **explicitly mention** B's terminology / artifacts / disk-write constraints (example: `f2s-req-plan` requires maintaining `.task/` according to `f2s-task`).
2. **Without B, the result would be wrong**: can reading only A and not B produce the right result? If no, this is typical when A says "how to do it" and B says "where to do it / which input to use."
3. **Shared disk-write target**: A and B write the same set of files and B defines the disk-write format (such as `.task/` or `.Knowledge/topics/`).
4. **Fallback jumps to B**: A's own coverage is incomplete and the existing convention falls back to B.

**Reverse exclusions** (avoid dependency bloat):

- Only neighboring terminology (both discuss "knowledge base") -> do not write a dependency; rely on `index.md` semantic boundaries.
- Cross-topic information lookup (A wants to "learn about" B) -> do not write a dependency; rely on `taskToTopicRules` secondary candidates + `expand` recall.
- **Overview -> detail navigation**: a major feature's main topic and its submodule topics are an "association/navigation" relationship, not a strong prerequisite dependency. Submodule topics should be independently matched by their own matchers; do not write `A -> B`. In the main topic body, write clickable stock-doc links for submodules as navigation entries.
- **Do not duplicate transitive dependencies**: if `A->B` and `B->C` already hold, do not also write `A->C` (reading B naturally brings C).

**DAG and minimization**: `topicDependencies` must be a DAG; cycles are prohibited. Keep the edge set minimal.

**Decision timing**: after final drafts and new/modified topics are written, scan the body for other topic ids and rule filenames referenced in **backticks**, apply the four questions one by one, and write `manifest-routing.topicDependencies` on hit. Also write an explicit dependency declaration in the new topic body (see skeleton item 4).

## 5. Large-Feature Splitting Strategy

When a business feature is large, prefer a "main topic + subtopics" structure instead of one oversized topic.

**When to split (soft constraints; evaluate splitting when any condition is met)**:

- The corresponding stock-doc exceeds **300-500 lines**: evaluate splitting, but do not hard-block;
- matcher `includeAny` exceeds **12 entries**: signal that the topic is too broad;
- the topic body contains second-level headings for more than **3 unrelated responsibility domains**;
- during a `f2s-kb-upgrade` audit, the same topic is repeatedly matched by several unrelated task types.

**How to split**:

- **Main topic** (`primary: feature`): describe the business loop, entry boundaries, and submodule index; use clickable stock-doc links in the body to point to detail documents; do not write submodule implementation details.
- **Submodule topics**: write each one as `feature` / `module` / `config` / `policy` according to its real semantics; do not preset the type. Each has its own matcher and is independently matched through more specific trigger words.
- **stock-doc**: long-form content is allowed. When above threshold, prefer splitting into multiple focused stock-docs, such as `<feature-name>-business-rules_final.md` and `<feature-name>-data-model_final.md`, each corresponding to one subtopic.

**Do not**:

- Do not use `topicDependencies` to express "overview -> detail" navigation relationships (see reverse exclusions in section 4).
- Do not force-create subtopics solely for splitting. If a submodule will not be independently routed, a topic is unnecessary.

## 6. Whether a Rule Needs a Corresponding Topic

Criterion: **will this rule be matched as user-task routing?**

- **Yes** (user questions / inputs can trigger this rule's execution) -> create a corresponding routing summary in `.Knowledge/topics/` and configure an entry in `taskToTopicRules`. Examples: `f2s-task` (matched by change-tracking user scenarios), `f2s-implement-tech-design` ("implement from design" user scenario).
- **No** (only referenced internally by other rules / SKILLs, and users will not initiate it directly) -> **do not create** a topic. Examples: `f2s-knowledge-preflight`, `f2s-karpathy-guidelines`, `f2s-config-check`, this rule `f2s-topic-authoring`.

Misconception: "Important rules should have topics." Importance is not the same as "matched by user routing"; let the consuming SKILL directly `Read rules/<id>.*` in its body instead of going through manifest routing.

## 7. Disk-Write Ownership (Pointer)

Write-ownership constraints for `manifest-routing.json` / `.Knowledge/index.md` / `.Knowledge/topics/*.md` **are governed by `f2s-flow2spec-unified-entry` and the "hard write-ownership constraints" inside each SKILL**. This rule does not repeat them; in conflicts, follow the unified entry and the corresponding SKILL.

## Prohibited

- Adding / modifying a topic or `topicDependencies` before reading this rule.
- Creating, renaming, or splitting topics only to fill classification.
- Writing duplicated metadata sections such as `## Concept Classification` in a topic body or `index.md`.
- Forcing "important rules" into `taskToTopicRules` (see section 6).
- Using `topicDependencies` to express "information is related" (use `index.md` semantic boundaries + matcher keyword recall instead of dependency edges).
- Writing transitive redundant edges or cycles in `topicDependencies`.
- **Listing `.Knowledge/req-docs/*` files (clarifications / technical designs / SQL / PRDs) in a topic's "Long-form background / Detailed materials / Related materials / Long-form source / Reference documents" reference slot.** These slots may only point at `.Knowledge/stock-docs/*_终稿.md`; when no stock-doc exists yet, consolidate it first and then fill the slot. Short-sentence / inline evidence pointers are not covered by this prohibition.
