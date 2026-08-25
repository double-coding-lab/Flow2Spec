---
description: Distinguish .Knowledge/stock-docs (existing context) from .Knowledge/req-docs (requirements and technical designs); do not mix paths or downstream targets
globs:
  - "**/.Knowledge/stock-docs/**/*.md"
  - "**/.Knowledge/req-docs/**/*.md"
alwaysApply: false
---

> **Single long-form rule**: this file is the complete convention for **f2s-doc-routing**. `.Knowledge/topics/f2s-stock-docs-vs-req-docs.md` is only a routing summary; **Codex** reads `.codex/topics/f2s-stock-docs-vs-req-docs.md` (automatically mirrored from this file by `flow2spec init`) as the equivalent rule text.

# stock-docs and req-docs

- **`.Knowledge/stock-docs/`**: **existing source documents** such as PDFs, drafts, final drafts, and architecture notes. Document writes from `f2s-kb-build`, `f2s-doc-final`, `f2s-doc-arch`, and `f2s-kb-add` should prefer this directory. Always write `sourceDoc` as `.Knowledge/stock-docs/<filename>.md`.
- **`.Knowledge/req-docs/`**: requirement clarifications, technical designs (frontend/backend/data/tasks, etc.), and "implement from design" MD files output by `f2s-doc-pdf`. The trigger scope for `implement-tech-design` is `.Knowledge/req-docs/**/*.md`.

For the complete convention, see this rule and **`skills/f2s-doc-routing/SKILL.md`**; `.Knowledge/topics/f2s-stock-docs-vs-req-docs.md` is the routing summary.
