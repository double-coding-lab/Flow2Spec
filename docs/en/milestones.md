[中文](../项目里程碑.md) | [English](./milestones.md)

# Project Milestones

> **Scope**: whole project  
> **Updated**: 2026-07-02

## Overview

| Stage | Time | Summary |
| --- | --- | --- |
| M24 · Codex rule mirror fix + upgrade Step -1 smart preflight + repo-local dev discipline | 2026-07-02 | Fixed writeCodexRuleMirrors filter that missed .md files (kept .codex/fs-rules empty after init); fs-kb-upgrade Step -1 rewritten as "probe first, upgrade on demand" (A already latest = skip / B behind = dispatch sub-agent / C missing = dispatch sub-agent); added repo-local fs-dev-workflow-constraints rule and repo-dev-check self-check skill |
| M23 · fs-kb-distill auto tier judgment + fs-kb-upgrade Step -1 | 2026-06-30 | Dropped --fast parameter; built-in "light tier / strict tier" 4-dimension auto judgment; fs-kb-upgrade adds Step -1 background sub-agent upgrading global cli |
| M22 · pkgRev top-level write + init auto-upgrade global cli | 2026-06-29 | manifest top-level pkgRev field overwritten on every init; init tail auto-upgrades global package when latest is higher |
| M21 · fs-kb-upgrade templateRevision fast path and self-update loop | 2026-06-29 | project vs package projectRev equal → skip steps 3/3a/3b; init-after SKILL changes rerun from step 2c without re-init; feedback-closing removed blanket KB-skill prohibition with summary requirement; inferred lands directly |
| M20 · init defaults flipped | 2026-06-29 | subAgent / switchAgentVerification / intentRecognition default values flipped to true; new projects default to sub-agent orchestration, cross-verification, intent-recognition auto-routing |
| M19 · .task/ adds acceptance.md acceptance checklist | 2026-06-24 | `.task/active/<task>/` adds acceptance.md (separation of duties from user-todos.md); after task.md fully [x], must write before archiving; archive directory naming unified to `<YYYYMMDD>-<task-name>` |
| M18 · fs-kb-distill and rule refactor | 2026-06-14 | Added fs-kb-distill knowledge extraction skill; feedback-closing refactored to single entry; Codex AGENTS.md slimmed to "two steps" guide; SessionStart hooks landed; CLI cross-platform extension handling |
| M17 · Locale-aware template initialization | 2026-06-08 | flow-spec init supports zh-CN/en-US single-choice initialization; public README defaults to English; Chinese moved to README.zh-CN.md |
| M16 · Intent recognition routing | 2026-06-08 | Added intentRecognition config switch and fs-intent-routing rules; high-confidence operation intent can route to fs skills automatically |
| M15 · General technical proposal and Q&A closing | 2026-06-05 | fs-req-backend renamed to fs-req-tech; template extended to frontend/backend/fullstack; source-code Q&A gained knowledge-backfill closing |
| M14 · fs-git-commit quick commit | 2026-06-04 | fs-git-commit quick commit skips knowledge coverage check while keeping diff, precise add, hooks, and commit-message display |
| M13 · Update checks and startup reminders | 2026-06-04 | Added updateCheck.enabled config, version-check hook, daily cache; Claude/Cursor/Codex SessionStart upgrade reminders |
| M12 · Topic metadata and init merge checks | 2026-06-03 | topicMetadata supports primary/tags/confidence; init gained merge validation and template-priority behavior; skills renamed to kb-/doc- prefix |
| M11 · Knowledge engineering rules and skill skeletons | 2026-06-03 | Added skill-authoring spec, fs-kb-addRules, fs-topic-authoring, and large-feature split strategy |
| M10 · Documentation capture rules | 2026-05-27 | fs-doc-add added multi-module detection; dual-repo package naming rules; global negation-style constraint |
| M9 · README and task capability exposure | 2026-05-26 | README and English README expanded with usage flow, command reference, task checklist, and daily workflow |
| M8 · Document pipeline and directory boundaries | 2026-05-21 | Reorganized docs directory; doc-arch drafts must go through doc-final; new-requirement skill chain clarified |
| M7 · Four-source milestone generation | 2026-05-18 | Added fs-doc-milestone skill and milestone template; stages backed by req-docs/git/.task/knowledge topics |
| M6 · Codex root AGENTS.md discovery | 2026-05-16 | flow-spec init codex writes full rules to root AGENTS.md; .codex/AGENTS.md becomes a pointer |
| M5 · CLI operations and task routing | 2026-05-15 | CLI added version/update commands; package template manifest includes fs-task and fs-req-plan routing |
| M4 · Public demo and bilingual materials | 2026-05-13 | Added presentation sources, sync-gh-pages.sh, English slides and 6 English docs; bilingual README entry points |
| M3 · .flow-spec machine-readable routing | 2026-05-08 | Introduced .flow-spec, manifest-routing.json, topics and matchers; match→expand→verify→act chain; config preflight and KB preflight rules |
| M2 · OpenSpec removal and fs skills | 2026-04-23 | Removed OpenSpec/opsx; converted to fs skill workflow; requirements clarification and technical proposal generation established |
| M1 · CLI bootstrap and OpenSpec workflow | 2026-02 ~ 2026-04 | flow-spec started as an installable CLI; early AI collaboration organized around OpenSpec/opsx change flows |

