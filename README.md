# Flow2Spec

<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="Flow2Spec routes a natural language coding request into compact project facts before code edits">
</p>

<p align="center">
  <strong>Give Cursor, Claude Code, and Codex the project facts they need before editing.</strong>
</p>

<p align="center">
  <a href="./README.zh-CN.md">中文</a> ·
  <a href="https://double-coding-lab.github.io/Flow2Spec">Live demo</a> ·
  <a href="./docs/en/Flow2Spec-Introduction.md">Introduction</a> ·
  <a href="./docs/en/usage-guide.md">Usage guide</a> ·
  <a href="./docs/en/commands-reference.md">Commands</a>
</p>

<p align="center">
  <img alt="npm latest" src="https://img.shields.io/npm/v/@double-codeing/flow2spec?label=latest">
  <img alt="npm beta" src="https://img.shields.io/npm/v/@double-codeing/flow2spec/beta?label=beta">
  <img alt="node version" src="https://img.shields.io/node/v/@double-codeing/flow2spec">
  <img alt="license" src="https://img.shields.io/npm/l/@double-codeing/flow2spec">
</p>

Flow2Spec adds a spec-driven workflow layer to AI coding agents. It creates a small, routable `.Knowledge/` knowledge base, installs agent-specific `f2s-*` skills, and keeps optional local task state separate from product knowledge. A new session can load the facts relevant to a request instead of rediscovering the repository.

```bash
npx @double-codeing/flow2spec@latest init
```

Try the current beta:

```bash
npx @double-codeing/flow2spec@beta init
```

## Why it exists

Without a maintained, routable project memory, an agent has to rediscover the same constraints on every request. Flow2Spec keeps those facts in compact topic shards and routes each request to the topics it needs.

| Without Flow2Spec | With Flow2Spec |
| --- | --- |
| “Which module owns this table?” | `[matcher hit] m-product-review-template-library` |
| “Is batchReScore sync or async?” | `[loading deps] 4 topics · ~300 lines` |
| “Is there a lock? What is the idempotency key?” | `Redis lock ... TTL 10 min` |
| Agent searches 416 APIs, 796 files, and 4.7 MB of source before editing. | Agent reads the verified constraints first and opens the relevant files. |

Flow2Spec does not add documentation for its own sake. It keeps a small, machine-readable knowledge layer alongside the code, and lets the same skills update it when verified facts change.

## What you get

| Layer | What it does | Files |
| --- | --- | --- |
| Knowledge routing | Maps a request to the few topics the agent needs to read. | `.Knowledge/manifest-routing.json`, `.Knowledge/matchers/*.json` |
| Topic shards | Stores project facts such as APIs, limits, locks, data rules, and workflows. | `.Knowledge/topics/*.md` |
| Agent entrypoints | Installs rules and skills for Cursor, Claude Code, and Codex. | `.cursor/`, `.claude/`, `.codex/`, `AGENTS.md` |
| Skill workflows | Clarifies requirements, writes specs, implements, fixes, syncs knowledge, and commits. | `f2s-*` skills |
| Local task state | Keeps AI steps and user-side todos separate from product knowledge. | `.task/` |

## The development loop

Most work starts in natural language. The installed agent rules can route the request to the relevant matcher, topics, and `f2s-*` skill. Invoke a skill explicitly when you need to choose the workflow yourself.

```text
request
  → match topics
  → expand dependencies
  → verify missing context
  → implement / fix
  → sync verified facts back to .Knowledge
  → commit with coverage checks
```

For a larger change, the usual path is:

```text
describe the requirement in natural language
  → clarify missing details
  → generate or review the technical spec
  → implement / fix
  → sync verified facts into .Knowledge
  → check coverage before commit
```

When you need an explicit entrypoint:

```text
/f2s-kb-feat  add a capability and update project knowledge
/f2s-kb-fix   fix behavior and update the matching knowledge
```

## Build the knowledge base gradually

Flow2Spec does not require a large upfront documentation project.

1. Run `init` to create the skeleton.
2. Ask for an architecture draft when you need one; `/f2s-doc-arch` is the explicit entrypoint.
3. When a module first matters, ask the agent to import its existing context with `/f2s-kb-add <path>` or use the normal feature/fix workflow.
4. At commit time, checks remind you when code changed but knowledge did not.

The knowledge model stays intentionally split:

- `stock-docs/` — stable project background and imported source material.
- `req-docs/` — technical specs and implementation plans for concrete changes.
- `topics/` — compact, routable facts the agent should actually load.
- `matchers/` — keyword shards that route a user request to the right topics.

## Explicit skill entrypoints

Natural-language requests can select these workflows automatically when intent recognition is enabled. Use the entrypoints below when you want to choose one directly.

| Command | Purpose |
| --- | --- |
| `/f2s-req-clarify` | Clarify missing requirements until the change is unambiguous. |
| `/f2s-req-tech` | Turn confirmed requirements into an implementation-ready technical proposal. |
| `/f2s-kb-feat` | Add a capability and update project knowledge. |
| `/f2s-kb-fix` | Fix behavior and correct the matching knowledge. |
| `/f2s-kb-sync` | Sync already implemented facts into `.Knowledge/`. |
| `/f2s-kb-add <path>` | Import an existing module or document set. |
| `/f2s-git-commit` | Check changed files and knowledge coverage before committing. |

Full references:

- [Usage guide](./docs/en/usage-guide.md)
- [Commands reference](./docs/en/commands-reference.md)
- [Directory conventions](./docs/en/directory-conventions.md)
- [Architecture and principles](./docs/en/architecture.md)
- [Design principles](./docs/en/design-principles.md)
- [Project milestones](./docs/en/milestones.md)

## When not to use it

Flow2Spec is useful when context drift is expensive. It may be unnecessary for:

- throwaway one-off scripts;
- tiny solo projects where one `CLAUDE.md` is enough;
- teams that will not keep `.Knowledge/` aligned with the code.

## Learn more

- [Flow2Spec Introduction](./docs/en/Flow2Spec-Introduction.md) — product narrative, diagrams, and comparison with ordinary project memory.
- [Flow2Spec 基础介绍](./docs/Flow2Spec基础介绍.md) — Chinese long-form introduction.
- [Live demo](https://double-coding-lab.github.io/Flow2Spec) — 13-slide HTML presentation.

## License

[MIT](./LICENSE)
