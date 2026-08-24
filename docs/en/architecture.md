[中文](../体系与原理.md) | [English](./architecture.md)

# Architecture & Principles

Flow2Spec separates "business knowledge curation" from "Agent capability loading", and uses **Memory Coding** to persist "what must be remembered" as versioned Git assets.

- **Knowledge ring** (`.Knowledge/`): documents and machine-readable routing (multi-layer, see below)
- **Task ring** (`.task/`): cross-session task checklists
- **Rules ring** (tool `rules` / `AGENTS.md`): how to **read** and **act**
- **Skills ring** (`f2s-*`): maintain knowledge and trigger workflows

> Flow2Spec is not "just a knowledge base." All four rings are Memory Coding; the two-layer table below is the **knowledge ring vs tool-side execution** lifecycle split.

---

## 1. Memory Coding and Four Rings

**Memory Coding**: encode durable context into the **committed repo**—not private model memory, not chat-only repetition, not whole-repo vector guessing.

Four rings in the repo (do not collapse rules + skills into a single "third ring"):

| Ring | Location | Stores |
| --- | --- | --- |
| **Knowledge** | `.Knowledge/` | Routing, topics, stock/req docs (§2 layers) |
| **Task** | `.task/` | `todo.json`, checklists, user todos |
| **Rules** | `.cursor/.claude/.codex/.dsh` rules/topics, `AGENTS.md` | Read order, gap gates, execution constraints |
| **Skills** | config root `skills/*/SKILL.md` | `f2s-kb-feat/fix/sync`, etc. |

---

## 2. Multi-Layer Memory Inside the Knowledge Ring

`.Knowledge/` is not a flat pile of Markdown. It combines **horizontal narrowing** (progressive routing) and **vertical chaining** (topic dependencies):

| Layer | Path / mechanism | Stores | Typical read |
| --- | --- | --- | --- |
| **L0 routing** | `manifest-routing.json` | task→topic, `topicDependencies`, `topicPaths`, `topicMetadata` | First read (machine source of truth) |
| **L1 matcher shard** | `matchers/<id>.json` | `includeAny` triggers | **match**: one shard only |
| **L2 topic summary** | `topics/<topic>.md` | Hard constraints, boundaries, pointers | **expand**: pull dependency topics |
| **L3 long docs** | `stock-docs/`, `req-docs/` | Architecture finals, tech specs | Drill down on demand |
| **Vertical chain** | `topicDependencies` | Common → subdomain → whitelist → domain rules | **expand** stacks layers |

The pipeline `match → expand → verify → act` operates on L0–L2 (and L3 when needed). Topic-level dependencies are declared once and shared by all tasks.

`index.md` is human navigation only; it does not replace the machine-readable chain.

---

## 3. Knowledge Layer vs Execution Layer (Two Layers)

| Layer | Location | Role |
| --- | --- | --- |
| Knowledge layer (knowledge ring) | `.Knowledge/` | Business docs, index, routing (§2 layers) |
| Execution layer (rules + skills rings) | `.cursor/.claude/.codex/.dsh` | Rules and skill entry points |

---

## 4. Progressive Reading

The recommended unified order:

1. `.Knowledge/manifest-routing.json`
2. `.Knowledge/matchers/<matcher>.json` (on demand: directly located by `manifest-routing.taskToTopicRules[].matcherPath`)
3. `.Knowledge/index.md`
4. The matched `stock-docs` / `req-docs` documents
5. Source code drill-down when necessary

After reading, execute the four-step pipeline `match -> expand -> verify -> act`: expand dependency topics after hitting the primary candidate, perform gap analysis, execute only when confidence is sufficient; clarify first when confidence is low.

Simultaneously, loading behavior is governed by the config root entry points (Flow2Spec package rules: `f2s-flow2spec-unified-entry.mdc` / `f2s-flow2spec-unified-entry.md`; legacy business repos commonly use `main.md(c)`; and `AGENTS.md`).
Codex does not read the `rules/` directory; execution constraints are carried through `.codex/AGENTS.md` + `skills/`.