## M24 · Codex Rule Mirror Fix + Upgrade Step -1 Smart Preflight + Repo-local Dev Discipline

- Fixed `writeCodexRuleMirrors` filter: the original `endsWith(".mdc")` skipped every `.md` rule file, leaving `.codex/fs-rules/` empty after `flow-spec init codex`; extended to match both `.md` and `.mdc` and unify output to `.codex/fs-rules/*.md`
- fs-kb-upgrade Step -1 rewritten from "unconditionally dispatch a sub-agent to run `npm i -g`" to **probe first, upgrade on demand**: the main agent runs `flow-spec --version` + `npm view ... version` + `command -v npx` in the foreground and branches A/B/C:
  - A: installed and on latest → skip upgrade entirely; Step 2 defaults to `flow-spec init`
  - B: installed but behind → dispatch an independent sub-agent to run `npm i -g ...@latest` in the background (fire-and-forget); Step 2 uses `npx @latest init`
  - C: missing / latest unknown → same as B; if all probes fail, Step -1 can be skipped entirely
- Step 2 command list default form is now driven by the Step -1 branch; added "manual override" clause and a "helper commands" note (`flow-spec --version` / `flow-spec update`)
- Added **`fs-dev-workflow-constraints`** rule long text (Cursor / Claude / Codex, three ends): writes only to `templates/`, never to the config root; user drives distribution; dual repos stay in sync — **this rule lives only inside this repo, not in `templates/`**, so downstream projects never receive it
- Added **`repo-dev-check`** self-check skill: on this repo, before committing, walks every pending change through the "templates vs config-root" decision table + dual-repo diff + distribution guidance; trigger words include "dual-repo drift", "write boundary", "templates vs config root"
- `.flow-spec/topics/fs-dev-workflow-constraints.md` thinned to a routing summary pointing to the config-root long text; matcher added new trigger words (`sync:agents`, `写盘边界`, `双仓漂移`); index.md topic table updated with related-doc column
- Dual-repo sync for repo-local rule / skill: content contains the dual-repo package-name cross-reference table (`@double-codeing` / `@ctrip`), so we sync byte-for-byte across repos without rewriting package names

## M23 · fs-kb-distill Auto Tier Judgment + fs-kb-upgrade Step -1

- fs-kb-distill removed the `--fast` parameter; built-in "light tier / strict tier" auto judgment based on 4 dimensions: upstream case, business source files Read, function/class references, user rejection signal
- Light tier skips drill-down quantitative scoring, existing-topic description-depth evaluation, decision matrix, and style alignment; Step 5 routing / Step 6 write-to-disk are never skipped
- fs-kb-upgrade adds Step -1: before entering Step 0, dispatch an independent sub-agent in background to run `npm i -g <pkg>@latest`, not awaited, main flow continues immediately; not bound by subAgent config
- Step -1 complements cli.js `maybeAutoUpdateGlobalInstall`: skill-side proactive trigger + init-tail fallback trigger
- feedback-closing case 1/2/3 closing blocks reverted to single-command suggestion (no `--fast` hint)
- Command docs and commands-reference added "Execution Tiers" section explaining light/strict trigger conditions

## M22 · pkgRev Top-Level Write + Init Auto-Upgrade Global cli

- `lib/init.js` added `finalizePkgRev`: writes package-template projectRev to project-side manifest top-level `pkgRev`, overwritten on every init
- init also overwrites `manifest.version` to current package version, keeping project manifest in sync with the CLI version used
- `cli.js` added `maybeAutoUpdateGlobalInstall`: at init tail, if globally installed and npm latest is higher, auto-runs `npm i -g <pkg>`; silently skipped for npx-only users
- fs-kb-upgrade Step 2c now reads `pkgRev` directly from manifest top-level, no fallback scanning
- Terminology unified to `projectRev` (package-template side) / `pkgRev` (project-landed side)

