---
id: flow2spec-core-package
revision: 2
summary: "Core/CLI 所有权、公共 API、独立版本、独立发布与更新兼容契约"
primary: module
confidence: inferred
---
# Flow2Spec Core 包（@double-coding/flow2spec-core）

## 适用场景

维护 npm workspace 包结构、Core 公共 API、CLI/Core 依赖、模板真源、独立版本、发布 tag、更新检测与兼容范围。

## 所有权

- 根 private workspace 只负责开发编排，不作为 Core 运行时依赖声明位置。
- `packages/core/lib/` 承载核心实现；`packages/core/templates/{zh-CN,en-US}/` 是受 Git 管理的唯一模板真源并随 Core tarball 发布。
- 根 `lib/`、根 `templates/` 与 `scripts/sync-core-templates.js` 均不存在。
- CLI 是薄壳，只通过 `@double-coding/flow2spec-core` 的公共 API 工作；当前运行时范围为 `^3.5.0`。

## 公共 API

- `createFlow2Spec({ cwd })` 暴露项目初始化、配置、路由、知识库、协作、doctor、resources 与 update API。
- `getVersions()` 返回 `coreVersion`、`templateVersion`、`protocolVersion`。
- `capabilities.json.protocolVersion` 表示公共协议兼容级别，不表示包版本或模板版本。
- `legacy` 暂时保留 Core 包内的旧消费兼容面；CLI 和仓库测试不再依赖根 shim。

## 独立版本

```text
CLI Version       packages/cli/package.json
Core Version      packages/core/package.json
Template Version  packages/core/package.json.templateVersion
Protocol Version  packages/core/capabilities.json.protocolVersion
```

- `version:set:cli` 只更新 CLI，可显式提高 `--core-range`。
- `version:set:core` 只更新 Core，并拒绝落到当前 CLI 范围之外。
- `version:set:template` 更新 Core 元数据及中英文 `manifest-routing.json.version`。
- `version:check` 校验 semver range、lockfile、双语 Template Version、Protocol Version 与 release tag。

## 发布与更新

- `core-vX.Y.Z` 只发布 Core；`cli-vX.Y.Z` 只发布 CLI。同时发布时先 Core 后 CLI。
- `flow2spec version` 展示 CLI/Core/Core Range/Template/Protocol。
- `flow2spec update --check|--cli|--core` 分别检查、更新 CLI、更新兼容 Core。
- Hook 与 `update.check()` 同时返回 Core 与 Template 状态。
- Core-only 更新：更新 Core 后幂等 init 刷新 Hook，不进入 `f2s-kb-upgrade`。
- Template 更新：更新 Core、执行 init，再由 `projectRev` / `pkgRev` 决定是否进入完整知识库升级。

## 边界

- Core 新版必须落在 CLI caret range 内；超出范围先升级 CLI。
- `.Knowledge/manifest-routing.json.version` 表示 Template Version，不能与 Core Version 混用。
- 包安装验收使用两包 tarball，并验证 Core templates、类型声明、CLI README 与启动行为。
