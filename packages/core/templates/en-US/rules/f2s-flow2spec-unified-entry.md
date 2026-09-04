---
description: Flow2Spec unified knowledge-base entry, read progressively through .Knowledge
alwaysApply: true
---

# Flow2Spec Unified Entry Rule

This project's knowledge base has been unified under `.Knowledge/`. Read in the following order and avoid unbounded searches.

## Project-Root CLI Switches (Read When Needed)

The business repository's **project-root** `flow2spec.config.json` (`flow2spec init` fills it when missing) contains boolean fields **`subAgent`** and **`switchAgentVerification`** (**switch-agent verification**), defaulting to `false`. Before running any **`f2s-*` skill** or explaining Flow2Spec initialization, read this file. Whenever a skill or rule says a step applies "only when `subAgent` / `switchAgentVerification` is true", **the actual file value must decide whether the step runs**. Missing fields or a missing file are both treated as `false`.

> **`init` and routing source**: **`flow2spec init`** writes the unified entry into the current repository. **Cursor / Claude** read the configuration-root **`rules/f2s-flow2spec-unified-entry.*`**; **Codex** reads **`.codex/topics/f2s-flow2spec-unified-entry.md`**. The two bodies share the same source; read the entry for the current tool. When a skill references the "unified entry", **Codex** uses **`.codex/topics/f2s-flow2spec-unified-entry.md`** as authoritative.

### Semantics of the Two Fields (Template Convention)

- **`subAgent`**: if an `f2s-*` skill specifies that a step should "run in a sub agent", then **`true`** means use sub agents according to the skill, and **`false`** means complete it in the main agent. The user may request that "**only when** this field is **`true`**, the main agent should **dynamically decide** which subtasks are suitable for sub agents"; that request is valid **only when the configuration is `true`**. When configured as `false`, any instruction depending on sub-agent splitting **does not apply**, and all work is completed in the main agent. When `subAgent=true`, the main agent must explicitly decide near the start of the skill body whether to split this run; even when deciding not to split, it must output the no-split reason. **Which stage of each `f2s-*` must or should use a sub agent** is specified progressively in the skill body; if the skill does not specify a split, do not split by default.
- **`switchAgentVerification` (switch-agent verification)**: **verification/review** after writes or changes (checklist comparison, diff, self-check) is **not** "always in the main agent". By default, the **agent that performed the write is the "current agent"** and verifies within that session (**sub-agent writes are verified in the sub agent; main-agent writes are verified in the main agent**). **Only when** (1) **`switchAgentVerification` is `true`** in config, and (2) the **current `f2s-*` skill body** explicitly says that a step behaves differently "when **`switchAgentVerification`** is **`true`**", enable **cross-verification**: **sub-agent writes -> verified by the main agent**; **main-agent writes -> verified by a sub agent** (a sub-agent session **must** exist, meaning **`subAgent` is `true`** and a subtask was actually split out). If **`subAgent` is `false`**, there is no sub side to take over, so **"main write -> sub verify" does not happen**, and all verification stays in the main agent. If config is `false`, the skill does not explicitly depend on this field, or the user only vaguely asks "let the other side verify", do **not** enable cross-verification; verification remains inside the writing-side agent.

### Git Worktree and Subtask Working-Directory Hygiene (Required When `subAgent: true` or Parallel Subtasks Are Used)

Some environments create an **independent `git worktree`** or equivalent isolated directory for sub agents / parallel attempts. Rules:

1. **Creator cleans up**: if the sub side created it, the sub side should clean it before returning whenever possible. If the sub session has ended and cannot clean up, the **main agent must clean it after merging results**. Do **not** rely on "automatic cleanup later."
2. **Closing action (mandatory)**: for a worktree added **only for this subtask**, after merging or discarding the subtask result, run `git worktree remove <path>` (if the worktree is clean but removal still fails, use `git worktree remove --force <path>` after **confirming** the path has no uncommitted changes by others). Then self-check with `git worktree list`; do **not** leave known orphaned paths.
3. **Before interruption / user topic change**: if this session added a worktree, complete the removal above before ending, or write the leftover path and deletion command under `task.md` "## Notes"; when appropriate, also write it to **`user-todos.md`** for the user to run locally (see `f2s-task`).
4. **Prohibited**: after a subtask has ended and the main branch has continued, do not keep a worktree directory that was only for an attempt (it easily causes confusing commits and disk buildup).