## M21 · fs-kb-upgrade templateRevision Fast Path and Self-Update Loop

- fs-kb-upgrade introduced `templateRevision` (later renamed `projectRev`) fast path: when project revision equals package-template revision, skip steps 3, 3a, 3b
- Self-update loop fix: after init, on re-reading SKILL.md with a version change, rerun from step 2c per the new literal text, no second `flow-spec init`
- `fs-kb-feedback-closing` refactored: removed the blanket "no closing block inside any KB skill" rule; replaced with distill self-prohibition + other KB skills still judge per the 4 cases
- feedback-closing landed "summary requirement": cases 1~3 must state in one line what distill would actually ingest
- topicMetadata guideline clarified: `inferred` writes directly without prior user consent, correcting the "must manually confirm" misread

## M20 · Init Defaults Flipped

- `flow-spec.config.json` three boolean fields' defaults flipped to `true`: `subAgent` / `switchAgentVerification` / `intentRecognition`
- New projects running `flow-spec init` now have these enabled by default: sub-agent orchestration, cross-agent disk-write verification, intent-recognition auto-routing
- Old projects that explicitly wrote these fields are unaffected; on upgrade, old projects still missing these fields are filled with the new `true` default
- With defaults flipped, the `fs-*` skill sub-agent prerequisite and cross-agent verification switch from "opt-in" to "opt-out"

## M19 · .task/ Adds acceptance.md Acceptance Checklist

- `.task/active/<task>/` adds `acceptance.md`, separated in duty from `user-todos.md`: the former manages "user acceptance", the latter manages "user todos"
- New archive gate: after `task.md` is fully `[x]`, before moving the directory to `completed/`, `acceptance.md` must be written; if still a placeholder or missing, archiving is forbidden
- Task-creation step 3.e also creates an `acceptance.md` placeholder; not written during execution; after task.md completes, the agent organizes it into a formal acceptance checklist
- Archive directory naming unified to `<YYYYMMDD>-<task-name>` (local 8-digit date prefix), enabling chronological sorting
- `fs-task` rule, `fs-req-plan` skill, and change-tracking steps inside `fs-kb-*` skills updated accordingly
- Version bumped to 3.2.1

## M18 · fs-kb-distill and Rule Refactor

- Added fs-kb-distill skill: extracts reusable knowledge facts from Q&A, auto-decides new topic or append to existing
- Refactored fs-kb-feedback-closing: unified suggestion entry to fs-kb-distill, replacing fs-kb-add/fs-kb-sync dual entry
- Codex root AGENTS.md slimmed: removed embedded rules, replaced with "do these two things first" short guide
- Codex hooks landed: .codex/hooks.json adds SessionStart config-summary and version-check dual scripts
- CLI cross-platform extension handling: Cursor rules keep .mdc, Claude/Codex rules switch to .md, codexAgentsAdapter handles .mdc reading
- intentRecognition enabled by default in internal repo

## M17 · Locale-Aware Template Initialization

- templates/ split into zh-CN/ and en-US/ directories
- flow-spec init supports single-choice locale initialization, defaults to Chinese
- English templates cover rules, skills, knowledge, AGENTS.md and flow-spec.config.json with English filenames
- Public README defaults to English; Chinese moved to README.zh-CN.md; README.en.md kept for compatibility

## M16 · Intent Recognition Routing

- flow-spec.config.json adds intentRecognition boolean field
- Added fs-intent-routing rules: high-confidence operation intent routes to matching fs skill automatically
- Discussion, evaluation, low-confidence, or incomplete-requirement inputs stay in normal conversation or clarification
- Skill routing is blocked when intentRecognition is not read or set to false

## M15 · General Technical Proposal and Q&A Closing

- fs-req-backend renamed to fs-req-tech
- Technical proposal template upgraded from backend-only to frontend/backend/fullstack general purpose
- Added fs-kb-feedback-closing rules: four-case knowledge-backfill suggestion closing for source-code Q&A
- Reduced unnecessary fs-kb-add/sync prompts in ordinary Q&A flows

## M14 · fs-git-commit Quick Commit

- fs-git-commit supports quick commit mode, skips knowledge coverage check
- Retains diff reading, conflict checking, precise add, git hooks, and commit headline display
- Auto push/pull disabled; user confirmation preserved

## M13 · Update Checks and Startup Reminders

