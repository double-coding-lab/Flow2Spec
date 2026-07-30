# flow-spec — 让 AI 一直知道你在做什么

> 解决 Cursor / Claude Code 的「失忆症」——用一个命令初始化，让 AI
> 跨会话记住项目上下文，不用每轮重新交代。
>
> 🌐 **[English](./README.md)** · 中 / EN

🎬 **[在线演示](https://lands-1203.github.io/flow-spec/)**（13 页 HTML PPT，`←` `→` 翻页，`S` 演讲者模式）

📖 **[flow-spec 基础介绍](./docs/flow-spec基础介绍.md)** · **[Introduction (EN)](./docs/en/flow-spec-introduction.md)** — 长文：为什么做 flow-spec、知识图谱 vs 项目记忆，含配图与流程图

🔧 **快速体验**：

```bash
npx @double-codeing/flow-spec@latest init
```

---

## Before / After

同样一句话，两段对话：

```
> 改一下评价模板文案库的批量重评分
```

**没有 flow-spec**：

```
AI: 这个模块的表在哪？
AI: batchReScore 是同步还是异步？
AI: 有没有锁？幂等键是什么？
AI: 返回格式是什么？错误码是多少？
AI: （翻遍 416 个接口、796 份文件、4.7 MB 源码…）
```
反复介绍 · 反复翻代码 · 反复踩坑

**有 flow-spec**：

```
[matcher 命中] m-product-review-template-library
[加载依赖] 4 个 topic · 约 300 行
AI: 已知 — fire-and-forget
     Redis 锁 smp:product-review:template-library:batch-rescore:lock（TTL 10 分钟）
     单次最多 100 条 · 错误码 101
AI: 开始改，预计 3 处文件。
```
4.7 MB → 300 行 · 秒级定位到硬约束

---

## flow-spec 做这些事

**① 跨会话记住项目上下文**
`.flow-spec/` 结构化知识库：路由清单（manifest-routing.json）+ 关键词索引（matchers）+ 主题分片（topics）。AI 启动时只读该读的，4.7 MB 源码压到 300 行精准上下文。

**② 路由清单让 AI 不翻仓库，只拿该拿的**
每次需求命中 1~4 个 topic，约 300 行。业务的硬约束——锁的 key、错误码、上限——都在 topic 里，AI 不用从源码猜。

**③ fs-* 技能改代码顺手更新知识**
`/fs-kb-feat` 写功能时同步写 topic，`/fs-kb-fix` 修 bug 时更正 topic，`/fs-git-commit` 提交前检查 topic 覆盖。改代码就是记知识，没有"单独维护文档"这件事。

**④ 需求到实现全链路：澄清 → 技术方案 → 代码**
`/fs-req-clarify` 反问到无歧义，`/fs-req-tech` 生成可直接实现的技术方案文档落到 `req-docs/`，AI 按方案实现，不靠口头约定。

**⑤ 任务清单跨会话追踪进度**
开启 `changeTracking` 配置后，`fs-kb-feat` / `fs-kb-fix` 等技能执行时自动创建带 checkbox 的 `task.md`，每步完成立即打钩落盘。新会话续作时自动加载剩余清单，不靠记忆、不靠口头，任务进度永远在磁盘上。用户侧的代办（执行 SQL、配环境变量、点审批）单独写入 `user-todos.md`，不混在 AI 步骤里。

**⑥ 文档驱动：PDF / MD 一键入知识库**
`/fs-kb-add` 把已落地能力的源码聚合成初稿 → 终稿 → topics，`/fs-doc-final` 把 PDF 或任意 MD 转成规范终稿格式。外部文档、历史方案都能变成可路由的知识。

---

## 上手成本

**最小可用集是一个空骨架。**

```bash
npx @double-codeing/flow-spec@latest init
```

1 分钟生成目录结构 + 路由配置，空的，直接跑。**下次需求命中哪块，写哪块**，不提前建设。

真实仓库跑了三个月的数据：

| 指标 | 数值 |
|---|---|
| 对外接口数 | 416 |
| 源码体积 | 796 文件 / 4.7 MB / ~10 万行 |
| flow-spec 每次加载 | **≈ 300 行**（噪声切掉 99%） |

---

## 使用流程

### 第一步：初始化（一次性）

```bash
npx @double-codeing/flow-spec@latest init
```

跟着提示走完，生成 `.flow-spec/` 目录结构和路由配置骨架。

---

### 第二步：建知识库（一次性）

在 Agent 工具（Cursor / Claude Code）中执行：

1. `/fs-doc-arch` — 扫描项目架构，生成架构说明初稿，跟着流程走直到生成主题（topics）

> 这一步只做一次，之后日常开发不需要重复。

2. `/fs-kb-add <文件夹路径>` — 把还没入库的功能模块路径补进来

> 这一步在进入开发前，发现没有某个模块能力的知识的时候选择性的去做

---

### 第三步：日常开发（每次需求）

**大需求：**

```
/fs-req-clarify  一句话需求或粘贴 PRD    ← 需求澄清
/fs-req-tech                          ← 生成技术方案
自然语言：实现上面的技术方案              ← AI 开始实现（开启 changeTracking 时自动建任务清单）
（调试验证）
/fs-kb-feat  新增 xxx 能力               ← 功能缺失时补能力
/fs-kb-fix   修复 xxx                    ← 有 BUG 时修复
/fs-kb-sync                              ← 同步知识库
/fs-git-commit                           ← 检查并提交
```

**小需求 / 日常改动：**

```
/fs-kb-feat  新增 xxx 能力               ← 功能缺失
/fs-kb-fix   修复 xxx                    ← 改 BUG
```

---

## 常用命令速查

| 命令 | 用途 |
|---|---|
| `/fs-req-clarify` | 需求澄清 |
| `/fs-req-tech` | 生成技术方案 |
| `/fs-kb-feat` | 新增小功能 |
| `/fs-kb-fix` | 改 BUG |
| `/fs-kb-sync` | 同步知识库 |
| `/fs-git-commit` | 提交代码；“快捷提交”跳过知识库覆盖检查 |
| `/fs-kb-add <路径>` | 接口模块入知识库 |

更多命令详见 [使用说明](./docs/使用说明.md) · [命令说明](./docs/命令说明.md)

---

## 什么时候别用

- **一次性脚本** — 写完就删的东西，直接丢几个 Markdown 给 AI 更快
- **单人小项目** — 一份 CLAUDE.md 就够，路由和分片的开销大于收益
- **团队不愿同步 .flow-spec/** — 工具不能替代纪律

---

## 详细文档

**从这里开始** — 产品叙事与配图：

- [flow-spec 基础介绍](./docs/flow-spec基础介绍.md)（中文）
- [flow-spec introduction](./docs/en/flow-spec-introduction.md)（EN）

**上手与参考**

### 中文
- [使用说明](./docs/使用说明.md) — 技能链、配置详解
- [命令说明](./docs/命令说明.md) — 所有 fs-* 命令速查
- [目录与路径约定](./docs/目录与路径约定.md)
- [体系与原理](./docs/体系与原理.md)
- [使用案例·模拟对话](./docs/使用案例-模拟对话.md)
- [设计说明](./docs/设计说明.md)
- [项目里程碑](./docs/项目里程碑.md)

### English
- [Usage Guide](./docs/en/usage-guide.md)
- [Commands Reference](./docs/en/commands-reference.md)
- [Directory Conventions](./docs/en/directory-conventions.md)
- [Architecture & Principles](./docs/en/architecture.md)
- [Usage Scenarios](./docs/en/usage-scenarios.md)
- [Design Principles](./docs/en/design-principles.md)
- [Project Milestones](./docs/en/milestones.md)

## 协议

MIT. Copyright © 2026 兰涛
