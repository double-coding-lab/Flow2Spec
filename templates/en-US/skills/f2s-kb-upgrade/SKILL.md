---
name: f2s-kb-upgrade
description: Knowledge-base template upgrade skill (this SKILL only): **V1 flow branch** must run f2s-kb-migrate first, then run flow2spec init inside the workflow; **current repositories (flow branch V2+, including Flow2Spec npm v3.x projects already using .Knowledge)** run init to align manifest-routing + matcher shards (package `manifest-matchers.json` is only an init merge seed and is not written into .Knowledge). Triggers: f2s-kb-upgrade、一键升级迁移、旧项目升级、知识库模板升级、upgrade knowledge base、template upgrade. Note: do not call standalone flow2spec init an "upgrade command"; **V1/V2+ are flow-branch labels inside this skill, not npm package major versions**.
---

> Execution scope: this skill is used to "run shell for the user" to complete Flow2Spec **template and configuration-root alignment as defined by this SKILL**. One step runs **`flow2spec init`**, but **`init` is not an "upgrade command"**. **Upgrade command / knowledge-base upgrade** refers only to the **full `f2s-kb-upgrade` workflow**.

# f2s-kb-upgrade (Knowledge-Base Template Upgrade Skill)

**Terminology (required)**: **"upgrade", "upgrade command", and "knowledge-base upgrade"** refer only to the complete skill workflow executed according to this file **`f2s-kb-upgrade`**. **`flow2spec init`** is a CLI **initialization/write-to-disk** command; this skill runs it in **step 2**. It is **forbidden** to describe standalone user execution of `init` or `init` in CLI help as an "upgrade command".

## Boundaries (Avoid Misunderstandings)

- **`flow2spec init` does not write business knowledge**: it does not replace `f2s-kb-add`, `f2s-kb-fix`, `f2s-kb-feat`, `f2s-kb-sync`, `f2s-kb-build`, or similar maintenance of `stock-docs` / `req-docs` / `topics` bodies and business routing terms.
- This skill completes **directory, template placeholder, and routing-structure alignment under the package version**. If the user says "write the new capability into the knowledge base", guide them to **`f2s-kb-sync` / `f2s-kb-add`** etc., not just `f2s-kb-upgrade`.
- This skill is responsible for auditing existing `topicMetadata`: `primary` / `tags` are only for governance, audit, inventory, and reading expectations; they do not participate in route matching or execution requirements. Execution requirements still come from `AGENTS.md`, rules, skills, and topic bodies.

## Package-side Release Discipline (`projectRev` MUST be bumped correctly)

**Field location**: root-level integer field `projectRev` in `templates/{zh-CN,en-US}/knowledge/manifest-routing.json` (starts at `1`).