- flow-spec.config.json adds updateCheck.enabled config
- Version-check hook: manifest version vs npm latest; daily cache to .flow-spec/update-check.json
- Claude: writes SessionStart version-check script to .claude/settings.json
- Cursor: writes SessionStart version-check script to .cursor/hooks.json
- Codex: writes SessionStart config-summary and version-check dual scripts to .codex/hooks.json
- Rule-layer fallback: script cache and rule-layer updateCheck serve as mutual backup

## M12 · Topic Metadata and Init Merge Checks

- manifest-routing.json adds topicMetadata with primary/tags/confidence fields
- fs-topic-authoring rules add topicMetadata classification criteria (4 primary types, confidence rules)
- init copySkills auto-removes old skill directories without deleting user-custom skills
- init supports template-priority overwrite and merge validation
- 6 skills renamed to kb-/doc- prefix convention
- Redundant skills (fs-coding-guide, fs-doc-routing) removed

## M11 · Knowledge Engineering Rules and Skill Skeletons

- Added skill-authoring topic + matcher: unified SKILL.md skeleton, naming, and section order for templates/skills/fs-*
- Added fs-kb-addRules skill (renamed from fs-kb-capture): verbal rule capture, auto-decides new topic or merge into existing
- Added fs-topic-authoring rules: topic authoring guidelines covering naming, skeleton, topicDependencies, and large-feature split
- Large-feature split strategy: main topic + sub-topic structure recommendation with split thresholds and exclusion rules

## M10 · Documentation Capture Rules

- fs-doc-add (predecessor of fs-kb-add) added multi-module detection to prevent merging unrelated modules into single output
- Dual-repo milestone stock-doc added package naming rules (public @double-codeing/flow-spec vs internal path)
- Global rules added negation-style constraint: use affirmative statements instead of "not X / non-X"

## M9 · README and Task Capability Exposure

- README added usage flow and command quick reference
- README added task checklist capability and daily workflow description
- English README synced with capability descriptions; removed misleading fs-req-plan reference

## M8 · Document Pipeline and Directory Boundaries

- Docs directory reorganized, removed product-repo docs path coupling
- Established doc-arch → doc-final → kb-build pipeline; drafts must not drive kb-build directly
- Updated new-requirement skill chain; clarified each skill's role in the requirements→implementation→knowledge loop
- .flow-spec/stock-docs and req-docs directory conventions de-coupled from product-specific paths

## M7 · Four-Source Milestone Generation

- Added fs-doc-milestone skill: generates milestones from req-docs, git log, .task, and knowledge topics
- Added project milestone template: defines stage structure, field conventions, and no-testing/acceptance constraint
- Milestone stages record only feature/capability changes; engineering changes merged into feature stages

## M6 · Codex Root AGENTS.md Discovery

- flow-spec init codex writes complete rules to root AGENTS.md
- .codex/AGENTS.md becomes a pointer, reducing risk of Codex missing rules
- Established unified pattern: Claude/Cursor/Codex each write rules to their own config root

## M5 · CLI Operations and Task Routing

- CLI added version command: reads package.json and outputs current version
- CLI added update command: self-update
- Package template manifest includes fs-task and fs-req-plan routing entries and topicDependencies

## M4 · Public Demo and Bilingual Materials

- Added presentations/flow-spec-intro-public source files
- Added sync-gh-pages.sh and GitHub Pages deployment
- Added English slides and 6 English docs
- README added bilingual entry points and demo links

## M3 · .flow-spec Machine-Readable Routing

- Introduced .flow-spec/ directory: manifest-routing.json, topics/, matchers/ structure
- Established match→expand→verify→act knowledge consumption chain
- Added fs-knowledge-preflight rules: mandatory first-read of manifest-routing.json with gap-gate constraints
- Added fs-config-check rules: fs-* skills must read flow-spec.config.json first
- Added Karpathy full-platform coding behavior guidelines (fs-karpathy-guidelines)

## M2 · OpenSpec Removal and fs Skills

- Removed OpenSpec/opsx dependencies and change-flow organization
- Fully converted to fs self-owned skill workflow (skills/ directory structure established)
- fs-req-clarify and fs-req-tech skills initialized
- fs-* skills established as the base execution units for knowledge and requirement pipelines

## M1 · CLI Bootstrap and OpenSpec Workflow

- flow-spec initialized as an installable CLI tool
- Early AI collaboration organized around OpenSpec/opsx change flows
- Basic init command supports Cursor/Claude/Codex config root writing

## Pending

- `.task/active/lazy_loading_rule_optimization/` in-flight task (created 2026-06-03, focused on rule slimming / lazy loading optimization) is not yet closed; steps incomplete; this round does not form a delivered milestone
- No other gaps
