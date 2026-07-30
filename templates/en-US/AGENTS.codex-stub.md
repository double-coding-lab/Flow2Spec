# flow-spec (`.codex/` Directory Notes)

> This file is a **pointer**, not the complete instruction set. It is written by `flow-spec init`; **do not read only this file**.

## Complete Instructions

The repository-root **[`AGENTS.md`](../AGENTS.md)** is the complete flow-spec project guide. Codex reads it when started from the repository root.

If the current session does not include the full root `AGENTS.md`, **you must first Read the repository-root `AGENTS.md`** before running `fs-*` or modifying `.flow-spec/`.

## Directory Purpose

| Path | Description |
| --- | --- |
| `skills/` | flow-spec skills (`fs-*`) |
| `topics/` | Long-form rule mirrors, sourced from the same content as Cursor/Claude `rules` |
| `hooks.json` | Codex SessionStart hook configuration for injecting a configuration summary and checking the flow-spec knowledge-base version on startup |
| `hooks/` | Hook script directory |
| `config.toml` | Project-level Codex configuration, if created |

Configuration source of truth: repository-root **`flow-spec.config.json`** (must be Read); the field-semantics table is in root **`AGENTS.md`**.
