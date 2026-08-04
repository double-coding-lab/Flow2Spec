---
name: f2s-git-commit
description: Commit completed code to Git: by default check both changes and knowledge-base coverage; when the user explicitly asks for "快捷提交" / quick commit, skip only the knowledge coverage check; **when the pending changes are pure docs / knowledge-base itself**, or **f2s-kb-sync / kb-feat / kb-fix / kb-add / kb-addRules / kb-distill ran within the last 30 min**, auto-skip the coverage check; after generating a commit message with an emoji first line, commit directly (the first line must be shown in the same reply; no separate confirmation is required); git pull-like fetch/merge operations require user confirmation first. Triggers: f2s-git-commit、提交代码、快捷提交、git commit、帮我提交、quick commit、commit code
---

> Execution scope: this skill performs Git operations for the user. Do not use `git add -A` / `git add .`, do not skip hooks (`--no-verify`), and do not push automatically. Before any `git pull` / `git fetch` operation that merges into local work, obtain explicit user confirmation for the "pull". `git commit` does not require a separate confirmation round (see Steps 3-4). When the user explicitly asks for "快捷提交", skip only Step 2, the knowledge-base coverage check; all other safety steps still apply.

## Orchestration (main / sub agent)

- The semantics of `subAgent` / `switchAgentVerification` use the unified entry as the only source of truth: **Cursor/Claude** read the config-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md`.
- This skill is performed entirely by the main agent (**pull confirmation** cannot be delegated to a sub agent; `git commit` does not require a separate user-confirmation round; see Steps 3-4).

# f2s-git-commit (Commit Code)

## Mandatory Flow

### Quick Commit Mode

When the user explicitly says **"快捷提交"**, **"快速提交"**, or **"quick commit"** in this turn, enter quick commit mode:

- Skip **Step 2: Knowledge-base coverage check**. Do not read `.Knowledge/topics/` / `.Knowledge/stock-docs/` for coverage judgment.
- Do not prompt the user to run `f2s-kb-sync` / `f2s-kb-feat` first.
- **Do not skip** Step 1 change reading and conflict-marker checks.
- **Do not skip** Step 3 commit-message generation and display.
- **Do not skip** Step 4 precise `git add <file list>`, normal `git commit`, and Git hooks.
- **Do not** use `git add -A` / `git add .` / `--no-verify` / automatic push because this is a quick commit.

### Step 1: Read Changes (Read-Only)

```bash
git status --short
git diff HEAD
```

- Distinguish three file categories from `git status --short`:
  - **Staged**: already `git add`ed, prefixes such as `M `, `A `, `D ` (first column non-empty)
  - **Unstaged**: tracked but not added, prefixes such as ` M`, ` D` (second column non-empty)
  - **Untracked**: `??` prefix, new files not tracked yet
- If all three categories are empty (nothing to commit), tell the user and stop.

**Conflict check (required, before everything else)**:

Scan all changed file contents. If any file contains conflict markers `<<<<<<<`, `=======`, or `>>>>>>>`, stop immediately and report:

```
❌ Unresolved merge conflict detected:
  - <file path>

