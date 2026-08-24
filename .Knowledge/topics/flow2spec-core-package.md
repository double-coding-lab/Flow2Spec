---
id: flow2spec-core-package
revision: 0
summary: "@double-coding/flow2spec-core 的职责边界：核心实现、发包模板真源与原生插件 API"
primary: module
confidence: inferred
---
# Flow2Spec Core 包（@double-coding/flow2spec-core）

## 适用场景

回答或维护 npm workspace 包结构、`flow2spec-core` 的职责、CLI 与 core 的依赖关系、原生插件 API、发包模板真源位置、根目录 legacy shim。

## 核心事实

- workspace 三层：根 `flow2spec-workspace`（private）+ `packages/core`（`@double-coding/flow2spec-core`）+ `packages/cli`（`@double-coding/flow2spec`）；三者版本保持一致，CLI 对 core 的依赖固定为同一版本。
- **core 承载全部核心实现**（`packages/core/lib/`）：`init` 落盘引擎、各端适配器（`claudeRulesAdapter` / `claudeSettingsAdapter` / `codexAgentsAdapter` / `dshAgentsAdapter`）、知识库引擎与路由（`knowledgeEngine` / `routing`）、`updateCheck`、`doctor`、`developerId`、`flow2specConfig`、`resources`。
- **npm 发布的模板真源**在 `packages/core/templates/{zh-CN,en-US}/`（`package.json` 的 `files` 含 `templates`）；根 `templates/` 是本仓同步副本，模板改动须双根同步（写盘边界见 `f2s-dev-workflow-constraints`）。
- **原生插件 API**：`createFlow2Spec({ cwd })` 暴露 `resources.skillCatalog()`（宿主适配的结构化 Skill 清单）、`resources.unifiedEntry()`（宿主适配的统一入口）、`update.check()`（复用 `.Knowledge/update-check.json` 每日缓存）；`capabilities.json` 的 `protocolVersion` 供插件启动时做兼容校验；`index.d.ts` 导出完整公共契约类型。
- **CLI 是薄壳**：`packages/cli/cli.js` 只做命令行解析并转调 core；根 `cli.js` 一行转发 `require("./packages/cli/cli.js")`。
- **根 `lib/*.js` 为 legacy shim**：逐文件 `module.exports = require("@double-coding/flow2spec-core").legacy.<name>`，仅保留拆包前旧引用路径的兼容。
- 普通用户只装 CLI 或原生插件（如 DeepSeek Harness 的 `@double-coding/flow2spec-deepseek-harness`），core 作为依赖按锁定版本自动带上。

## 边界与注意

- 本仓开发态下 `packages/cli` → core 的模块解析依赖根 `node_modules/@double-coding/` 的 workspace 软链；fresh clone 或拆包合入后未执行 `npm install` 时会报 `Cannot find module '@double-coding/flow2spec-core'`。下游 npm 安装不受影响（`scripts/test-package-install.js` 从 tarball 真装验证）。
- `packages/core/README.md` 面向 CLI 与原生插件开发者独立维护；`packages/cli/README.md` 必须与根 `README.md` 完全一致（发布门禁见 `f2s-dev-workflow-constraints`）。
