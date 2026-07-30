[中文](../体系与原理.md) | [English](./architecture.md)

# Architecture & Principles

flow-spec separates "business knowledge curation" from "Agent capability loading", and uses **Memory Coding** to persist "what must be remembered" as versioned Git assets.

- **Knowledge ring** (`.flow-spec/`): documents and machine-readable routing (multi-layer, see below)
- **Task ring** (`.task/`): cross-session task checklists
- **Rules ring** (tool `rules` / `AGENTS.md`): how to **read** and **act**
- **Skills ring** (`fs-*`): maintain knowledge and trigger workflows

> flow-spec is not "just a knowledge base." All four rings are Memory Coding; the two-layer table below is the **knowledge ring vs tool-side execution** lifecycle split.

---

## 1. Memory Coding and Four Rings

**Memory Coding**: encode durable context into the **committed repo**—not private model memory, not chat-only repetition, not whole-repo vector guessing.

Four rings in the repo (do not collapse rules + skills into a single "third ring"):

| Ring | Location | Stores |
| --- | --- | --- |
| **Knowledge** | `.flow-spec/` | Routing, topics, stock/req docs (§2 layers) |
| **Task** | `.task/` | `todo.json`, checklists, user todos |
| **Rules** | `.cursor/.claude/.codex` rules, `AGENTS.md` | Read order, gap gates, execution constraints |
| **Skills** | config root `skills/*/SKILL.md` | `fs-kb-feat/fix/sync`, etc. |

---

## 2. Multi-Layer Memory Inside the Knowledge Ring

`.flow-spec/` is not a flat pile of Markdown. It combines **horizontal narrowing** (progressive routing) and **vertical chaining** (topic dependencies):

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
| Knowledge layer (knowledge ring) | `.flow-spec/` | Business docs, index, routing (§2 layers) |
| Execution layer (rules + skills rings) | `.cursor/.claude/.codex` | Rules and skill entry points |

---

## 4. Progressive Reading

The recommended unified order:

1. `.flow-spec/manifest-routing.json`
2. `.flow-spec/matchers/<matcher>.json` (on demand: directly located by `manifest-routing.taskToTopicRules[].matcherPath`)
3. `.flow-spec/index.md`
4. The matched `stock-docs` / `req-docs` documents
5. Source code drill-down when necessary

After reading, execute the four-step pipeline `match -> expand -> verify -> act`: expand dependency topics after hitting the primary candidate, perform gap analysis, execute only when confidence is sufficient; clarify first when confidence is low.

Simultaneously, loading behavior is governed by the config root entry points (flow-spec package rules: `fs-flow-spec-unified-entry.mdc` / `fs-flow-spec-unified-entry.md`; legacy business repos commonly use `main.md(c)`; and `AGENTS.md`).
Codex does not read the `rules/` directory; execution constraints are carried through `.codex/AGENTS.md` + `skills/`.

---

## 5. Key Chains

- Documentation curation chain: `fs-doc-arch` -> `fs-doc-final` -> `fs-kb-build`
- Implementation chain: `.flow-spec/req-docs/*.md` -> `implement-tech-design` -> code
- Maintenance chain: `fs-kb-fix` / `fs-kb-feat` / `fs-kb-sync` / `fs-kb-merge`
- Requirements planning chain: `fs-req-plan` (planning + implementation, always creates task checklist)
- Change tracking chain: `changeTracking.*` config -> `fs-task` rules (automatic) -> `.task/` task checklist -> cross-session continuation
- Package template/routing shape alignment with config root: `fs-kb-upgrade` (**do not** equate running `flow-spec init` alone with "knowledge base upgrade"); migrate legacy repo structure into `.flow-spec`: `fs-kb-migrate`

The documentation curation chain produces two document types:

| | Draft (初稿) | Final (终稿) |
|--|------|------|
| Nature | Raw extraction from source files | Structured knowledge for AI/knowledge base consumption |
| Structure | Source list, per-module summary, pending items | Core concepts, business rules, key flows, interfaces |
| Perspective | "What I read" | "What the AI needs to know" |
| Uncertain content | Retained, explicitly marked "pending" | Cleaned up or absorbed after confirmation |

---

## 6. Agent Execution Model

flow-spec controls execution behavior through two fields in the project root `flow-spec.config.json`: `subAgent` and `switchAgentVerification`.

**How the Agent reads the above truth values**: multi-end prompts + **Read** as authority, see [usage-guide.md § 1 (the only detailed table)](./usage-guide.md); design summary see [design-principles.md § 4, 5.1](./design-principles.md).

### 6.1 Primary/Sub Agent Responsibility Division Principle

**`subAgent: false` (default)**: All `fs-*` skills execute sequentially within the primary agent, no parallel decomposition.

**`subAgent: true`**: When the scale threshold agreed upon in the skill body is reached, sub-agents may be spawned for parallel processing. Responsibility boundaries are as follows:

| Role | Responsibility Boundary |
|------|----------|
| Primary agent | Overall planning, determining task granularity and allocation strategy, aggregating sub-agent output, verifying cross-unit consistency, final write-to-disk |
| Sub agent | Processes the assigned unit (module/document/topic), outputs results in the agreed format, does not make cross-unit decisions |

The decomposition boundaries for sub-agents are progressively defined by each `fs-*` skill body (e.g., thresholds for module count, document count, code line count). **There is currently no unified stage table at the template layer**; the skill body takes precedence.

### 6.2 Verification Ownership Principle

**Default (whoever writes to disk verifies)**: Verification after write-to-disk or changes is performed within the agent that wrote to disk. If a sub-agent wrote, the sub-agent self-verifies; if the primary agent wrote, the primary agent self-verifies.

**Cross-verification (`switchAgentVerification: true`)**: The counterpart agent bears the verification responsibility, suitable for scenarios requiring higher confidence. The enabling conditions must be **satisfied simultaneously**:

1. Configuration `switchAgentVerification: true`
2. The currently executing `fs-*` skill body **explicitly states** that the step depends on this field

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
- Cross-session: when a new session describes related content, the `fs-task` rule (`alwaysApply`) loads the remaining checklist and corresponding skill context after keyword matching
- `fs-req-plan` is not constrained by this configuration and always creates a task checklist

---

## 7. Design Benefits

1. Share the same business knowledge source across tools
2. Does not break the rule loading conventions of Claude/Cursor/Codex
3. Controls task routing and dependencies via `manifest-routing` + `matcherPath` shards (`matchers/*.json`), reducing misreading and full scans
4. Clear primary/sub-agent responsibility boundaries: the primary agent always holds the global view, sub-agents focus on unit processing, consistency is ensured by the primary agent
5. Configurable verification ownership: default self-verification by the writer keeps overhead low; cross-verification can be enabled on demand to boost confidence in critical scenarios

---

## 8. Related Documents

- [flow-spec introduction](./flow-spec-introduction.md)
- [Usage Guide](./usage-guide.md)
- [Commands Reference](./commands-reference.md)
- [Directory Conventions](./directory-conventions.md)
- [Usage Scenarios](./usage-scenarios.md)
- [Project Milestones](./milestones.md)
