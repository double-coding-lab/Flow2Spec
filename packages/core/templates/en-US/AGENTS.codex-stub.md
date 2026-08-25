# Flow2Spec (`.codex/` Directory Notes)

> This file is a **pointer**, not the complete instruction set. It is written by `flow2spec init`; **do not read only this file**.

## Complete Instructions

The repository-root **[`AGENTS.md`](../AGENTS.md)** is the complete Flow2Spec project guide. Codex reads it when started from the repository root.

If the current session does not include the full root `AGENTS.md`, **you must first Read the repository-root `AGENTS.md`** before running `f2s-*` or modifying `.Knowledge/`.

## Directory Purpose

| Path | Description |
| --- | --- |
| `skills/` | Flow2Spec skills (`f2s-*`) |
| `topics/` | Long-form rule mirrors, sourced from the same content as Cursor/Claude `rules` |
| `hooks.json` | Codex SessionStart hook configuration for injecting a configuration summary and checking the Flow2Spec knowledge-base version on startup |
| `hooks/` | Hook script directory |
| `config.toml` | Project-level Codex configuration, if created |

Configuration source of truth: repository-root **`flow2spec.config.json`** (must be Read); the field-semantics table is in root **`AGENTS.md`**.