Please resolve the conflict before committing.
```

### Step 2: Knowledge-Base Coverage Check (Required by Default; Skipped for Quick Commit)

If in **quick commit mode**, skip this step and mention in the Step 5 closing note that "the knowledge-base coverage check was skipped according to quick commit mode."

**First check whether `.Knowledge/` exists:**

- If `.Knowledge/manifest-routing.json` does not exist: skip this step, mention in Step 5 that "the project has not initialized the Flow2Spec knowledge base; consider running flow2spec init", and continue to Step 3.

**Skip rule A: Changes are pure documentation / knowledge base itself** (evaluated before running the coverage check)

If **every** pending file collected in Step 1 matches one of these patterns, skip this step directly (in Step 5, note "changes are pure docs; coverage check skipped"):

- `.Knowledge/**` (you're editing the knowledge base itself; checking coverage against itself is meaningless)
- `docs/**` / `docs/en/**`
- `README*.md` / `LICENSE` / `CHANGELOG*`
- `.claude/**` / `.cursor/**` / `.codex/**` (agent config roots; distributed by `flow2spec init` and unrelated to business capability coverage)
- `presentations/**` / `assets/**` / other pure static resources

**Any** file falling under `src/` / `lib/` / `cli.js` / `templates/` / business code directories disables this shortcut; continue to the coverage check.

**Skip rule B: A recent knowledge-base sync exists**

Read `.Knowledge/.last-sync.json` (if it does not exist, skip this rule):

```json
{
  "syncedAt": "2026-08-04T10:30:00.000Z",
  "skill": "f2s-kb-sync",
  "developerId": "<optional>"
}
```

- If `Date.now() - Date.parse(syncedAt) < 30 * 60 * 1000` (within 30 minutes) → skip this step directly, and note in Step 5 "skipped coverage check because <skill> ran within the last 30 min".
- If the timestamp is stale or the file is corrupted → ignore and run the normal coverage check.
- This file is written by **knowledge-base-writing skills** (`f2s-kb-sync` / `f2s-kb-feat` / `f2s-kb-fix` / `f2s-kb-add` / `f2s-kb-addRules` / `f2s-kb-distill`) on successful completion. `f2s-git-commit` **reads only**, never writes.
- If the user explicitly says "re-check coverage" / "don't skip coverage check", this rule is disabled and coverage runs regardless.

**When it exists, perform the coverage check:**

**First perform the KB auto-merge preflight (required; do not ask the user to run commands manually):**

1. The agent runs `flow2spec kb check --json` and `flow2spec kb status --json` inside this step, or uses an equivalent built-in KB engine capability. Do not turn these commands into manual pre-commit chores for the user.
2. If `check` reports knowledge-structure errors, missing matchers, routing drift, or other health issues: stop this commit, report the concrete issues and suggested fix actions, and do not commit a broken knowledge base.
3. If `status.tasks` contains `kb-delta.json` under the current developer task root:
   - If the current task line can be uniquely identified and `mergeable=true`: automatically run `plan -> apply -> build -> check` (via CLI or equivalent built-in capability), and include the written `.Knowledge/**` files in the commit file list.
   - If `mergeable=false`, delta parsing failed, or multiple active deltas exist and the agent cannot determine which one belongs to this commit: stop the automatic write, list `topic / reason / deltaPath`, and tell the user that semantic merge or task-line selection is required. Do not guess the merge.
4. Only when there is no active `kb-delta.json` for the current task line, continue to the coarse coverage check below.

**When there is no auto-applicable delta, perform the coarse coverage check:**

1. Infer the **functional modules** touched by this change from `git diff HEAD` and untracked file paths (use actual repository directories/package names; do not invent business names that do not appear).
2. Read the directory lists of `.Knowledge/topics/` and `.Knowledge/stock-docs/`.
3. Compare the functional modules inferred in Step 1 and determine whether corresponding docs are registered in the knowledge base.
4. Conclude: **covered / partially covered / not covered**.

> Coarse-grained judgment is enough: if a corresponding topic or stock-docs document exists, treat it as covered; if the knowledge base is empty or no related doc is found, treat it as not covered.

**When not covered or partially covered (must prompt):**

```
⚠️  The following capabilities touched by this change are not yet in the knowledge base:
  - <capability description>

Recommended before committing:
  A) Run f2s-kb-sync now to record them, then automatically continue the commit flow
  B) Commit first and record them manually later (enter B to confirm)
  C) Cancel this commit (enter C)
```

- Choose **A**: prompt the user to run `f2s-kb-sync` or `f2s-kb-feat`. After the user finishes recording and says so in the **same session**, or triggers this skill again, continue from Step 1 or Step 3 (**do not require** a separate "continue commit" confirmation; this matches Steps 3-4).
- Choose **B**: record the uncovered capability descriptions and output them in the Step 5 closing note.
- Choose **C**: stop this skill.

### Step 3: Generate a Commit Message Draft (Required)

Read `git diff HEAD` (if too long, use the first 300 lines), and generate a commit message from the actual changes.

#### First-Line Format (Required): Type Emoji + Conventional Commits

The **first line** must satisfy all of the following:

1. **Start with one emoji** corresponding to the `type` table below. **Do not** stack multiple decorative emojis.
2. Follow it with **one ASCII space**, then lowercase **`type`**, an English colon `:`, **one space**, and a short Chinese or English summary.
3. **Optional scope**: use Conventional `type(scope):`, directly after `type` and before the colon, for example `🐛 fix(auth): fix lost login state`.
4. Recommended total first-line length: **<= 72 characters** (including emoji). If too wide, shorten the description first.

**Recommended template (single line)**:

```text
<emoji> <type>[(scope)]: <summary>
```

Omit the parentheses segment when there is no scope, for example: `🚀 feat: add cache warmup`.

**`type` -> first-character emoji (use exactly from this table for searchability and release notes)**:

| `type` | emoji | Typical scenario |
|--------|--------|----------|
| `feat` | 🚀 | New feature or user-visible capability increment |
| `fix` | 🐛 | Bug fix or production/test issue |
| `docs` | 📚 | Docs only, comments, README, knowledge-base body content |
| `style` | 💄 | Pure formatting, indentation, semicolons, and layout with no behavior change |
| `refactor` | ♻️ | Refactor, rename, structural change with no behavior change |
| `perf` | ⚡ | Performance optimization |
| `test` | 🧪 | Tests, stubs, snapshots |
| `build` | 🏗️ | Packaging, dependencies, compile scripts, artifacts |
| `ci` | 👷 | CI config, pipelines, automation scripts |
| `chore` | 🔧 | Miscellaneous maintenance or tooling not build/ci |
| `revert` | ↩️ | Revert a commit |

**Examples**:

```text
🚀 feat: support activity cache warmup
🐛 fix(coupon): correct coupon window boundary condition
📚 docs: add QConfig notes for shared modules
♻️ refactor: extract group-buying validation
🔧 chore: upgrade ESLint config
```

**Body (optional)**: from the second line onward, use paragraphs or list items. **Do not require** an emoji on each body line. Use `- ` for list items if needed.

**If the user already provided the first line**: if it already contains one table emoji and the emoji matches the `type`, respect the user's wording. If it has only `type:` without an emoji, **add the emoji** before Step 4.

**Confirmation strategy for `git commit` (required)**:

- In the **same assistant reply**: **first** show the finalized commit message **first line** (and optional body), then immediately execute Step 4 (`git add` item by item + `git commit`). **Do not require** the user to reply "confirm" before committing.
- If the user already provided a compliant commit message in this turn, use it directly and enter Step 4, but still **repeat the first line** before committing.
- If the user explicitly says "change the commit message / use another type": revise it, then under the same strategy **show and commit** without adding a "please confirm" gate.

### Step 4: Execute the Commit (Immediately After Showing the Message)

Handle the three file categories from Step 1:

```bash
# 1. Unstaged files: add first
git add <unstaged file list>

# 2. Untracked files: add first
git add <untracked file list>

# 3. Staged files: already added; no need to add again

# Execute commit
git commit -m "<final full commit message from Step 3>"
```

- Do not use `git add -A` / `git add .`; only add the explicit file list from Step 1.
- If a pre-commit hook fails: output the full error, ask the user to fix it and trigger this skill again, and **do not** bypass it with `--no-verify`.
- If commit succeeds: read the commit hash (`git rev-parse --short HEAD`) and proceed to Step 5.

### Step 5: Closing Note

```
✅ commit <hash> complete
   <commit message first line>

[If Step 2 chose B]
📌 Reminder: the following capabilities are still not in the knowledge base; record them before merging:
  - <capability description>
  You can run: f2s-kb-sync or f2s-kb-feat

[If Step 2 was skipped because .Knowledge does not exist]
💡 This project has not initialized the Flow2Spec knowledge base. To enable it, run: flow2spec init

[If Step 2 was skipped by quick commit]
⚡ The knowledge-base coverage check was skipped according to quick commit mode.

[If skip rule A matched: pure-doc changes]
📄 Changes are pure docs / knowledge base itself; coverage check skipped.

[If skip rule B matched: recent sync within 30 min]
🔄 Skipped coverage check because <skill name> ran within the last 30 min (.Knowledge/.last-sync.json).
```

## Constraints

- Do not use `git add -A` / `git add .`; add only confirmed changed files.
- Do not use `--no-verify`; if a hook fails, fix and retry.
- Do not `--amend` a pushed commit unless the user explicitly asks.
- Do not push automatically. Stop after the commit completes.
- In default mode, when the knowledge base does not cover the changes, you must prompt the user; the user decides whether to record now (choosing B does not block the commit). In quick commit mode, skip the knowledge-base coverage check and do not prompt recording options.
- **`git pull` / `git pull --rebase` / `git fetch` followed by merge operations that modify the current branch working tree**: you **must** explain the purpose and risk first and obtain explicit user confirmation for the **pull** (for example the user replies "confirm pull") before executing it. **Do not** silently pull as part of committing.
- **`git commit`**: a separate user reply of "confirm" is **not required**; however, it is **forbidden** to commit without showing the proposed first line in the same reply first.
- The commit-message **first line** must follow the **emoji + type** format in Step 3 (keep a user-provided compliant line as-is).
- If merge-conflict markers exist, stop and do not continue.

## Completion Self-Check

1. Did Step 1 check merge conflicts? Must be yes.
2. Were staged / unstaged / untracked files distinguished? Must be yes.
3. Was `git add -A` / `git add .` used? Must be no.
4. Was the knowledge-base check performed or skipped with an explicit reason (quick commit / `.Knowledge` missing)? Must be yes. If an active `kb-delta.json` exists, was it automatically planned/applied/built/checked or was a conflict explicitly reported? Must be yes.
5. Was the Step 3 commit message generated from actual `git diff` content? Must be yes, not only `--stat`.
6. Was the proposed first line **shown in the same reply** before executing commit? Must be yes; do **not** require the user to separately "confirm commit".
7. Does the commit-message **first line** match `<emoji> <type>[(scope)]: <summary>`, with emoji and type consistent with the table? Exceptions such as merge revert must be explained when shown.
8. If pre-commit failed, was the hook bypassed? Must be no.
9. If Step 2 chose B, does the closing note include an uncovered-knowledge reminder?
10. If Step 2 chose A, does the flow continue after the user records knowledge or triggers again (**without** requiring a separate confirmation just to continue commit)?
11. If this flow ever needed `git pull`: was explicit confirmation for **pull** obtained before running it? Must be yes; if not involved, mark N/A.
