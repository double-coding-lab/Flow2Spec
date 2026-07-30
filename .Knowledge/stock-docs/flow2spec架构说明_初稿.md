# Flow2Spec 项目架构说明（初稿）

> 本初稿由扫描项目结构生成，建议结合业务说明与代码细节进一步补充。

---

## 1. 项目定位

Flow2Spec（`@double-codeing/flow2spec`）是一个 CLI 工具包，用于在业务仓库中初始化并维护一套**可持续的 AI 协作结构**。核心目标：

- 将**业务知识文档**统一沉淀到项目根 `.Knowledge/`
- 将**规则与技能能力**保留在各 AI 工具的配置根（`.cursor/`、`.claude/`、`.codex/`），不破坏原生加载机制

版本：`3.0.1-beta.1` | Node.js >= 16 | 纯 Node.js 实现，无外部运行时依赖

---

## 2. 技术栈

| 层面 | 技术 |
| --- | --- |
| 运行时 | Node.js（>= 16） |
| 语言 | JavaScript（CommonJS） |
| 依赖 | 零外部运行时依赖，仅使用 Node.js 内置模块（fs、path） |

---

## 3. 目录与模块划分

```
flow2spec/
├── cli.js                          # CLI 入口（flow2spec init / config / --help）
├── lib/                            # 核心逻辑库
│   ├── init.js                     # init 命令实现（模板落盘、路由对齐、Agent 配置写入）
│   ├── agents.js                   # Agent 定义（Cursor / Claude / Codex）及目录管理
│   ├── flow2specConfig.js          # flow2spec.config.json 读写与缺省值合并
│   ├── claudeRulesAdapter.js       # Cursor .mdc → Claude .md 规则格式转换
│   └── codexAgentsAdapter.js       # Codex AGENTS.md 动态生成（技能摘要 + 项目配置渲染）
├── templates/                      # 包内模板（init 落盘的数据源）
│   ├── AGENTS.md                   # Codex AGENTS.md 模板（含占位符）
│   ├── flow2spec.config.json       # 默认配置模板
│   ├── knowledge/                  # .Knowledge 目录模板
│   │   ├── index.md                # 人读导航模板
│   │   ├── manifest-routing.json   # 机读路由事实源模板
│   │   ├── matchers/               # 匹配词分片模板
│   │   ├── topics/                 # 主题路由摘要模板
│   │   └── template/               # 终稿与技术方案模板
│   ├── rules/                      # 规则模板（.mdc，Cursor 原生格式）
│   │   ├── f2s-flow2spec-unified-entry.mdc
│   │   ├── f2s-implement-tech-design.mdc
│   │   └── f2s-stock-docs-vs-req-docs.mdc
│   └── skills/                     # 14 个 f2s-* 技能 SKILL.md
│       ├── f2s-doc-arch/           # 架构说明初稿
│       ├── f2s-doc-final/          # 终稿模版转换
│       ├── f2s-kb-add/            # 已落地能力进知识库
│       ├── f2s-doc-pdf/            # PDF 转 MD
│       ├── f2s-kb-build/          # 构建上下文索引
│       ├── f2s-kb-rm/             # 删除上下文映射
│       ├── f2s-req-clarify/        # 需求澄清
│       ├── f2s-req-tech/        # 技术方案
│       ├── f2s-kb-feat/            # 新增能力
│       ├── f2s-kb-fix/             # 修正实现
│       ├── f2s-kb-sync/            # 知识库同步
│       ├── f2s-kb-merge/           # 合并冲突
│       ├── f2s-kb-upgrade/         # 知识库模板升级
│       └── f2s-kb-migrate/         # 旧版迁移
├── docs/                           # 项目说明文档（面向用户，中文）
│   ├── 使用说明.md
│   ├── 命令说明.md
│   ├── 目录与路径约定.md
│   ├── 体系与原理.md
│   ├── 使用案例-模拟对话.md
│   ├── 设计说明.md
│   └── en/                         # 英文文档（与上表一一对应）
│       ├── usage-guide.md
│       ├── commands-reference.md
│       └── …
├── .Knowledge/                     # 业务知识库（由 init 初始化，技能流程维护）
│   ├── stock-docs/                 # 存量上下文源（架构说明、终稿等）
│   ├── req-docs/                   # 需求与技术方案（按方案实现代码的直接输入）
│   ├── topics/                     # 主题路由摘要（执行约束与流程入口）
│   ├── matchers/                   # 匹配词分片（任务关键词表）
│   ├── index.md                    # 人读导航（主题语义与边界）
│   └── manifest-routing.json       # 机读路由事实源（版本、topicPaths、taskToTopicRules）
├── .cursor/                        # Cursor 配置根（rules/ + skills/）
├── .claude/                        # Claude Code 配置根（rules/ + skills/）
└── .codex/                         # Codex 配置根（AGENTS.md + skills/）
```

