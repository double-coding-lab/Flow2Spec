---
description: 区分 .flow-spec/stock-docs（存量上下文）与 .flow-spec/req-docs（需求与技术方案）；禁止混用路径与链出目标
globs:
  - "**/.flow-spec/stock-docs/**/*.md"
  - "**/.flow-spec/req-docs/**/*.md"
alwaysApply: false
---

> **唯一长文**：本文件为 **fs-doc-routing** 的完整约定。`.flow-spec/topics/fs-stock-docs-vs-req-docs.md` 仅为路由摘要；**Codex** 读取 `.codex/fs-rules/fs-stock-docs-vs-req-docs.md`（由 `flow-spec init` 从本文件自动镜像）作为等效条令。

# stock-docs 与 req-docs

- **`.flow-spec/stock-docs/`**：PDF/初稿/终稿/架构说明等**存量源文档**；`fs-kb-build`、`fs-doc-final`、`fs-doc-arch`、`fs-kb-add` 的文档落盘优先在此。`sourceDoc` 统一写 `.flow-spec/stock-docs/<文件名>.md`。
- **`.flow-spec/req-docs/`**：需求澄清、技术方案（前后端/数据/任务等）、`fs-doc-pdf` 输出的「按方案实现」MD；`implement-tech-design` 的触发范围为 `.flow-spec/req-docs/**/*.md`。

完整约定见本规则与 **`skills/fs-doc-routing/SKILL.md`**；`.flow-spec/topics/fs-stock-docs-vs-req-docs.md` 为路由摘要。
