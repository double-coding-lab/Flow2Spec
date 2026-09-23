---
id: flow2spec-core-package
revision: 3
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
- CLI 是薄壳，只通过 `@double-coding/flow2spec-core` 的公共 API 工作；当前运行时范围为 `^3.8.2`。

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

- `version:set:cli` 更新 CLI 并保留原 Core 范围；传 `--core-range ^x.y.z` 时显式调整兼容下限。
- `version:set:core` 只更新 Core 与 lockfile，保留 CLI 版本和范围；不兼容时写盘前报错。
- `version:set:template` 更新 Core 元数据及中英文 `manifest-routing.json.version`。
- `version:check` 校验当前 Core 满足 CLI caret 范围，另校验 lockfile、双语 Template Version、Protocol Version 与 release tag。

## 发布与更新

- `core-vX.Y.Z` 只发布 Core；`cli-vX.Y.Z` 只发布 CLI。Core/Template 兼容更新可独立发布；双包更新时先 Core 后 CLI。
- `flow2spec version` 展示 CLI/Core/Core Range/Template/Protocol。
- `flow2spec update --check` 展示兼容 Core 目标；`--cli` 更新 latest CLI 及其兼容 Core；`--core` 保留当前 CLI 版本，刷新兼容 Core。更新后校验 CLI 实际解析的 Core，失败返回错误。
- Hook 与 `update.check()` 同时返回 Core 与 Template 状态。
- CLI/Core 更新：`update --cli` 到位后幂等 init 刷新 Hook。
- Template 更新：`update --cli` 后执行 init，再由 `projectRev` / `pkgRev` 决定是否进入完整知识库升级。

## 边界

- CLI 对 Core 为 caret 兼容范围；已有安装需显式更新，项目锁文件仍固定解析版本。跨兼容范围需先升级支持该 Core 的 CLI。旧精确依赖 CLI 需先升级一次。
- `.Knowledge/manifest-routing.json.version` 表示 Template Version，不能与 Core Version 混用。
- 包安装验收使用两包 tarball，并验证 Core templates、类型声明、CLI README 与启动行为。
