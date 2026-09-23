---
id: architecture-document-naming
revision: 0
summary: "架构文档固定命名与业务主题去项目名前缀"
primary: policy
confidence: inferred
sourceDoc: ".Knowledge/stock-docs/架构文档命名约定_终稿.md"
---
# 架构文档与主题命名

## 执行约定

- 中文架构初稿：`项目架构初稿.md`，标题 `项目架构初稿`；终稿：`项目架构终稿.md`，标题 `项目架构终稿`。默认位于 `.Knowledge/stock-docs/`。
- 英文对应 `project-architecture_draft.md` / `project-architecture_final.md`，标题 `Project Architecture Draft` / `Project Architecture Final`。
- `f2s-doc-arch → f2s-doc-final → f2s-kb-build` 按上述名称交接；建库拒绝含 `初稿` 或 `_draft` 的输入，要求先完成终稿。
- 架构概览 topic id 为 `project-architecture`，标题 `项目架构`（英文 `Project Architecture`）。业务 topic id、文件名、标题及派生 matcher id 按职责命名，项目名仅用于正文；保留既有 `f2s-*` 技能/规则标识。
- 指定输出路径时保留目录，归一化架构文件名并告知实际路径；已有同名文档增量更新。带前缀旧主题迁移须确认范围和冲突后同步引用，不自动删除。

## 实现与边界

模板真源为 `packages/core/templates/{zh-CN,en-US}/skills/{f2s-doc-arch,f2s-doc-final,f2s-kb-build}/SKILL.md` 与 `rules/f2s-topic-authoring.md`；普通能力文档沿用通用方案命名。

## 详细资料

[架构文档命名约定](../stock-docs/架构文档命名约定_终稿.md)