---

## 4. 关键路径与入口

### 4.1 CLI 入口

- **文件**：`cli.js`
- **命令**：
  - `flow2spec init [agent ...] [--reset-knowledge]` — 初始化 `.Knowledge/` 与各 agent 配置根
  - `flow2spec config` — 打印合并缺省后的配置解析结果
  - `flow2spec --help` — 帮助信息

### 4.2 Init 核心流程（lib/init.js）

1. 补齐/保留 `flow2spec.config.json`（项目级开关）
2. 创建 `.Knowledge/` 目录结构（stock-docs、req-docs、matchers 等）
3. 从 `templates/knowledge/` 复制模板到 `.Knowledge/`（支持增量/强制覆盖）
4. 路由清单增量对齐（`manifest-routing.json` + `matchers/*.json`）
5. 为每个指定 agent 写入配置根：
   - Cursor：`.cursor/rules/`（.mdc 原样）、`.cursor/skills/`
   - Claude：`.claude/rules/`（.mdc → .md 转换）、`.claude/skills/`
   - Codex：`.codex/AGENTS.md`（动态生成，含技能摘要与项目配置）、`.codex/skills/`、`.codex/f2s-rules/*.md`（由 `templates/rules/*.mdc` 镜像，与 Cursor `rules` 条数对齐）

### 4.3 格式适配

- **Claude**：`claudeRulesAdapter.js` 将 Cursor 的 `globs:` 改为 `paths:`，去除 `alwaysApply`，`.mdc` 改为 `.md`
- **Codex**：`codexAgentsAdapter.js` 扫描 `templates/skills/*/SKILL.md` 提取 frontmatter 生成技能摘要列表，并渲染当前项目配置表到 AGENTS.md

---

## 5. 配置与项目开关

**项目根 `flow2spec.config.json`**（init 缺失时从模板补齐）：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `subAgent` | boolean | false | 技能是否允许拆子 agent 执行 |
| `switchAgentVerification` | boolean | false | 是否启用交叉校验（子落盘→主验 / 主落盘→子验） |

- 两字段供所有 `f2s-*` 技能读取，决定编排策略
- 旧键名 `subAgentVerification` 仍可被兼容解析

---

## 6. 知识库工作流

| 场景 | 技能链 |
| --- | --- |
| **上下文沉淀** | `f2s-doc-arch` → `f2s-doc-final` → `f2s-kb-build` |
| **已落地能力补录** | `f2s-kb-add` |
| **按方案实现** | `f2s-doc-pdf`（可选）→ `.Knowledge/req-docs/*.md` → `implement-tech-design` |
| **知识库维护** | `f2s-kb-fix` / `f2s-kb-feat` / `f2s-kb-sync` / `f2s-kb-merge` |
| **包模板升级** | `f2s-kb-upgrade`（其中一步代跑 `flow2spec init`） |
| **旧版迁移** | `f2s-kb-migrate` |

---

## 7. 关键设计原则

1. **`.Knowledge` 承载业务知识**：文档、主题路由、索引，不承载配置根规则执行文件
2. **`rules/skills` 在配置根**：保证 Cursor/Claude/Codex 可按各自原生方式加载
3. **Codex 差异化**：不读取 `rules/` 目录，统一通过 `.codex/AGENTS.md` + `skills/` 承载约束与技能入口
4. **渐进式读取**：`manifest-routing.json` → `matcherPath` 分片 → `topics/` → `stock-docs/req-docs/` → 业务代码
5. **机读 vs 人读分离**：`manifest-routing.json` 是机读事实源，`index.md` 仅作人读导航

---

## 8. 已知限制与待补充项

- 本初稿未覆盖 `lib/init.js` 中模板落盘的详细增量/覆盖策略（如 `copyRecursivePreserve` 的跳过逻辑）
- `scripts/` 目录内容未扫描，用途待补充
- 各技能 SKILL.md 的具体触发词与执行细节未展开（建议按 `f2s-kb-add` 补录进知识库）
- 项目测试覆盖情况（当前 `package.json` 中 test 仅运行 `--help`）
