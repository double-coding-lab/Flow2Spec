# f2s-doc-routing（路由摘要）

> **唯一长文**：Cursor / Claude 以配置根 **`rules/f2s-stock-docs-vs-req-docs.md(c)`** 为准。  
> **Codex**：不读 `rules/`，须执行 **`.codex/f2s-rules/f2s-stock-docs-vs-req-docs.md`**（由 `flow2spec init` 从模板 `rules` 自动镜像）中的等效约束。

## 本文件作用

- 供 `manifest-routing.topicPaths`、**`topicDependencies`** 与 `index.md` 锚定主题 id **`f2s-doc-routing`**。
- 仅保留**目录分工**记忆点。

## 目录分工（须与规则一致）

| 目录 | 用途 |
| --- | --- |
| `.Knowledge/stock-docs/` | 架构、终稿、沉淀；`f2s-kb-build` / `f2s-doc-final` 等优先落盘。 |
| `.Knowledge/req-docs/` | 需求澄清、**技术方案**、按方案实现时的 MD 输入。 |

**原则**：按方案写代码只读 **`req-docs`**；不要把 **`stock-docs`** 当编码直接输入。

## 下一步读什么

| 环境 | 下一步 |
| --- | --- |
| Cursor / Claude | 打开或 @ **`rules/f2s-stock-docs-vs-req-docs`**。 |
| Codex | 读 **`.codex/f2s-rules/f2s-stock-docs-vs-req-docs.md`**。 |
