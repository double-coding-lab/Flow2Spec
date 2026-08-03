# Flow2Spec

<p align="center">
  <img src="./assets/readme/hero-zh.svg" width="100%" alt="Flow2Spec 将自然语言编码需求路由到紧凑项目事实后再修改代码">
</p>

<p align="center">
  <strong>让 Cursor、Claude Code、Codex 在动手改代码前，先读到正确的项目事实。</strong>
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="https://double-coding-lab.github.io/Flow2Spec">在线演示</a> ·
  <a href="./docs/Flow2Spec基础介绍.md">基础介绍</a> ·
  <a href="./docs/使用说明.md">使用说明</a> ·
  <a href="./docs/命令说明.md">命令说明</a>
</p>

<p align="center">
  <img alt="npm latest" src="https://img.shields.io/npm/v/@double-codeing/flow2spec?label=latest">
  <img alt="npm beta" src="https://img.shields.io/npm/v/@double-codeing/flow2spec/beta?label=beta">
  <img alt="node version" src="https://img.shields.io/node/v/@double-codeing/flow2spec">
  <img alt="license" src="https://img.shields.io/npm/l/@double-codeing/flow2spec">
</p>

Flow2Spec 是给 AI 编码工具使用的 Spec-driven 工作流层。它会在项目里建立小而可路由的 `.Knowledge/` 知识库，安装面向 agent 的 `f2s-*` 技能，并把可选的本地任务状态和产品知识分开保存。新的会话可以按需求加载相关事实，而不是重新翻完整个仓库。

```bash
npx @double-codeing/flow2spec@latest init
```

尝试当前 beta：

```bash
npx @double-codeing/flow2spec@beta init
```

## 为什么需要它

如果项目记忆不能维护、不能路由，agent 每次处理需求都要重新确认同一批约束。Flow2Spec 把这些事实整理成紧凑的 topic 分片，再把需求路由到需要读取的主题。

| 没有 Flow2Spec | 有 Flow2Spec |
| --- | --- |
| “这个模块的表在哪？” | `[matcher 命中] m-product-review-template-library` |
| “batchReScore 是同步还是异步？” | `[加载依赖] 4 个 topic · 约 300 行` |
| “有没有锁？幂等键是什么？” | `Redis lock ... TTL 10 min` |
| Agent 在修改前搜索 416 个接口、796 份文件、4.7 MB 源码。 | Agent 先读取已验证约束，再打开相关文件。 |

Flow2Spec 不是为了增加文档数量。它把项目事实保存在一层小而准的机读知识里，并让同一套技能在事实变化后同步更新它。

## 它提供什么

| 层 | 作用 | 文件 |
| --- | --- | --- |
| 知识路由 | 把一次需求映射到 agent 需要读取的少量 topics。 | `.Knowledge/manifest-routing.json`, `.Knowledge/matchers/*.json` |
| 主题分片 | 保存 API、上限、锁、数据规则、业务流程等项目事实。 | `.Knowledge/topics/*.md` |
| Agent 入口 | 为 Cursor、Claude Code、Codex 安装规则和技能。 | `.cursor/`, `.claude/`, `.codex/`, `AGENTS.md` |
| 技能工作流 | 澄清需求、编写方案、实现、修复、同步知识、提交。 | `f2s-*` skills |
| 本地任务状态 | 单独保存 AI 步骤和用户侧待办，不混入产品知识。 | `.task/` |

## 开发流程

大多数工作从自然语言开始。已安装的 agent 规则可以按意图选择 matcher、topics 和对应的 `f2s-*` 技能。需要自己指定流程时，再显式输入某个技能入口。

```text
需求
  → 命中 topics
  → 展开依赖
  → 校验缺口
  → 实现 / 修复
  → 把已验证事实写回 .Knowledge
  → 提交前做覆盖检查
```

较大的变更通常这样推进：

```text
用自然语言说明需求
  → 补齐缺失信息
  → 生成或复核技术方案
  → 实现 / 修复
  → 把已验证事实同步进 .Knowledge
  → 提交前检查覆盖情况
```

需要显式指定入口时：

```text
/f2s-kb-feat  新增能力并同步项目知识
/f2s-kb-fix   修复行为并更新对应知识
```

## 渐进式建设知识库

Flow2Spec 不要求一开始做庞大的文档工程。

1. 先运行 `init`，生成基础骨架。
2. 需要架构初稿时，可以让 agent 整理；`/f2s-doc-arch` 是显式入口。
3. 某个模块第一次进入开发时，可以用 `/f2s-kb-add <path>` 导入已有上下文，也可以走正常的 feature/fix 工作流。
4. 提交前检查会提醒你：代码已经变化，知识是否也需要同步。

知识模型刻意分层：

- `stock-docs/` — 稳定项目背景和导入材料。
- `req-docs/` — 面向具体变更的技术方案和实现计划。
- `topics/` — agent 真正会加载的紧凑事实。
- `matchers/` — 把用户需求路由到 topics 的关键词分片。

## 显式技能入口

开启意图识别后，自然语言需求可以自动选择这些工作流。下面的入口适合在你想明确指定流程时使用。

| 命令 | 用途 |
| --- | --- |
| `/f2s-req-clarify` | 补齐缺失信息，直到变更目标没有明显歧义。 |
| `/f2s-req-tech` | 把已确认的需求整理成可实现的技术方案。 |
| `/f2s-kb-feat` | 新增能力，并同步项目知识。 |
| `/f2s-kb-fix` | 修复行为，并更正对应知识。 |
| `/f2s-kb-sync` | 把已实现事实同步进 `.Knowledge/`。 |
| `/f2s-kb-add <path>` | 导入已有模块或文档集。 |
| `/f2s-git-commit` | 提交前检查变更文件和知识覆盖情况。 |

完整参考：

- [使用说明](./docs/使用说明.md)
- [命令说明](./docs/命令说明.md)
- [目录与路径约定](./docs/目录与路径约定.md)
- [体系与原理](./docs/体系与原理.md)
- [设计说明](./docs/设计说明.md)
- [项目里程碑](./docs/项目里程碑.md)

## 什么时候不适合

Flow2Spec 适合上下文漂移成本较高的项目。下面这些场景可能不需要它：

- 写完就删的一次性脚本；
- 很小的个人项目，一份 `CLAUDE.md` 已经够用；
- 团队不愿意让 `.Knowledge/` 和代码保持同步。

## 继续了解

- [Flow2Spec 基础介绍](./docs/Flow2Spec基础介绍.md) — 产品叙事、配图、与普通项目记忆的区别。
- [Flow2Spec Introduction](./docs/en/Flow2Spec-Introduction.md) — 英文长文介绍。
- [在线演示](https://double-coding-lab.github.io/Flow2Spec) — 13 页 HTML PPT。

## 协议

[MIT](./LICENSE)
