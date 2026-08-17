# Flow2Spec（`.codex/` 目录说明）

> 本文件为 **指针**，非完整条令。`flow2spec init` 写入；**请勿只读本文件**。

## 完整条令

仓库根 **[`AGENTS.md`](../AGENTS.md)** 为 Flow2Spec 完整项目说明。在仓库根启动 Codex 时读取该文件。

若当前会话未包含根 `AGENTS.md` 全文，**必须先 Read 仓库根 `AGENTS.md`**，再执行 `f2s-*` 或改动 `.Knowledge/`。

## 本目录用途

| 路径 | 说明 |
| --- | --- |
| `skills/` | Flow2Spec 技能（`f2s-*`） |
| `topics/` | 规则长文镜像（与 Cursor/Claude `rules` 同源） |
| `hooks.json` | Codex SessionStart hook 配置，用于启动时注入配置摘要并检测 Flow2Spec 知识库版本 |
| `hooks/` | hook 脚本目录 |
| `config.toml` | 项目级 Codex 配置（若已创建） |

配置真值：仓库根 **`flow2spec.config.json`**（须 Read）；字段语义表见根 **`AGENTS.md`**。
