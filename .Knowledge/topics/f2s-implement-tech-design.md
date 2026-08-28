---
id: implement-tech-design
revision: 0
summary: "按技术方案/需求文档实现代码的流程与门禁"
dependsOn: [f2s-doc-routing]
primary: policy
confidence: manual
---
# implement-tech-design（路由摘要）

> **唯一长文**：Cursor / Claude 以配置根 **`rules/f2s-implement-tech-design.md(c)`** 为准。  
> **Codex**：不读 `rules/`，须执行 **`.codex/topics/f2s-implement-tech-design.md`**（由 `flow2spec init` 从模板 `rules` 自动镜像）中的等效约束。

## 本文件作用

- 供 `manifest-routing.topicPaths` 与 `index.md` 锚定主题 id **`implement-tech-design`**。
- 仅保留**路径与角色**记忆点，避免与 `rules/` 双份维护长文。

## 路径与角色（须与规则一致）

- 技术方案输入：`.Knowledge/req-docs/*.md`（及 PDF 经 `f2s-doc-pdf` 落入同目录的 MD）。
- 存量沉淀：`.Knowledge/stock-docs/` — **不**作为「按方案写代码」的直接输入。

## changeTracking 集成

若 `flow2spec.config.json` 中 `changeTracking.implement: true`：
- 步骤 2.5 输出任务列表后，同步写入 `.task/active/<task-name>/task.md`
- 步骤 5 收尾时归档至 `.task/completed/<YYYYMMDD>-<task-name>/`，并从 `todo.json` 删除条目

## 下一步读什么

| 环境 | 下一步 |
| --- | --- |
| Cursor / Claude | 打开或 @ **`rules/f2s-implement-tech-design`**，按其中步骤执行。 |
| Codex | 读 **`.codex/topics/f2s-implement-tech-design.md`**。 |