## Read Order (Mandatory)

1. First read `.Knowledge/manifest-routing.json`, prefer routing by `taskToTopicRules`; first-pass evidence is each rule's `task` name and `summary` (one-line intent digest); as needed, read the matcher shard from `matcherPath` for its word lists (`includeAny` / `includeAll` qualifiers and `excludeAny` / `excludeAll` vetoes; the veto gate is absolute and outranks exact `task` matches — see `topics/kb-routing-summary.md`). If nothing matches, enter fallback recall.
   - If the matched topic has dependencies in `topicDependencies`, read dependency topics first, then the main topic.
   - Routing manifests are maintained only by `f2s-*` skill flows and do not depend on extra CLI subcommands.
2. Read `.Knowledge/index.md` only as needed to confirm topic semantics and boundaries.
3. Then read `.Knowledge/topics/<topic>.md` (**routing summary**: topic id, path conventions, next-step pointers). If the topic is **`implement-tech-design`** or **`f2s-doc-routing`**, **continue reading the full configuration-root rules** **`rules/f2s-implement-tech-design.*` / `rules/f2s-stock-docs-vs-req-docs.*`** as execution basis (`.Knowledge/topics` does not duplicate those long-form texts).
4. If background is needed, read `.Knowledge/stock-docs/<doc>.md`.
5. Drill into business source code only when the first four steps are insufficient.
6. After a match, always run `match -> expand -> verify -> act`:
   - `match`: pick the primary candidate by semantic matching against each rule's `task` name and `summary`; both `summary` and `includeAny` are semantic anchors, not literal allowlists—near-synonym hits are allowed;
   - `expand`: expand `topicDependencies` and keep the next-highest candidate for supplementary verification;
   - `verify`: check gaps before acting (missing key topics, boundaries, or context); **if the matched topic body does not cover the core nouns of the user's question, you must also read the next-highest candidate's `summary` and matcher shard before deciding—do not answer directly**;
   - `act`: act only when confidence is sufficient; clarify first when confidence is low.
7. A full cross-matcher supplemental search (top-k) is allowed only when one of these conditions is true:
   - `taskToTopicRules` has no match;
   - the score gap between primary and secondary candidates is too small (low confidence);
   - the gap check fails (missing key topic/dependency/context);
   - the user explicitly asks for "full check / don't miss anything".

## Task Routing

- Technical-design implementation: first read `.Knowledge/topics/f2s-implement-tech-design.md` (summary), then read the **full `rules/f2s-implement-tech-design.*`**; requirement documents live in `.Knowledge/req-docs/` by default.
- Directory-boundary decisions: first read `.Knowledge/topics/f2s-stock-docs-vs-req-docs.md` (summary), then read the **full `rules/f2s-stock-docs-vs-req-docs.*`**.

## Machine-Readable Source-of-Truth Semantics (Rule Layer)

- `taskToTopicRules`: first-priority task routing.
- `taskToTopicRules[].summary`: first-pass recall field (one-line intent digest), mechanically synced by `flow2spec kb build` from the topic frontmatter `summary`; never handwritten on the manifest side; participates in `match` as a semantic anchor.
- `taskToTopicRules[].matcherPath`: direct path to the matcher-word shard; read a single matcher file as needed.
- `taskToTopicRules[].matcherId`: stable matcher identifier; must match `id` inside the matcher shard.
- `topicDependencies`: load dependency topics first after the main topic matches.
- `topicMetadata`: topic-governance metadata. It only affects reading expectations, does not participate in matcher hits, does not decide whether a topic is read, and does not change execution mandatoryness. Execution mandatoryness always comes from explicit requirements in `AGENTS.md`, rules, skills, and topic bodies. When reading `topicMetadata[topicId].primary` / `tags`: `config` means focus on configuration items, switches, defaults, and initialization parameters; `policy` means prioritize mandatory/prohibited/gate/process constraints in the body; `feature` is background for implemented business/product capability; `module` is background for directories, packages, module boundaries, and engineering structure. `confidence` only allows `manual` / `inferred`; do not write metadata without clear classification evidence.
- `matcherPath(includeAny/includeAll/excludeAny/excludeAll)`: task keyword matcher lists (first two form the qualifier gate, last two the veto gate — see `topics/kb-routing-summary.md`).
- `fallbackTopic`: must be read when neither task nor keyword matches, but is only a low-confidence fallback, not final execution basis.
- `.Knowledge/manifest-routing.json + matcherPath shard files` are the machine-readable source of truth (keywords live only in `matchers/*.json`).
- `.Knowledge/index.md` is not a machine-readable source of truth; it is only human-readable navigation and semantic-boundary validation.
- After entering `fallbackTopic`, first perform supplemental recall or clarification, then decide whether to make changes.

