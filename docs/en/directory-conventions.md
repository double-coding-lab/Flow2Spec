[中文](../目录与路径约定.md) | [English](./directory-conventions.md)

# Directory and Path Conventions

## Core Boundary

- `.Knowledge/`: **Knowledge ring** — business docs and machine-readable routing ([architecture.md §2](./architecture.md))
- `.task/`: **Task ring** — change tracking (not inside `.Knowledge/`)
- `Config Root` (`.cursor/.claude/.codex`): **Rules ring + skills ring**

See [architecture.md §1](./architecture.md) for Memory Coding four rings.

---

## Directory Responsibilities

| Path | Responsibility |
| --- | --- |
| `.Knowledge/stock-docs/` | **L3** Architecture, final drafts, reference documents |
| `.Knowledge/req-docs/` | **L3** Requirement clarification, technical proposals |
| `.Knowledge/topics/` | **L2** Topic summaries (hard constraints, boundaries, pointers) |
| `.Knowledge/template/` | Templates for final drafts / technical proposals |
| `.Knowledge/index.md` | Human-readable index |
| `.Knowledge/manifest-routing.json` | **L0** Machine-readable routing skeleton (task/topic/`topicDependencies`/`topicMetadata`) |
| `.Knowledge/matchers/*.json` | **L1** Keyword fragments (`id/includeAny`); **match** reads one shard via `matcherPath` |
| `.Knowledge/migration-report.md` | Migration comparison table and deletion path list written by `f2s-kb-migrate` |
| `.task/` | Change tracking task directory (`active/` for in-progress, `completed/` for archived with directory name in the format **`<YYYYMMDD>-<task-name>`** (date first), `todo.json` for active task index); created only when `changeTracking.*` is `true` or `f2s-req-plan` is explicitly invoked |
| `Config Root/rules/` | Rule files (Cursor `.mdc`, Claude `.md`) |
| `Config Root/skills/` | Skill definitions (`SKILL.md`) |
| `Config Root/template/` | (Deprecated) No longer written to; historical directories may be cleaned up |
| `.codex/AGENTS.md` | Codex unified entry point and loading instructions |
| `flow2spec.config.json` | Project root configuration, controls `subAgent`, `switchAgentVerification`, `changeTracking` (nested object with `feat` / `fix` / `implement` sub-items) |

> See [Usage Guide Section 1](./usage-guide.md) for multi-platform references and path tables (detail maintained in a single table); **the authoritative source remains `Read(flow2spec.config.json)`**.

---

## Path Constraints

1. `.Knowledge/topics` is the knowledge routing topic layer; it is allowed and encouraged to be maintained via `f2s-*` skills.
2. `f2s-kb-build` reads from `.Knowledge/stock-docs` and updates `.Knowledge/topics`, `.Knowledge/index.md`, `.Knowledge/manifest-routing.json`, `.Knowledge/matchers/*.json`.
3. Implementation tasks uniformly read from `.Knowledge/req-docs/*.md`.
4. `manifest-routing.json` and `matchers/*.json` are maintained by `f2s-*` skill workflows; `.Knowledge/manifest-matchers.json` is no longer used (`flow2spec init` will delete legacy files).
5. `.task/` and `.Knowledge/update-check.json` are local runtime state and should not be committed by default; `flow2spec init` non-destructively adds the corresponding `.gitignore` entries.

---

## Topic Metadata

`manifest-routing.json.topicMetadata` is machine-readable governance metadata for topics. It is only used for inventory, filtering, routing audits, upgrade gap checks, and reading expectations; it does not participate in matcher hits, does not decide whether a topic is read, is not a source of execution constraints, and must not drive `topicId` or filename changes. Execution constraints always come from explicit requirements in `AGENTS.md`, rules, skills, or topic bodies.

`topicMetadata` is independent from `topicPaths`, and each key must be a topicId already present in `topicPaths`. When creating a new topic, metadata may be written if there is clear evidence; classification alone must not create, rename, or split topics.

| Field | Values | Meaning |
| --- | --- | --- |
| `primary` | `feature` / `module` / `config` / `policy` | Single primary classification. Read the topic body and write the type that best represents its core content. |
| `tags` | Array of `feature` / `module` / `config` / `policy` | Optional secondary classes; values must not repeat `primary`. |
| `confidence` | `manual` / `inferred` | `manual` means human-confirmed; `inferred` means evidence-backed inference. When evidence is insufficient, do not write metadata and list it as pending confirmation in the summary. |

Type meanings:

| Type | Reading expectation |
| --- | --- |
| `feature` | Landed business or product capability background |
| `module` | Directory, package, module boundary, and engineering structure |
| `config` | Configuration items, switches, defaults, initialization parameters |
| `policy` | Process, rule, constraint, gate, prohibition, agent orchestration, skill step |

## Topic Granularity

A topic is a routing summary plus key boundaries; details belong in `stock-docs/`. Consider splitting into a main topic plus independently matchable sub-topics when its stock-doc exceeds 300-500 lines, matcher `includeAny` exceeds 12 terms, or the body spans more than 3 unrelated responsibility areas.

---

## Related Documents

- [Usage Guide](./usage-guide.md)
- [Commands Reference](./commands-reference.md)
- [Architecture](./architecture.md)
- [Usage Scenarios](./usage-scenarios.md)
- [Project Milestones](./milestones.md)
