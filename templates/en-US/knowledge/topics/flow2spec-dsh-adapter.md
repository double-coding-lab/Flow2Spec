---
id: flow2spec-dsh-adapter
revision: 1
summary: "DeepSeek Harness project skill initialization and directory adapter"
primary: feature
confidence: inferred
tags: [module]
---
# DeepSeek Harness Adapter

Use this topic for `flow2spec init dsh`, DeepSeek Harness skill discovery, `.dsh/skills`, `.dsh/topics`, and the repository-root `AGENTS.md` entry.

- Skills are written to `.dsh/skills/<skill-name>/SKILL.md`.
- Long-form rules are mirrored to `.dsh/topics/*.md`, with `.dsh/AGENTS.md` as a directory pointer.
- A missing root `AGENTS.md` receives a full entry; an existing entry is preserved.
- Native Cordis plugin is available: [Flow2Spec-DeepSeek-Harness](https://github.com/double-coding-lab/Flow2Spec-DeepSeek-Harness), npm package `@double-coding/flow2spec-deepseek-harness`.
- `flow2spec init dsh` remains the project-level fallback when the native plugin is not installed.