## Knowledge Gaps and Responses (By Scenario)

| Scenario | Response |
| --- | --- |
| **1a Documents exist in the KB but routing is missing** | Use `f2s-kb-build` / `f2s-kb-sync` / `f2s-kb-add` to add `taskToTopicRules`, `matcherPath` shards, and `topicPaths`; expand `includeAny` / `includeAll` to cover common user phrasing, and use `excludeAny` where mis-routes recur. Agent side: use `fallbackTopic` triage and state that "routing needs to be added"; do **not** replace configuration with full-repo file scanning. |
| **1b Matched, but context is insufficient** | First `expand` (`topicDependencies` + secondary candidate), then `verify` and name which `stock-docs`/`req-docs` file or topic section is missing. If still insufficient, **ask the user for a document or path** instead of running an unconditional full cross-matcher search. **If the Agent needs to drill into source code**: first give the user a **visible gap note** (KB read, what is missing, which 1-2 files you plan to read); see the "gap gate" in **`f2s-knowledge-preflight`**. **Do not** run consecutive `Grep` calls or disorderly source exploration without that note. |
| **2 The KB has no corresponding document** | After reading routing + matched matcher + related topics once, **explicitly acknowledge in the reply that the KB has no coverage**, then choose: drill into business code / ask the user to provide `req-docs` or a PRD. **Do not** repeatedly read lists to pretend "one more search will find it." Before source drilling, also satisfy the visible gap-note requirement in **`f2s-knowledge-preflight`**. |
| **2a Repeated list reading wastes tokens** | Within the **same task line**, treat `manifest-routing.json` as a stable snapshot: rereading it in full requires a reason (for example, the user says routing/knowledge was updated by `f2s-kb-build` / `f2s-kb-sync` / `f2s-kb-add`, or the manifest/matcher was **manually edited**). **Do not equate** running **`flow2spec init`** alone with "business KB was updated": `init` mainly writes the configuration root, fills missing directories, and aligns package-level routing structure. **stock-docs / req-docs, topic routing summaries, and matcher entries** are maintained by **`f2s-*` skill flows**. `init` writes rules into the configuration root **`rules/*`** (or equivalent extension) and writes Codex mirrors into **`.codex/topics/*.md`**. Read only the **single** `matcherPath` corresponding to the current rule; do not traverse the whole `matchers/` directory for enumeration. Open `index.md` only when topic semantics need checking; do not alternate between manifest and index to "refresh lists." |

### Execution Points for Knowledge Gaps (Avoid "Table Says It, Behavior Skips It")

- **"Explain to the user" and "explicitly acknowledge no coverage" must be visible natural language to the user**; they must not be hidden only in internal analysis or tool traces. Details and stop conditions are in **`f2s-knowledge-preflight`** (gap gate, exploration limit).
- **Prohibited**: after hitting **1b / 2**, entering chained "multiple files + dependency directories" source exploration without the visible note above. Running another `Grep` round for each new "entry symbol" is a typical anti-pattern.
- Facts such as **HTTP status, error body, and whether redirects happen** must **not** be answered from training data or experience with other repositories; use only the implementation actually read in the current repository during this turn.
- When ordinary Q&A drills into source code and answers from it, first complete the initial read and gap gate according to **`f2s-knowledge-preflight`**, then complete final KB follow-up closing according to **`f2s-kb-feedback-closing`**. Only suggest; do not write automatically.

## Knowledge-Base Writing Style (Global; Applies When Writing stock-docs / topics / index)

**Prefer affirmative phrasing**: when stating correct information, directly say "what it is / where it is / how to do it". Do not communicate it through "not X / non-X / no longer X"; even if the old description is wrong, negating the old version anchors the wrong premise in the reader's mind.

- Wrong: `imported with the package, not injected through window`
- Right: `import with import { <symbol> } from '<package-name>'`

**Exception (explicit negation is appropriate)**: when both A and B are logically valid approaches but the project has made an **exclusive choice**, write "do not use B"; otherwise readers cannot tell whether B remains optional.