**Field write semantics (read first)**:
- **Package side**: maintainers manually bump per the rules below (the package template's own `projectRev` is always the latest).
- **Project side** (written into `.Knowledge/manifest-routing.json`):
  - **First init**: project `.Knowledge/manifest-routing.json` does not exist -> `init` writes the template value, equivalent to baselined-on-arrival.
  - **Subsequent init**: project `.Knowledge/manifest-routing.json` already exists -> `init` **no longer overwrites this field** (project value preserved); the field is only written by this skill's full flow tail (see step 3b "Write back `projectRev`").
  - This gives "project-side `projectRev`" a clean meaning: **"the package-template revision this project has been baselined to"** — not "what the last init carried over".

**Must bump (at least `+1` per release)** when any of the following changes:
- Any body change / addition / deletion / rename of `templates/<locale>/knowledge/topics/<topic>.md`;
- `includeAny` entries, `id` changes, or addition / deletion of any `templates/<locale>/knowledge/matchers/<id>.json`;
- Any change in `topicPaths` / `taskToTopicRules` / `topicDependencies` / `fallbackTopic` / `topicMetadata` of `templates/<locale>/knowledge/manifest-routing.json`;
- Any change in the "topic overview" section or package-level sections of `templates/<locale>/knowledge/index.md`.

**Does NOT require a bump**:
- Package source (`lib/`, `cli.js`, `scripts/`), `AGENTS.md`, `README*`;
- `templates/<locale>/flow2spec.config.json` default values;
- `templates/<locale>/rules/*` / `templates/<locale>/skills/*` rule/skill body changes (unrelated to the topic layer; no need to trigger the full flow).

**One-line rule**: any topic-layer artifact (topic / matcher / manifest / index) under `templates/<locale>/knowledge/` changed -> must bump; otherwise do not. Missing a bump causes user `f2s-kb-upgrade` to take the fast path and miss the topic changes from the package.

## Orchestration (main / sub-agent)

- The meaning of `subAgent` / `switchAgentVerification` uses the unified entry as the only source of truth: **Cursor/Claude** read the configuration-root `rules/f2s-flow2spec-unified-entry.*`; **Codex** reads `.codex/topics/f2s-flow2spec-unified-entry.md` (same source, mirrored by `flow2spec init`). This section does not repeat those definitions.
- **Sub-agent responsibility** (only when `subAgent=true`): run shell commands such as `flow2spec init`; only command execution is delegated, not knowledge-base body writing.
- **Main agent must control** (must not delegate):
  1. **Version branching**: **V1** runs `f2s-kb-migrate` first, then enters this skill; **current repositories (V2+)** directly enter the `init` flow (including Flow2Spec **npm v3.x** etc.; as long as step 0 "current repository" conditions are met, use this branch. **Do not** create a separate flow just because the package major version is 3).
  2. **Re-read after `init`**: re-read `f2s-kb-upgrade/SKILL.md` from disk and compare whether the identifier changed.
  3. **Rerun the whole skill**: when SKILL changed, rerun from the beginning according to the new literal text until two consecutive rounds show no changes.
  4. **Step 3b merge**: preserve the maintained section of `.Knowledge/index.md` and merge with the package version; main agent performs this.
  5. **Verification summary**: the main agent summarizes verification conclusions and output.
- **Write-authority hard rule**: `.Knowledge/index.md` is **written only by the main agent**; sub-agents **must not touch it**. `manifest-routing.json` is also written by main.
- This SKILL does not bind cross-agent verification; the writing side verifies its own work.

## Why this coexists with `f2s-kb-migrate`

| Skill | Problem solved |
| --- | --- |
| **`f2s-kb-migrate`** | **Structural move**: `docs-index.md` / `index-doc.md`, `rules/main.md(c)`, business `skills/`, scattered `stock-docs`/`req-docs` -> **migrate into `.Knowledge`**, write `migration-report.md`, and confirm deletion list with the user. It does not run npm package upgrade. |
| **This skill `f2s-kb-upgrade`** | **Package and template alignment**: run **`flow2spec init`**, merge **`manifest-routing.json`** with **`matchers/*.json`**, refresh each agent's **`rules`/`skills`** (or Codex **`AGENTS.md`**); `init` also copies the current-language **`index.md` -> `.Knowledge/template/index.template.md`** as a comparison snapshot. **`.Knowledge/index.md`** is diff-aligned in step 3b; init **does not** automatically change its body. |

- **One-click closure for old projects**: **first `f2s-kb-migrate`** -> **then this skill** (`init`). Do not use only `init` as a substitute for full migration.
- **Projects already using new `.Knowledge`**: **run only this skill**; do not repeat migrate.

**Why does each Cursor / Claude / Codex directory have a same-named `SKILL.md`?**  
Each tool only loads `skills/` under **its own configuration root** (for example, Codex only loads `.codex/skills/`). `flow2spec init` writes the current-language skill content into the selected agent directories.

## Goal

When the user says "help me upgrade the knowledge-base template / run f2s-kb-upgrade / sync latest Flow2Spec", the Agent **executes the full `f2s-kb-upgrade` workflow in this skill** (including running `flow2spec init`, cleanup, verification, and summary). **Do not** treat only executing `init` as completing this skill.

## Default Behavior

1. When this skill's step 2 runs **`flow2spec init`**, it defaults to **incremental write** (without `--reset-knowledge`).
2. Append `--reset-knowledge` only when the user explicitly requests "overwrite reset".
3. Prefer agents specified by the user; if unspecified, default to `cursor claude codex`.

## init and Skill Self-Update (Required)

This skill executes **`flow2spec init`** in **step 2**. `init` syncs the current-language skill content into each agent **configuration root**, so after **`init` succeeds**, the repository's **`skills/f2s-kb-upgrade/SKILL.md`** may be overwritten by a new version and differ from the old instructions cached in the current conversation.

**Closed loop (avoid stale instructions)**:

1. **Before `init`** (recommended): record the current configuration-root **`skills/f2s-kb-upgrade/SKILL.md`** identifier (for example `mtime`, file size, or body hash).
2. **After `init` succeeds**: **re-read from disk** the full **`SKILL.md`** (Cursor: `.cursor/skills/f2s-kb-upgrade/SKILL.md`; Claude: `.claude/skills/...`; Codex: `.codex/skills/...`, matching the agent(s) written by this `init` run).
3. **If it changed relative to step 1** (or Flow2Spec package was just upgraded and unchanged status cannot be confirmed): **use the latest SKILL as authoritative** and **rerun evaluation and write-back per the new literal text** — that is, **start from "step 2c"**: re-read `projectRev` / `pkgRev`, decide fast path or full flow per the new judgment table, and run steps 3 / 3a / 3b / 4 / 5 accordingly. **Do not re-execute `flow2spec init` during this rerun** — `init` already ran in step 2 this round; running it again brings no new information and would trap the SKILL self-update loop. Loop until two consecutive rounds read an unchanged SKILL, or the user explicitly asks to stop.
4. **If unchanged**: continue with step 2c and later.

> **Fast-path exception**: when step 2c judges as "fast path" (`projectRev == pkgRev`, no topic-layer change), even if SKILL.md content has changed, rerunning per the new SKILL is **not required** — a rerun will only judge fast path again, wasting cycles. The loop above applies only when running the full flow.

> Wording: **after this skill's step 2 executes `init`** -> re-read latest `f2s-kb-upgrade/SKILL.md` -> if changed **and the run goes through the full flow**, **rerun from step 2c per the new literal text** (**do not run `init` a second time**). Do not rely on session memory to execute **this skill**.

## Mandatory Flow

### Step -1: Global flow2spec Version Preflight (Required, Before Everything, Foreground Probe by Main Agent)

**Purpose**: prefer using the **already-installed global `flow2spec`** whenever possible. Only trigger a global upgrade when it is **missing** or **out of date**; when it is already at latest, **completely skip** any upgrade action. This also decides the **default form** of the step 2 command (whether to use `flow2spec init` or `npx @latest init`).

**Action**: before entering step 0, the main agent **sequentially runs 3 probes in the foreground** (all read-only, no side effects, seconds to return — no sub-agent needed):

```bash
# 1. Probe whether flow2spec is installed globally on this machine
flow2spec --version 2>/dev/null || echo __F2S_NOT_INSTALLED__
# 2. Query the latest version on npm (may fail on restricted networks — allowed)
npm view @double-coding/flow2spec version 2>/dev/null || echo __F2S_NPM_UNREACHABLE__
# 3. (Backup) if step 1 returned __F2S_NOT_INSTALLED__, confirm npx is available
command -v npx >/dev/null 2>&1 && echo __NPX_OK__ || echo __NPX_MISSING__
```

**Three-way decision** (pick one branch based on the results; record it in this-turn context and use it to drive step 2 & step 5 summary):

| Case | Condition | Action | Default step 2 command |
| --- | --- | --- | --- |
| **A. Installed & on latest** | Step 1 returned version `V`, step 2 returned version `L`, and `V === L` | **Skip upgrade entirely** — no sub-agent, no `npm i -g` this turn | **`flow2spec init <agents...>`** (use global CLI) |
| **B. Installed but behind** | Step 1 returned `V`, step 2 returned `L`, and `V !== L` (`V < L` or semver-unequal) | **Dispatch an independent sub-agent (fire-and-forget)** to run `npm i -g @double-coding/flow2spec@latest` in the background — no wait, no block. Current turn's step 2 still uses `npx @latest` to guarantee this session gets the latest template | **`npx @double-coding/flow2spec@latest init <agents...>`** |
| **C. Not installed or latest unknown** | Step 1 hit `__F2S_NOT_INSTALLED__`, OR step 2 hit `__F2S_NPM_UNREACHABLE__` and step 1 also didn't return a version | If A doesn't hold and **not installed**: same as B — dispatch a sub-agent to `npm i -g ...@latest`. If step 2 failed but step 1 shows some installed version: treat as B without a way to compare to latest — **do not** dispatch an upgrade, just note "latest unknown, use npx conservatively" | **`npx @double-coding/flow2spec@latest init <agents...>`** |

**Orchestration (required)**:

- **Branch A**: main agent skips all upgrade actions and **does not** dispatch a sub-agent; step 2's default is `flow2spec init`.
- **Branch B / C**: only when an upgrade is actually needed (missing or behind), dispatch an **independent sub-agent** fire-and-forget to run `npm i -g @double-coding/flow2spec@latest`; **do not wait**, **do not block** the main flow. Success/failure does not enter the SKILL summary conclusion. This sub-agent dispatch is **mandatory** and **not subject to** `flow2spec.config.json.subAgent` (a one-off global npm install is not a business split).
- **Write permission**: the sub-agent only runs that shell command and **does not** touch any project file (`.Knowledge`, `manifest-routing.json`, `index.md`, etc.). Write-permission constraints remain unchanged.
- **Probe failure fallback**: if all 3 probes fail (no shell permission, extremely restricted env), treat as branch C and use `npx @latest`; alternatively, skip step -1 entirely and rely on `cli.js`'s `maybeAutoUpdateGlobalInstall()` tail fallback.

**Relation to cli.js**:

- `maybeAutoUpdateGlobalInstall()` inside cli.js is the `init` tail fallback. **No conflict with this step**: this step probes/dispatches before the foreground init; cli's fallback runs once more at init's tail. If both succeed it's a no-op; if the first fails the second still has a chance to fix it.

### Step 0: Version Judgment and Branching (Required, Before init)

> **Naming note**: **"V1"** and **"current repository (V2+)"** below are **flow-branch labels inside this skill**. If the **npm package is v3.x, v4.x, ...** and the repository is already in `.Knowledge` + `manifest-routing` shape, still use the **"current repository (V2+)"** branch (only `init` alignment). **Do not** interpret the npm major version number as the literal "V2" here.

**V1 - Legacy knowledge organization (must migrate before init)**  
Hit **any** strong signal:

- The configuration root still has **`docs-index.md` or `index-doc.md`**, and mostly still closes through **`rules/main.md` / `rules/main.mdc`**; or
- Business **`stock-docs` / `req-docs`, rules, and business skills** are still mainly in the old configuration-root tree and are **not** stably under `.Knowledge`.

**Action**: first execute the full **`f2s-kb-migrate`** workflow (including `migration-report` and deletion-list confirmation), **then** enter steps 1-5 to execute `flow2spec init`.

**Current repository (V2+) - Already on `.Knowledge` + new routing (package/shape alignment only)**  
Both conditions are met:

- **`.Knowledge/manifest-routing.json`** exists, and **`topicPaths` / `taskToTopicRules`** are usable.
- Business docs are mainly under **`.Knowledge/stock-docs`, `req-docs`, `topics`** (can also be the state right after V1 migration completes).

**Historical wording**: if the repository still has legacy single-file **`manifest.json`**, **do not** use it as the machine-readable source of truth; machine reading uses **`manifest-routing.json` + `matchers/*.json` pointed to by `matcherPath`**. `init` handles merge/backfill of shards with the template.

**Action**: directly enter steps 1-5; **no** migrate is needed unless the user explicitly asks to redo migration.

### Step 1: Confirm `init` Mode Inside This Skill (Required)

- If the user did not explicitly request "overwrite reset", this skill's step 2 defaults to **incremental `init`**.
- If the user mentions "overwrite everything according to template / reset", confirm a second time before using `--reset-knowledge`.
- **locale rule**: regular upgrade follows project `flow2spec.config.json.locale`; if missing, fill as `zh-CN`. Do not opportunistically switch languages in this skill; pass `--locale en-US` / `--locale zh-CN` only when the user explicitly requests it.

### Step 2: Execute Command (Run Shell for User)

**Before step 2 starts**: read the project-side **`.Knowledge/manifest-routing.json`** `projectRev` field (**record as `null` if missing**), store it as **`projectRev`**. `projectRev` means **"the package-template revision this project has been baselined to"** (written by this skill's full-flow tail after steps 3 / 3a / 3b; on first init the `init` command writes the template value as the baseline). **`init` no longer overwrites this field when manifest already exists**, so `projectRev` reflects the version this project most recently completed full-flow alignment to — not "what the last init carried over". `projectRev` will be compared with `pkgRev` in step 2c.

Run one of the following in the target project root (**choose the default form based on the step -1 branch conclusion**):

1. **Step -1 returned A (installed & on latest)**: use the global CLI directly (**preferred**):
   - `flow2spec init <agents...>`
2. **Step -1 returned B/C (missing / behind / latest unknown)**: fetch npm latest (**guarantees this session gets the latest template**):
   - `npx @double-coding/flow2spec@latest init <agents...>`
3. For overwrite reset:
   - Append `--reset-knowledge` to the above command.
4. If the user explicitly requests a template-language switch:
   - Append `--locale <zh-CN|en-US>` to the above command.
5. **Manual override**: if the user explicitly says "use global" or "use npx", follow the user's choice and skip the step -1 branch-driven auto-selection.

> `<agents...>` example: `cursor claude codex`.

> **Helper commands (user self-inspection)**: `flow2spec --version` shows the current global version; `flow2spec update` triggers the CLI's built-in self-update. These do **not** replace this SKILL's full flow — they only keep the global CLI fresh; topic-layer alignment still requires step 2 and beyond.

**After step 2 completes**: immediately execute the above **"init and skill self-update"** loop: re-read **`skills/f2s-kb-upgrade/SKILL.md`**. If updated, **rerun from step 2c per the new literal text** (**do not run `init` a second time**; avoid using the old SKILL for subsequent verification).

### Step 2c: Topic-layer Change Judgment (Required, decides fast path vs full flow)

**Goal**: when the package upgrade **does not bring topic-layer changes** (topic / matcher / index template body unchanged), skip steps 3 / 3a / 3b and the "rerun per new SKILL" loop, go directly to step 4 lightweight verification. Only when the package side explicitly bumped `projectRev` should the full flow run.

**Procedure**:

1. **After `init` finished**, take `pkgRev` from the **project-side manifest**. **Convention**: directly `Read` the **`pkgRev`** top-level field in `.Knowledge/manifest-routing.json` at the project root. This field is written by the current `init` and records "the package-template `projectRev` used by this init run" — i.e. the latest package-side value, paired with the `projectRev` field in the same file (= `projectRev`, "the package-template revision this project has been baselined to") to form a "package side / project side" comparison without adding a new file.

   - Field exists and is an integer -> `pkgRev = <integer>`;
   - Field missing or not an integer -> `pkgRev = null` (the package template itself does not declare `projectRev`);
   - Project-side manifest file itself missing -> not handled here; it should be caught during step 2 / step 1 self-check.

2. Compare `projectRev` (recorded before step 2) with `pkgRev`:

| `projectRev` | `pkgRev` | Judgment | Next |
| --- | --- | --- | --- |
| any | `null` | **Full flow** (package did not declare the field; fall back to legacy behavior) | run full steps 3 / 3a / 3b |
| `null` | any int | **Full flow** (project first-time onboarding or legacy upgrade; needs baseline alignment) | run full steps 3 / 3a / 3b |
| int X | int X (equal) | **Fast path** (topic layer unchanged) | **skip** steps 3 / 3a / 3b and the "rerun whole skill" loop, **go directly to step 4** |
| int X | int Y (different) | **Full flow** (package brings topic-layer changes) | run full steps 3 / 3a / 3b |

3. **`--reset-knowledge` exception**: when the user explicitly resets, **force full flow**, ignore this judgment (reset must rebuild via full 3b).

4. **The conclusion of this step must be written into step 5 summary**, e.g. "`projectRev`: project `X` vs package `Y` -> fast path / full flow / field-missing fallback".

> **Blind-spot disclosure**: this judgment looks only at `projectRev` and **trusts the package maintainer to bump correctly when topic / matcher template bodies change**. If the package side does not follow discipline, missed bumps occur; when the user feels it is wrong, they can explicitly request "full flow" (verbally is enough) and the skill should ignore the fast path and go to the full flow directly.

### Step 3: Old Topic-Template Cleanup and Reference Fixes (Required If Present)

> **Fast-path skip**: when step 2c judges fast path, **the whole step is skipped**, go directly to step 4. Run the content below only on the full flow.

After this skill's step 2 `flow2spec init` succeeds, first perform "old file cleanup + reference fixes":

> **skill directory auto-alignment**: `flow2spec init` now automatically deletes old directories in configuration-root `skills/` that the current version no longer provides (renamed/deleted skills such as `f2s-ctx-build`, `f2s-doc-add`, `f2s-rule-capture`, `stock-docs-vs-req-docs`, etc.). **No manual Agent cleanup is needed**.

1. Clean old-name topic files (delete only if they exist; all are old legacy names without the `f2s-` prefix):
   - `.Knowledge/topics/flow2spec-architecture.md`
   - `.Knowledge/topics/implement-tech-design.md`
2. Fix references (update only if files exist; **`.Knowledge/index.md` body is not rewritten by init**, see step 3b):
   - `.Knowledge/index.md` (manually or skill-side as needed for paths/paragraphs)
   - `.Knowledge/manifest-routing.json`
3. Reference targets (confirm current names):
   - `.Knowledge/topics/f2s-flow2spec-architecture.md`
   - `.Knowledge/topics/f2s-implement-tech-design.md`
   - `.Knowledge/topics/f2s-stock-docs-vs-req-docs.md`

> Wording: only clean "old-name topic files"; do not delete current topic files with the `f2s-` prefix.

### Step 3a: Existing `topicMetadata` Audit (Required)

> **Fast-path skip**: when step 2c judges fast path, **the whole step is skipped**. Run the content below only on the full flow.

1. Read `.Knowledge/manifest-routing.json`, using `topicPaths` as the complete topic set.
2. Validate `topicMetadata`: keys must exist in `topicPaths`; `primary` may only be `feature` / `module` / `config` / `policy`; `tags`, if present, must be an array, elements must use the same allowed values as `primary`, and must not duplicate `primary`; `confidence` may only be `manual` / `inferred`.
3. For topics in `topicPaths` that lack metadata, perform classification analysis: **must Read the corresponding `.Knowledge/topics/<id>.md` body**; do not infer only from the topicId name. If evidence is clear, write `inferred`; if evidence is insufficient, **do not write metadata**, but list the inferred direction and basis in the summary (for example, "recommend policy because the body contains multiple mandatory constraints") for user confirmation before manual `manual` fill-in.
4. Classification follows `f2s-topic-authoring` guideline section 3. Agent judges the primary nature from the topic body and writes `primary`; when it covers multiple natures, write the rest to optional `tags`.
5. Do not create, rename, or split topics because of classification.
6. **Topic-granularity audit** (does not block upgrade; list in step 5 summary): check each item and list as "recommended split" if any signal is hit:
   - The corresponding stock-doc exceeds **300-500 lines**.
   - `includeAny` has more than **12 terms**.
   - The topic body contains second-level headings covering more than **3 unrelated responsibility domains**.
   - The topic is frequently matched by multiple unrelated task types (can be judged from `taskToTopicRules` and matcher term breadth).
7. **Automatic old-topic frontmatter repair**: in the full flow, the agent must run `flow2spec kb build --fix-topics` (or the equivalent internal capability) to add `id`, `revision`, and `summary` to existing topics that lack frontmatter / `revision`, and to fill `dependsOn` / `primary` / `confidence` / `tags` from `manifest-routing.json`. Then run `flow2spec kb check --strict`; if strict validation fails, stop and list the concrete topic / reason in the summary. Do not ask the user to manually add topic headers one by one.

### Step 3b: `index.md` Merge and `template/index.template.md` (Required)

> **Fast-path skip**: when step 2c judges fast path, **the whole step is skipped** (the "topic overview" section of the package template is unchanged -> existing `index.md` is still correct). Run the content below only on the full flow.

> **Scope**: this "merge" is written to `.Knowledge/index.md` **only by the Agent in this skill**. It does **not** require or assume changes to Flow2Spec package **`cli.js` / `lib/init.js`** or other JS. `init` behavior follows the repository's current implementation (snapshot copy, etc.).

**Role of `flow2spec init` in this workflow**: copy the current-language `index.md` snapshot to **`.Knowledge/template/index.template.md`** as a **package-shell comparison snapshot**. It does **not** replace this step's merge writing for **`index.md`**.

#### Merge Rules (Required)

0. **Write ownership**: this step's `.Knowledge/index.md` merge is always performed and written by the main agent; sub-agents must not write directly (write-authority hard rule).
1. **Comparison sources**
   - **Package full text**: **`.Knowledge/template/index.template.md`**.
   - **Project current state**: **`.Knowledge/index.md`**.

2. **Project-maintained section (anchor: `## Topic Overview` in `.Knowledge/template/index.template.md`)**
   - Using `.Knowledge/template/index.template.md` as reference: from the second-level heading **`## Topic Overview`** **until the end of that section**: specifically, up to the `---` immediately before **`## Match and Execute`** (including the "Topic Overview" table and intra-section explanatory paragraphs).
   - This whole block **must preserve the body from current project `.Knowledge/index.md`** (maintained by business and **f2s-***). It is **forbidden** to wholesale replace it with the same block from the package template (to avoid losing business topic rows and summary columns).
   - **Allowed** minimal repairs inside this block: for example, add rows for package-added `topicPaths` topics, correct the "path" column according to **`manifest-routing.json` `topicPaths`**, and add new table-column explanations introduced by the package snapshot while preserving existing project behavior.

3. **Parts that must match the package template**
   - Everything outside the maintained block above (from file start to before **`## Topic Overview`**, and from **`## Match and Execute`** through file end) must match the corresponding parts of **`.Knowledge/template/index.template.md`** (package version is authoritative; after diff, overwrite old project text with the template).

4. **Output**
   - Write the complete merged **`index.md`** back to **`.Knowledge/index.md`**.
   - Include the **diff** conclusion and whether it changed in step 5 summary.

5. **Relationship to `--reset-knowledge`**
   - If the user used `reset`, `.Knowledge/index.md` may have been overwritten by the template whole-file. Still, this step must restore the "Topic Overview" block from backup or version control before performing merge rule **3**. If the repository has no backup, rebuild the topic table from `topicPaths` + snapshot and ask the user to confirm.

#### End of full flow: write back `projectRev` (Required)

After steps 3 / 3a / 3b above are completed in the **full flow** (**not executed on the fast path**), the main agent **rewrites** the project-side **`.Knowledge/manifest-routing.json`** `projectRev` field to **`pkgRev`** (the integer obtained in step 2c; if `pkgRev` is `null`, **leave the field unchanged**):

- This is the **only** write path for `projectRev` (besides the first-init template default-write);
- The next `f2s-kb-upgrade` will then judge `projectRev == pkgRev` and take the fast path, avoiding repeated 3 / 3a / 3b runs;
- This write shares the same main-agent write authority as the rest of `manifest-routing.json` (write-authority hard constraint).

### Step 4: Verify This Skill's Execution Result (Required)

Verify at least:

1. Step 2 `flow2spec init` exited successfully (exit code = 0).
2. init output includes the conclusion for **routing manifest and `.Knowledge`** (aligned/latest/reset overwrite, etc.) and a line indicating **`index.template.md` was copied** (if the package lacks `index.md`, this line may be absent).
3. `manifest-routing` and every `matcherPath` shard are parseable, and all `topicPaths` / `matcherId` references are valid.
4. **`.Knowledge/template/index.template.md`** exists; step **3b** completed the **`index.md` merge** (maintained block preserved + rest matches package version), or the reason pending user handling is written.
5. Configuration-root artifacts exist:
   - Cursor/Claude: `rules/`, `skills/`
   - Codex: `.codex/AGENTS.md`, `skills/`
6. After this skill succeeds, delete `.Knowledge/update-check.json` if it exists so the next new session rechecks and clears stale upgrade hints; if deletion fails, state it in the step 5 summary.

### Step 5: Output Result Summary (Required)

Output:

- **Step -1 global version preflight**: branch (`A Installed & on latest (upgrade skipped) / B Installed but behind (sub-agent dispatched to upgrade) / C Missing or latest unknown (dispatched / advised)`) + current global version + npm latest (if obtained)
- Executed command (including agents and whether reset was used)
- Whether it succeeded
- **`projectRev` judgment**: project `X` vs package `Y` -> fast path / full flow / field-missing fallback (step 2c)
- Old topic-template cleanup conclusion (what was deleted / what did not exist; **not executed on fast path**)
- `index/manifest` reference-fix conclusion (**not executed on fast path**)
- **index**: whether `index.template.md` was generated; whether **`index.md` merge** completed (anchor **lines 18-19 "Topic Overview" section** preserved, rest matching package version) and `topicPaths` / diff conclusion (step 3b; **not executed on fast path**)
- **`projectRev` write-back**: whether the project-side `projectRev` was rewritten to `pkgRev` after the full flow finished (step 3b tail "Write back `projectRev`"; **not executed on fast path**)
- **SKILL self-update**: whether `f2s-kb-upgrade/SKILL.md` was re-read after `init`; whether file changes caused **a rerun from step 2c per the new literal text** and how many rounds (**no second `init`**; see "init and skill self-update"; **this loop is skipped on fast path**)
- manifest / matchers alignment conclusion (from init output)
- Key file verification conclusion
- `.Knowledge/update-check.json` cleanup conclusion (deleted / absent / deletion failed)
- If failed, provide the next executable repair suggestion

## Output Summary Template (Recommended)

```markdown
## f2s-kb-upgrade Execution Result

- **Step -1 global version preflight**: `A Installed & on latest (upgrade skipped) / B Installed but behind (sub-agent dispatched to run npm i -g in background) / C Missing or latest unknown (dispatched / conservative npx)`; current version=`<V>`, latest=`<L or unknown>`
- Command run inside this skill: `<actual flow2spec init ... or npx @latest init ...>`
- init mode: `incremental` / `overwrite reset (--reset-knowledge)`
- Result: `success` / `failure`
- **Topic-layer judgment**: `projectRev=<X>` vs `pkgRev=<Y>` -> `fast path (skipped 3/3a/3b)` / `full flow` / `field-missing fallback`

### Core Verification
- Old topic files: `cleaned` / `no cleanup needed` / `not executed on fast path`
- Reference fixes: `updated` / `already consistent` / `not executed on fast path`
- **index (snapshot + merge)**: `snapshot copied` / `index.md merged` / `not executed on fast path` / `pending (see notes)`
- **topicMetadata (existing audit)**: `filled` / `pending user confirmation` / `not executed on fast path`; list added / fixed / deleted topicIds
- **topic frontmatter**: `auto-filled N topics` / `already complete` / `strict validation failed` / `not executed on fast path`
- **f2s-kb-upgrade SKILL**: `unchanged after init` / `reran N rounds from step 2c per new SKILL (no second init)` / `loop skipped on fast path` / `pending confirmation`
- **`projectRev` write-back**: `written to project manifest (value=pkgRev)` / `not executed on fast path` / `pkgRev=null, field untouched`
- manifest-routing / matcher shards: `aligned with template` / `already latest` / `reset overwrite`
- topics.path: `all exist` / `missing paths (see below)`
- agent artifacts: `pass` / `issue (see below)`
- update-check cache: `deleted` / `absent` / `delete failed`

### Notes
- <failure reason or next suggestion>
```

## Constraints

- Do not default to "ask the user to run the command themselves"; the Agent should run it directly.
- Do not execute `--reset-knowledge` without explicit consent.
- Do not modify business code; only verify according to **this `f2s-kb-upgrade`** workflow and result.
- Step 3b `.Knowledge/index.md` merge and `manifest-routing.json` are always written by the main agent (write-authority hard rule); sub-agents may only run shell commands.

## Completion Self-Check

1. **Step -1** was performed: before entering step 0, **3 foreground probes** were run sequentially (`flow2spec --version` / `npm view ... version` / `npx` availability) and one of the A/B/C branches was determined. Only under B/C did an **independent sub-agent** get dispatched to run `npm i -g @double-coding/flow2spec@latest` in the background (fire-and-forget); under A **no upgrade action** was dispatched. Step 2's default command form was chosen accordingly (A → `flow2spec init`, B/C → `npx @latest init`); the summary clearly states the branch and version comparison.
2. **Step 0** was performed: V1 did not skip migrate, and **current repositories (V2+)** did not incorrectly run migrate.
3. **Before step 2** recorded the project-side `projectRev` (`projectRev`), and **after step 2 `init`** re-read `pkgRev` and executed **step 2c** judgment.
4. After **step 2 `init`**, **`f2s-kb-upgrade/SKILL.md`** was re-read: on full flow, a change must trigger **a rerun from step 2c per the new literal text** (**no second `init`**); on fast path, the loop can be skipped (see "init and skill self-update" / "fast-path exception").
5. A shell command was actually executed, not only suggested.
6. Incremental or reset mode was clearly labeled.
7. **On full flow**: old topic-file cleanup and `index/manifest` reference fixes were handled (step 3).
8. **On full flow**: **Step 3a** was executed: `topicMetadata` audited, with no orphan keys / illegal primary / illegal confidence; missing old topics were filled with `inferred` based on evidence or listed as pending confirmation.
9. **On full flow**: `flow2spec kb build --fix-topics` or an equivalent internal capability was executed, followed by `flow2spec kb check --strict`, ensuring existing topics have `revision`.
10. **On full flow**: **Step 3b** was executed: `index.md` was **merged** (from **`Topic Overview`** section through before "Match and Execute" is project-maintained; the rest matches the package version), and `topicPaths` were checked; **at the end of full flow**, the project-side `projectRev` was **written back** to `pkgRev` (if `pkgRev=null`, the field was left unchanged).
11. **On fast path**: steps 3 / 3a / 3b were actually skipped (no unrelated scans), and the summary explicitly labels "not executed on fast path".
12. Manifest and key-path verification results were output.
13. If failed, a concrete next command suggestion was provided.
14. Step 3b `index.md` merge was completed and written by the main agent, with no unauthorized sub-agent write (applies only on full flow).
15. After successful upgrade, `.Knowledge/update-check.json` was deleted to avoid stale upgrade hints in new sessions that day.