---

## 5. Key Chains

- Documentation curation chain: `f2s-doc-arch` -> `f2s-doc-final` -> `f2s-kb-build`
- Implementation chain: `.Knowledge/req-docs/*.md` -> `implement-tech-design` -> code
- Maintenance chain: `f2s-kb-fix` / `f2s-kb-feat` / `f2s-kb-sync` / `f2s-kb-merge`
- Requirements planning chain: `f2s-req-plan` (planning + implementation, always creates task checklist)
- Change tracking chain: `changeTracking.*` config -> `f2s-task` rules (automatic) -> `.task/` task checklist -> cross-session continuation
- Package template/routing shape alignment with config root: `f2s-kb-upgrade` (**do not** equate running `flow2spec init` alone with "knowledge base upgrade"; for non-topic version updates the agent may directly run `flow2spec init` to complete the alignment)

The documentation curation chain produces two document types:

| | Draft (初稿) | Final (终稿) |
|--|------|------|
| Nature | Raw extraction from source files | Structured knowledge for AI/knowledge base consumption |
| Structure | Source list, per-module summary, pending items | Core concepts, business rules, key flows, interfaces |
| Perspective | "What I read" | "What the AI needs to know" |
| Uncertain content | Retained, explicitly marked "pending" | Cleaned up or absorbed after confirmation |

---

## 6. Two Isolation Boundaries for Collaboration

Flow2Spec assumes that a team shares one knowledge base. It applies opposite policies to two loops: **task state is separated; knowledge is merged**.

- **Task loop**: `.task/` stays out of Git and is partitioned by `<developerId>/` as personal working state.
- **Knowledge loop**: `.Knowledge/` stays in Git. Topic-level integer `revision` values act as optimistic disk locks, while `kb-delta.json` carries structured changes into the shared knowledge base.

Both policies follow the same rule: team facts belong in Git; personal execution state does not.

### 6.1 Task loop: a local TASK_ROOT per developer

With collaboration enabled, each developer gets `.task/<developerId>/`. The task rule creates, resumes, and archives tasks only under the current `TASK_ROOT`; it must not scan another developer's `todo.json`. If collaboration is disabled or no identity is available, Flow2Spec retains the legacy `.task/` root.

Because `.task/` is local, team progress should be read from PRs, commits, `.Knowledge/` diffs, and milestones, not from another person's active checklist.

### 6.2 Knowledge loop: structured deltas and optimistic locking

Each topic carries `revision: N` in its frontmatter. A knowledge-producing skill writes a `kb-delta.json` that records the revisions it read and one of four allowed change types: `appendBody`, `replaceBody`, `updateFrontmatter`, or `createTopic`.

The merge pipeline is:

```text
flow2spec kb check -> status -> plan -> apply -> build -> check
```

`plan` compares `baseRevisions` with the current files. A match is mergeable; `apply` writes the changes and increments the topic revision. A mismatch stops before disk writes and requires the developer to pull, reread the topic, and rewrite the delta against the latest semantics.

This is a topic-level lock. Two unrelated edits to different sections of the same topic still conflict. Direct topic edits also bypass the revision preflight, so the `f2s-kb-*` workflows use deltas.

### 6.3 Why the boundary is drawn here

Sharing `.task/` would turn rapidly changing checklists and session context into repository noise. Splitting `.Knowledge/` by developer would create competing versions of project truth. Keeping the first local and the second reviewable gives each kind of state one owner and one lifecycle. See [Team Collaboration](./team-collaboration.md) for the complete workflow and conflict examples.

---

## 7. Agent Execution Model

Flow2Spec controls execution behavior through two fields in the project root `flow2spec.config.json`: `subAgent` and `switchAgentVerification`.

