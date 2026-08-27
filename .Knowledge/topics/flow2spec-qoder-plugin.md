---
id: flow2spec-qoder-plugin
revision: 2
summary: "Qoder 原生插件构建：从 Core 全量生成 skills/rules/hooks 并打包 zip"
primary: feature
confidence: inferred
tags: [module]
---
# Qoder 插件构建与分发

## 适用场景

用于 Qoder 插件构建、`npm run build:qoder-plugin`、`output/qoder-plugin/` 产物、插件 zip 打包与插件市场分发问题。

## 已落地能力

- `scripts/build-qoder-plugin.js` 通过 `@double-coding/flow2spec-core` 的 `resources` 公共 API（`skillCatalog` / `listRules` / `listHooks` / `read` / `getVersions`）全量生成 Qoder 原生插件：18 skills + 10 rules + 3 hooks + `.qoder-plugin/plugin.json` + README + logo。
- 采用 dsh host 适配生成内容：技能名 kebab-case（如 `f2s-kb-addRules` → `f2s-kb-add-rules`，满足 Qoder 市场命名规范），路径统一为插件根相对的 `rules/`、`skills/`，与 Qoder 插件目录布局一致。
- hooks 占位符（`__FLOW2SPEC_*__`）按 `init` 同款规则以 Core / Template Version 渲染；`hooks/hooks.json` 用 `${QODER_PLUGIN_ROOT}` 定位脚本（SessionStart 配置摘要 + 版本检查，PreToolUse matcher `Skill` 配置兜底注入）。
- 零依赖 ZIP 打包（Node 内置 `zlib` + 脚本内 ZIP 格式实现）：产出 `output/qoder-plugin/flow2spec-<coreVersion>.zip`，zip 根即插件根（直接包含 `.qoder-plugin/plugin.json`），满足市场上传要求。
- 插件版本跟随 Core Version；`--locale en-US` 可生成英文版。

## 维护边界

- 构建脚本：`scripts/build-qoder-plugin.js`（npm script `build:qoder-plugin`）
- 内容事实源：`packages/core/index.js` 的 `resources` API 与 `packages/core/templates/`（包边界与版本契约见 `flow2spec-core-package` 主题）
- 产物目录：`output/qoder-plugin/`（已 gitignore；每次构建先清空重建）
- 插件使用前提：目标项目须先 `npx @double-coding/flow2spec init plugin`（插件模式：仅生成 `.Knowledge/` 与 `flow2spec.config.json`，不写客户端配置根；目标语义见 `flow2spec-init-defaults` 主题）

## 禁止项

- 手工编辑 `output/qoder-plugin/` 下产物（下次构建会整体覆盖）；内容修正应改 `packages/core/templates/` 或构建脚本后重跑构建。
