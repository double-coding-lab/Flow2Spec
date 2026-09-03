---
description: Flow2Spec 本仓开发纪律：Core 持有模板真源，配置根由 init 分发，CLI/Core/Template 独立版本与发布
---

# Flow2Spec 项目开发纪律（Dev Workflow Constraints）

> **仅适用于 Flow2Spec 本仓自身开发，不下发给普通业务仓。**
>
> 三端同源手写镜像：
> - Claude：`.claude/rules/repo-dev-workflow-constraints.md`
> - Cursor：`.cursor/rules/repo-dev-workflow-constraints.mdc`
> - Codex：`.codex/topics/repo-dev-workflow-constraints.md`
> - 路由摘要：`.Knowledge/topics/f2s-dev-workflow-constraints.md`

## 所有权边界

| 位置 | 角色 | 写入方式 |
| --- | --- | --- |
| `packages/core/templates/{zh-CN,en-US}/` | 下游 Rule、Skill、Hook、知识模板的唯一真源；随 Core tarball 发布 | 人或 Agent 直接维护并提交 Git |
| `.claude/` / `.cursor/` / `.codex/` / 根 `AGENTS.md` | 本仓消费模板后的配置根产物 | 用户明确要求后由 `flow2spec init` / `npm run sync:agents` 分发 |
| `.Knowledge/` | 本仓共享知识库 | 按 topic/skill 写权直接维护 |
| 本仓专属 `repo-*` Rule/Skill | 只服务本仓，不进入 Core templates | 三端配置根手写镜像 |

根 `templates/` 与根 `lib/` 均不再存在：模板和核心实现分别由 `packages/core/templates/`、`packages/core/lib/` 单独持有。`packages/core/templates/` 受 Git 管理，不依赖复制脚本、`.gitignore` 例外或 `prepack` 同步。

## 硬约束

1. 下游会使用的 Rule、Skill、Hook、AGENTS、配置与知识模板，只改 `packages/core/templates/zh-CN/` 和 `packages/core/templates/en-US/`；双语版本保持语义一致。
2. 不直接编辑配置根中由 Core templates 派生的文件。它们会在后续 `init` 中被覆盖。
3. 本规则、`repo-dev-check` 等本仓专属内容不进 Core templates，直接同步三端手写镜像与本仓知识库。
4. Agent 不主动执行 `flow2spec init` / `npm run sync:agents`；只有用户明确要求分发时才执行。
5. 根 `lib/` 不作为兼容入口。CLI 通过 `createFlow2Spec()` 等 Core 公共 API 工作；Core 内部测试可按需引用 `packages/core/lib/`。

## 修改判断

- 通用能力：改 `packages/core/templates/{locale}/...`，必要时同步 Core 实现与公开文档。
- 本仓知识：改 `.Knowledge/topics/`、matcher、manifest/index；触达 topic 时先读 `f2s-topic-authoring`。
- 本仓专属纪律：改三端 `repo-dev-workflow-constraints` 镜像，不写入 Core templates。
- 配置根派生产物：不手改，也不为预览主动执行 init。

## 版本模型

```text
CLI Version       packages/cli/package.json
Core Version      packages/core/package.json
Template Version  packages/core/package.json.templateVersion
Protocol Version  packages/core/capabilities.json.protocolVersion
```

- CLI 对 Core 使用运行时依赖**精确 pin**（`packages/cli/package.json` 里写死 Core 版本号,不是 caret range）；`scripts/workspace-version.js` 会自动同步。
- Core 兼容修复/新增 API 也**必须 CLI 锁步 patch bump 并同发**——CLI 精确 pin 决定的:Core 一升,CLI 依赖字段就变,CLI 版本号必须跟着走(`version:set:core` 回执会提示 `remember to bump CLI patch — release in lockstep`)。仅改 CLI 自身代码(不动 Core)时才允许 CLI 单独发。
- Rule、Skill、Hook、知识模板变化时升 Core,并显式执行 `version:set:template`（同样锁步 CLI patch）。
- CLI 开始调用新版 Core API 时,升 CLI 并同步 Core 精确 pin。
- Protocol Version 只在公共协议不兼容时调整。
- 根 private workspace version 不参与 npm 发布匹配。

版本命令：

```bash
npm run version:set:cli -- <version> [--core-range ^x.y.z]
npm run version:set:core -- <version>
npm run version:set:template -- <version>
npm run version:check
```

## 发布门禁

- `core-vX.Y.Z` 只测试、打包并发布 `@double-coding/flow2spec-core`。
- `cli-vX.Y.Z` 只测试、打包并发布 `@double-coding/flow2spec`。
- 同时发布时先 Core 后 CLI(CLI 精确 pin Core);禁止发布没有版本变化的包。
- CLI README 与根 README 保持一致;Core README 独立维护。
- 发布前运行 `npm run version:check`、`npm run pack:check`、`node scripts/test-package-install.js`。
- `packages/core/templates/` 必须直接进入 Core tarball;不存在模板复制或漂移检查步骤。

## 发版执行步骤(CI 触发,不本地 npm publish)

`.github/workflows/publish-npm.yml` 通过 GitHub OIDC + npm trusted publishing 自动发包并带 provenance。**只有走 CI 才能拿到 npm 详情页的 provenance 勾**;本地 `npm publish` 发出的版本会缺失该证明,已发出去无法补签,只能下版本再发时用 CI 拿回。

标准流程:

1. 在版本 PR(如 `chore/release-core-3.8.0`) merge 到 main 后,本地 `git checkout main && git pull`;
2. 打两个 tag 并推送:`git tag core-vX.Y.Z && git tag cli-vX.Y.Z && git push --tags`;
3. **到 GitHub Releases 页面**为每个 tag **创建 Release**(标题 `core-vX.Y.Z` / `cli-vX.Y.Z`);Release published 事件触发 `publish-npm.yml`;
4. workflow 内已包含 `npm run version:check --tag`、`npm test`、`pack:check`、`npm publish --provenance`,失败即中止。

**禁止本地跑 `npm publish`**——即便临时需要 hotfix,也应通过 workflow 走。若确因意外走了本地发布(如本次 3.8.0 / 3.6.3),须在发版 PR / Release notes 中显式记录「本次发布无 provenance」。

## 更新语义

- `flow2spec version` 展示 CLI、Core、Core Range、Template、Protocol。
- `flow2spec update --check|--cli|--core` 分别检查、更新 CLI、更新兼容 Core。
- Hook 同时比较 Core Version 与 Template Version。
- Core 变化且 Template 不变：更新 Core 并执行一次幂等 init 刷新 Hook，不进入 `f2s-kb-upgrade`。
- Template 变化：更新 Core、执行 init，再按 `projectRev` / `pkgRev` 判断是否进入 `f2s-kb-upgrade`。

## 禁止项

- 禁止恢复根 `templates/`、根 `lib/` 或 `sync-core-templates.js` 双根模型。
- 禁止把 CLI、Core、Template 重新锁步成同一版本。
- 禁止使用单一 `vX.Y.Z` tag 同时发布两个 npm 包。
- 禁止把 Core 代码版本与 `.Knowledge/manifest-routing.json.version` 直接比较来决定知识库升级。
- 禁止把本规则下发给普通业务仓。
