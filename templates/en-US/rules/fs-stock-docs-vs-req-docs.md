---
description: Distinguish .flow-spec/stock-docs (existing context) from .flow-spec/req-docs (requirements and technical designs); do not mix paths or downstream targets
globs:
  - "**/.flow-spec/stock-docs/**/*.md"
  - "**/.flow-spec/req-docs/**/*.md"
alwaysApply: false
---

> **Single long-form rule**: this file is the complete convention for **fs-doc-routing**. `.flow-spec/topics/fs-stock-docs-vs-req-docs.md` is only a routing summary; **Codex** reads `.codex/fs-rules/fs-stock-docs-vs-req-docs.md` (automatically mirrored from this file by `flow-spec init`) as the equivalent rule text.

# stock-docs and req-docs

- **`.flow-spec/stock-docs/`**: **existing source documents** such as PDFs, drafts, final drafts, and architecture notes. Document writes from `fs-kb-build`, `fs-doc-final`, `fs-doc-arch`, and `fs-kb-add` should prefer this directory. Always write `sourceDoc` as `.flow-spec/stock-docs/<filename>.md`.
- **`.flow-spec/req-docs/`**: requirement clarifications, technical designs (frontend/backend/data/tasks, etc.), and "implement from design" MD files output by `fs-doc-pdf`. The trigger scope for `implement-tech-design` is `.flow-spec/req-docs/**/*.md`.

For the complete convention, see this rule and **`skills/fs-doc-routing/SKILL.md`**; `.flow-spec/topics/fs-stock-docs-vs-req-docs.md` is the routing summary.
