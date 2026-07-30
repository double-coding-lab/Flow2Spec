# fs-doc-routing (routing summary)

> **Only long-form source**: Cursor / Claude use configuration-root **`rules/fs-stock-docs-vs-req-docs.md(c)`** as authoritative.
> **Codex**: do not read `rules/`; execute the equivalent constraints in **`.codex/fs-rules/fs-stock-docs-vs-req-docs.md`** (automatically mirrored from template `rules` by `flow-spec init`).

## Purpose

- Anchors topic id **`fs-doc-routing`** for `manifest-routing.topicPaths`, **`topicDependencies`**, and `index.md`.
- Keeps only reminders about **directory responsibilities**.

## Directory Responsibilities (must match the rules)

| Directory | Purpose |
| --- | --- |
| `.flow-spec/stock-docs/` | Architecture, final drafts, and deposited knowledge; preferred destination for `fs-kb-build` / `fs-doc-final`, and similar flows. |
| `.flow-spec/req-docs/` | Requirement clarification, **technical specs**, and Markdown input when implementing from a spec. |

**Principle**: when coding from a spec, read only **`req-docs`**; do not treat **`stock-docs`** as direct coding input.

## What to Read Next

| Environment | Next step |
| --- | --- |
| Cursor / Claude | Open or @ **`rules/fs-stock-docs-vs-req-docs`**. |
| Codex | Read **`.codex/fs-rules/fs-stock-docs-vs-req-docs.md`**. |
