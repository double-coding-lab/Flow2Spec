---
id: f2s-dev-workflow-constraints
revision: 3
summary: "Flow2Spec 本仓的模板真源、配置根、版本发布与分发边界"
primary: policy
confidence: inferred
---
# f2s-dev-workflow-constraints（路由摘要）

## 适用场景

Flow2Spec 本仓开发时判断应改 Core templates、配置根、本仓知识库还是发布脚本；普通下游仓不使用本主题。

## 长文规则

- Claude：`.claude/rules/repo-dev-workflow-constraints.md`
- Cursor：`.cursor/rules/repo-dev-workflow-constraints.mdc`
- Codex：`.codex/topics/repo-dev-workflow-constraints.md`

三份是同源手写镜像，执行时读取当前客户端对应版本。

## 核心约束

1. 下游会使用的 Rule、Skill、Hook、AGENTS、配置与知识模板只改 `packages/core/templates/{zh-CN,en-US}/`；该目录是受 Git 管理的唯一模板真源。
2. 配置根中有 Core template 对应源的文件属于 init 产物，不直接手改。
3. 本仓专属 `repo-*` Rule/Skill 不进入 Core templates，直接同步三端配置根与本仓知识库。
4. Agent 不主动运行 `flow2spec init` / `npm run sync:agents`，由用户明确触发分发。
5. 根 `lib/`、根 `templates/` 与模板复制脚本不再使用。

## 版本与发布

- CLI、Core、Template、Protocol 独立版本；CLI 用 caret range 约束 Core。
- Core-only 兼容更新不升 Template Version，也不触发知识库升级。
- `core-vX.Y.Z` 与 `cli-vX.Y.Z` 分别发布对应包。
- 发布前执行版本、打包、tarball 安装与 README 门禁。

## 边界与禁止项

- 本主题和长文规则只服务 Flow2Spec 本仓，不进入下游模板。
- 禁止恢复双模板根或版本锁步模型。
- 禁止用 Core Version 覆盖 `manifest-routing.json.version`；该字段表示 Template Version。
