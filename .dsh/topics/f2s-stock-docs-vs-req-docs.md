> **唯一长文**：本文件为 **f2s-doc-routing** 的完整约定。`.Knowledge/topics/f2s-stock-docs-vs-req-docs.md` 仅为路由摘要；**Codex** 读取 `.codex/topics/f2s-stock-docs-vs-req-docs.md`（由 `flow2spec init` 从本文件自动镜像）作为等效条令。

# stock-docs 与 req-docs

- **`.Knowledge/stock-docs/`**：PDF/初稿/终稿/架构说明等**存量源文档**；`f2s-kb-build`、`f2s-doc-final`、`f2s-doc-arch`、`f2s-kb-add` 的文档落盘优先在此。`sourceDoc` 统一写 `.Knowledge/stock-docs/<文件名>.md`。
- **`.Knowledge/req-docs/`**：需求澄清、技术方案（前后端/数据/任务等）、`f2s-doc-pdf` 输出的「按方案实现」MD；`implement-tech-design` 的触发范围为 `.Knowledge/req-docs/**/*.md`。

完整约定见本规则与 **`skills/f2s-doc-routing/SKILL.md`**；`.Knowledge/topics/f2s-stock-docs-vs-req-docs.md` 为路由摘要。