**How the Agent reads the above truth values**: multi-end prompts + **Read** as authority, see [usage-guide.md § 1 (the only detailed table)](./usage-guide.md); design summary see [design-principles.md § 4, 5.1](./design-principles.md).

### 6.1 Primary/Sub Agent Responsibility Division Principle

**`subAgent: false` (default)**: All `f2s-*` skills execute sequentially within the primary agent, no parallel decomposition.

**`subAgent: true`**: When the scale threshold agreed upon in the skill body is reached, sub-agents may be spawned for parallel processing. Responsibility boundaries are as follows:

| Role | Responsibility Boundary |
|------|----------|
| Primary agent | Overall planning, determining task granularity and allocation strategy, aggregating sub-agent output, verifying cross-unit consistency, final write-to-disk |
| Sub agent | Processes the assigned unit (module/document/topic), outputs results in the agreed format, does not make cross-unit decisions |

The decomposition boundaries for sub-agents are progressively defined by each `f2s-*` skill body (e.g., thresholds for module count, document count, code line count). **There is currently no unified stage table at the template layer**; the skill body takes precedence.

### 6.2 Verification Ownership Principle

**Default (whoever writes to disk verifies)**: Verification after write-to-disk or changes is performed within the agent that wrote to disk. If a sub-agent wrote, the sub-agent self-verifies; if the primary agent wrote, the primary agent self-verifies.

**Cross-verification (`switchAgentVerification: true`)**: The counterpart agent bears the verification responsibility, suitable for scenarios requiring higher confidence. The enabling conditions must be **satisfied simultaneously**:

1. Configuration `switchAgentVerification: true`
2. The currently executing `f2s-*` skill body **explicitly states** that the step depends on this field

Cross-verification rules:

| Writer | Verifier | Prerequisite |
|--------|--------|----------|
| Sub-agent writes | Primary agent verifies | No additional conditions |
| Primary agent writes | Sub-agent verifies | Requires `subAgent: true` and that sub-tasks have actually been decomposed; otherwise, the primary agent self-verifies |

Design intent: Cross-verification introduces an external perspective, reducing the blind spots in the writer's self-verification, but increases execution overhead. It is therefore an explicit opt-in rather than the default behavior.

### 6.3 Change Tracking (changeTracking)

`changeTracking` is a third dimension independent of `subAgent` / `switchAgentVerification`. It controls whether the skill automatically creates a task checklist that can be continued across sessions during execution.

```json
{
  "changeTracking": {
    "feat": true,
    "fix": false,
    "implement": true
  }
}
```

- Each skill sub-item is independently controlled and does not affect each other
- When enabled: automatically checks `.task/todo.json` before skill execution, creates or resumes tasks; automatically archives upon completion
- Cross-session: when a new session describes related content, the `f2s-task` rule (`alwaysApply`) loads the remaining checklist and corresponding skill context after keyword matching
- `f2s-req-plan` is not constrained by this configuration and always creates a task checklist

---

## 8. Design Benefits

1. Share the same business knowledge source across tools
2. Does not break the rule loading conventions of Claude/Cursor/Codex
3. Controls task routing and dependencies via `manifest-routing` + `matcherPath` shards (`matchers/*.json`), reducing misreading and full scans
4. Clear primary/sub-agent responsibility boundaries: the primary agent always holds the global view, sub-agents focus on unit processing, consistency is ensured by the primary agent
5. Configurable verification ownership: default self-verification by the writer keeps overhead low; cross-verification can be enabled on demand to boost confidence in critical scenarios

---

## 9. Related Documents

- [Flow2Spec Introduction](./Flow2Spec-Introduction.md)
- [Usage Guide](./usage-guide.md)
- [Commands Reference](./commands-reference.md)
- [Directory Conventions](./directory-conventions.md)
- [Usage Scenarios](./usage-scenarios.md)
- [Team Collaboration](./team-collaboration.md)
- [Project Milestones](./milestones.md)
