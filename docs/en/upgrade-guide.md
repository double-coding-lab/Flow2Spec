# Flow2Spec Upgrade Guide (CLI 3.6.2 / Core 3.7.2 / Template 3.6.2)

> Highlight of this release: **routing-summary recall anchors**. Every routing rule in `manifest-routing.json` now carries a `summary` semantic digest (synced automatically from topic frontmatter), which greatly improves knowledge-base hit rates for natural phrasings such as "where are the prototypes" or "which folder holds the flowcharts". `kb check` gains summary quality validation accordingly.

## Version matrix

| Dimension | Latest | Notes |
| --- | --- | --- |
| CLI (`@double-coding/flow2spec`) | 3.6.2 | the only package you need to care about; pins its exact Core, released in lockstep |
| Core (`@double-coding/flow2spec-core`) | 3.7.2 | installed automatically with the CLI, no separate action needed |
| Template Version | 3.6.2 | templates carry topic-layer changes (projectRev 3) |
| Qoder plugin | 3.7.2 | self-built (`npm run build:qoder-plugin`), named after the Core version |

---

## New users (first-time setup)

### Option 1: CLI (Codex / Cursor / Claude / DSH)

```bash
npm install -g @double-coding/flow2spec
flow2spec init <codex|cursor|claude|dsh>   # multi-select, follow the prompts
```

Installing the CLI automatically brings its exactly pinned Core (3.7.2); no separate install is needed. After init you are on the latest knowledge-base templates with summary-based first-pass recall built in — nothing extra to do.

### Option 2: Qoder plugin (self-built install)

The Qoder plugin marketplace hosts official plugins only; build the Flow2Spec plugin yourself and install it locally:

1. Clone the repository and build the plugin package:

   ```bash
   git clone https://github.com/double-coding-lab/Flow2Spec.git
   cd Flow2Spec && npm install && npm run build:qoder-plugin
   # produces output/flow2spec-3.7.2.zip
   ```

2. In Qoder's plugin management, choose local install and import the zip;
3. On first use in a project, run `flow2spec init plugin` as prompted (plugin mode: initializes only the knowledge base and config, writes no client directories).

Then tell the agent things like "f2s-kb-build / f2s-kb-add" to start building the knowledge base.

---

## Existing users (projects with `.Knowledge`)

Template 3.5.0 → 3.6.x **includes topic-layer changes** (projectRev 2 → 3), so updating the packages alone is not enough — run one knowledge-base upgrade. Three steps:

### Step 1: Update the package

The CLI and Core release in lockstep (the CLI pins its exact Core), so one command updates everything:

```bash
npm install -g @double-coding/flow2spec@latest
flow2spec version   # confirm CLI 3.6.2 / Core 3.7.2
```

Once on 3.6.2 or later, future upgrades can also use `flow2spec update --cli` (it verifies the effective Core version and auto-repairs a broken dependency tree by reinstalling).

**Qoder plugin users**: pull the latest code and rebuild the plugin package (`npm run build:qoder-plugin`, producing `output/flow2spec-3.7.2.zip`), then re-import it in Qoder's plugin management; no global npm package needed.

### Step 2: Knowledge-base upgrade (the key step — let the agent do it)

In your project session, tell the agent:

```text
f2s-kb-upgrade
```

The agent runs the full flow. The parts relevant to this release:

1. Runs `flow2spec init` to align the routing manifest and templates (**incremental — it never overwrites your accumulated business knowledge**);
2. `kb build --fix-topics` fills in frontmatter skeletons for existing topics;
3. **Summary rewrite (new in this release)**: `kb check --strict` lists every missing/placeholder topic summary; the agent reads each topic body, writes a one-line semantic summary per the authoring rules, then `kb build` syncs it into the routing manifest — only after this step does your existing knowledge base gain the first-pass recall boost;
4. Writes back `projectRev` and prints an upgrade summary.

No manual edits to any `.Knowledge` file are needed.

### Step 3: Verify

```bash
flow2spec version          # CLI 3.6.2 / Core 3.7.2 / Template 3.6.2
flow2spec kb check --strict   # expect: knowledge check: ok, no summary warnings
```

Then try one natural question (e.g. "where do the prototypes / requirement docs of this project live") and confirm the agent hits the right topic.

---

## FAQ

**Q: Why does every Core update come with a new CLI version? Which package should I care about?**
Only the CLI (`@double-coding/flow2spec`). It pins its exact Core version and the two packages release in lockstep: any Core update produces a new CLI version, so `npm install -g @double-coding/flow2spec@latest` always gets you the complete latest pair.

**Q: On an older CLI, `flow2spec update --core` said "updated" but `flow2spec version` did not change?**
A known defect in CLI ≤ 3.6.1: that command installed Core into an orphaned top-level global location, while the CLI actually loads its own nested copy — which never got updated. Fix: reinstall the CLI once (`npm uninstall -g @double-coding/flow2spec && npm install -g @double-coding/flow2spec@latest`). Since CLI 3.6.2, `update --cli/--core` performs the lockstep update and verifies the effective Core version — no more false success.

**Q: Will the upgrade overwrite the knowledge base I already wrote?**
No. The init run by `f2s-kb-upgrade` is incremental and only updates template-owned routing structure and rules; your business content in `stock-docs` / `req-docs` / topic bodies is untouched. `--reset-knowledge` is used only when you explicitly ask for an overwrite reset.

**Q: Can I just update the packages and skip `f2s-kb-upgrade`?**
The engine capabilities (summary sync, validation) take effect, but your existing topics have no summaries, so first-pass recall does not improve — and `kb check` will keep reporting placeholder/missing warnings. Run the upgrade soon after updating the packages.

**Q: My project is still on the very old V1 layout (no `.Knowledge/manifest-routing.json` shards)?**
V1 auto-migration has been removed from the package. First do a one-time migration with the historical `@double-coding/flow2spec@3.4.x` (or move things into the `.Knowledge` shape manually), then run `f2s-kb-upgrade` on the latest version.

**Q: I told the agent `f2s-kb-upgrade` and it just replied "everything is up to date" and did nothing?**
A known misjudgment in older skills (Template ≤ 3.6.0): they only compared "installed packages vs npm" and never checked "project knowledge base vs package templates" — an old project right after a package upgrade hits exactly this. Fixed since Template 3.6.1 (a project-side alignment check is now mandatory before stopping). If you hit it during the first upgrade of an old project, just be more explicit:

```text
f2s-kb-upgrade, force the full flow: run flow2spec init first, then kb build --fix-topics and kb check --strict, and rewrite summaries per 3a.8
```

**Q: After upgrading, git shows lots of changes under `.cursor/` and `.codex/` — is that normal?**
Yes. Those are real updates to rule and skill bodies in the new templates (including the wholesale removal of `f2s-kb-migrate`), not empty diffs; use `git diff -w` to verify. The upgrade only touches `.Knowledge/`, the agent config roots (`.cursor/` `.codex/` etc.), `AGENTS.md`, and `flow2spec.config.json` — **never your business source code**; commit the upgrade changes separately from business changes. Also, the manifest `version` is the Template Version (3.6.2 after upgrading) and will not equal the Core version — that is expected.

**Q: After upgrading, my commit is blocked by `kb check` reporting routing drift?**
The manifest and topics are out of sync (usually after hand-editing the manifest). Ask the agent to run `flow2spec kb build` once (idempotent) and it self-heals.