## Knowledge-Base Version Self-Check (Hook Auto-Triggered; First Time Each Day Only When updateCheck.enabled=true)

Each initialized client uses its own startup/update mechanism when supported; the generated client entrypoint is authoritative. Clients without hooks continue to use the generated rules, skills, `AGENTS.md`, or topic mirrors. Version-check scripts compare versions and, when an upgrade is needed, inject an imperative upgrade notice through `additional_context` where the client supports it. Project-level skill discovery clients use `.dsh/skills/` and `.dsh/topics/` through `flow2spec init dsh`.

**Rule-layer fallback check** (backup for script cache):

1. Read `flow2spec.config.json` -> if `updateCheck.enabled` is not `true`, skip and show no notice.
2. Read `.Knowledge/update-check.json` -> if the file exists and `checkedAt` is on the same local calendar day, do not query npm again. Handle two scenarios separately:
   - **`coreUpdateAvailable=true` and `templateUpdateAvailable=false`** (Core-only update): the agent **must actively run** `flow2spec update --cli` (fallback to `npx @double-coding/flow2spec update --cli` if the global CLI is missing; if that still fails, report in one line and continue without blocking) + one idempotent `flow2spec init <initialized agents>` at the start of this turn to refresh the Hook. Before running, tell the user in one line "Auto-updating CLI/Core; knowledge-base topics are unchanged". Afterwards delete `.Knowledge/update-check.json`, **do NOT** enter `f2s-kb-upgrade`, and **do NOT ask the user for confirmation** (Core-only updates do not affect knowledge-base topics).
   - **`templateUpdateAvailable=true`** (Template changed; Core may also have changed): the agent **must** relay the notice at the start of the turn **and ask the user whether to run** update + init. On consent, run `flow2spec update --cli` + init, then use `projectRev` / `pkgRev`: equal -> delete the cache and stop; unequal -> invoke the `f2s-kb-upgrade` skill (may resume from its step 2c).
   - `.Knowledge/manifest-routing.json.version` is Template Version and must not be compared directly with Core Version.
3. If neither of the two steps above skipped the check: run the update-check script under the current agent configuration root (Claude: `node .claude/hooks/f2s-update-check.js`; Cursor: `node .cursor/hooks/f2s-update-check.js`; Codex: `node .codex/hooks/f2s-update-check.js`) and parse JSON from stdout:
   - If it contains `hookSpecificOutput.additionalContext`: **tell the user** that content and follow its separate Core-only or Template-update instructions.
   - If there is no output or parsing fails: stay silent.
4. If any step errors, silently skip it and do not affect normal conversation.

## Topic Authoring Pointer

When adding or modifying `.Knowledge/topics/<topic>.md`, adjusting `manifest-routing.topicDependencies`, or deleting / migrating topics, the **authoring-side** guideline uses **`rules/f2s-topic-authoring.*`** as the single source of truth (**Cursor/Claude**: `rules/f2s-topic-authoring.mdc`; **Codex**: `.codex/topics/f2s-topic-authoring.md`). This entry is the **consumption side** (how to route / read / fall back using existing topics), and both coexist; in hard conflicts, this unified entry wins. `f2s-kb-build` / `f2s-kb-add` / `f2s-kb-feat` / `f2s-kb-fix` / `f2s-kb-sync` / `f2s-kb-rm` must Read that full rule before any topic write.

## Prohibited

- **Neutrality for distributed content**: examples in skill/rule/knowledge bodies must be **neutral**. Do not write a specific business-domain name, a single organization's npm package name, or a `docs/` path that exists only in the Flow2Spec product repository. Use placeholders such as `<capability>` and `src/<module>/`.
- After using `git worktree` or an isolated directory for subtasks, **do not** end the session without `git worktree remove` or without handing off the deletion command (see "Git worktree and subtask working-directory hygiene" above).
- Before viewing `.Knowledge/manifest-routing.json`, do not run unbounded full-repository scans. Read `.Knowledge/index.md` only when topic semantics need confirmation; do not repeatedly alternate between index and manifest as a substitute for decision-making.
- Do not use `stock-docs` as direct coding input documents; implementation from a design should use `req-docs`.
- Do not treat `fallbackTopic` as a final match and directly implement changes from it.
- Do not run a full cross-matcher supplemental search unless the trigger conditions are met.
