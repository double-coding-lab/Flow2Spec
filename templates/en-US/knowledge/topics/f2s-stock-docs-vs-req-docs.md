---
id: f2s-doc-routing
revision: 0
summary: "f2s-doc-routing (routing summary)"
primary: policy
confidence: manual
---
# f2s-doc-routing (routing summary)

> **Only long-form source**: Cursor / Claude use configuration-root **`rules/f2s-stock-docs-vs-req-docs.md(c)`** as authoritative.  
> **Codex**: do not read `rules/`; execute the equivalent constraints in **`.codex/topics/f2s-stock-docs-vs-req-docs.md`** (automatically mirrored from template `rules` by `flow2spec init`).

## Purpose

- Anchors topic id **`f2s-doc-routing`** for `manifest-routing.topicPaths`, **`topicDependencies`**, and `index.md`.
- Keeps only reminders about **directory responsibilities**.

## Directory Responsibilities (must match the rules)

| Directory | Purpose |
| --- | --- |
| `.Knowledge/stock-docs/` | Architecture, final drafts, and deposited knowledge; preferred destination for `f2s-kb-build` / `f2s-doc-final`, and similar flows. |
| `.Knowledge/req-docs/` | Requirement clarification, **technical specs**, and Markdown input when implementing from a spec. |

**Principle**: when coding from a spec, read only **`req-docs`**; do not treat **`stock-docs`** as direct coding input.

## What to Read Next

| Environment | Next step |
| --- | --- |
| Cursor / Claude | Open or @ **`rules/f2s-stock-docs-vs-req-docs`**. |
| Codex | Read **`.codex/topics/f2s-stock-docs-vs-req-docs.md`**. |
