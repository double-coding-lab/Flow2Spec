# Flow2Spec 项目入口

本文件由 `flow2spec init` 写入仓库根 **`./AGENTS.md`**，作为 Codex 读取的项目入口。**`./.codex/AGENTS.md`** 仅为指针。知识库根目录为 **`./.Knowledge/`**。

## 先做这两步

1. **本轮首次处理当前仓库相关问题时，先读 `./.Knowledge/manifest-routing.json`。**
2. **执行任何 `f2s-*` 技能前，先 `Read("flow2spec.config.json")`。**

```text
必须执行：Read(".Knowledge/manifest-routing.json")
必须执行：Read("flow2spec.config.json")  ← 仅在进入 f2s-* 技能前
```

禁止在未读 `flow2spec.config.json` 的情况下进入 `f2s-*` 技能正文。

## 配置开关（以磁盘为准）

下表只说明字段语义与 `flow2spec init` 写入的默认值；配置真值仍以本轮 `Read("flow2spec.config.json")` 结果为准（用户可能手工改过）。

| 配置项 | init 默认 | 说明 |
| --- | --- | --- |
| `subAgent` | `true` | 技能正文写明某步可用子 agent 时，`true` 才允许拆子；`false` 一律主会话完成。用户「动态判断谁用子 agent」仅当本项为 `true` 时有效。 |
| `switchAgentVerification` | `true` | 切换 agent 校验。仅当本项为 `true` 且当前技能正文明确绑定该字段时启用交叉校验；否则仍是谁落盘谁自验。旧键 `subAgentVerification` 仍可被解析。 |
| `intentRecognition` | `true` | `true` 时可按 `f2s-intent-routing` 对高置信操作意图自动进入对应 `f2s-*` 技能；`false` 或缺失时不自动分流。 |
| `changeTracking.feat` | `true` | `true` 时 `f2s-kb-feat` 步骤 0 必须创建/续作 `.task/active/` 变更追踪任务；`false` 时跳过。 |
| `changeTracking.fix` | `false` | `true` 时 `f2s-kb-fix` 步骤 0 必须创建/续作 `.task/active/` 变更追踪任务；`false` 时跳过。 |
| `changeTracking.implement` | `true` | `true` 时 `f2s-implement-tech-design` 写入任务清单并在满足归档门禁后归档；`false` 时跳过变更追踪部分。 |
| `collaboration.enabled` | `true` | `true` 时按 developerId 隔离任务根 `.task/<id>/`；`false` 时始终 legacy 单根 `.task/`。 |
| `collaboration.developerId` | `""` | 非空则作为任务进度目录名；空则尝试 git user.email/name 规范化；仍无则 legacy `.task/`。解析顺序：config → git → legacy。 |

- `subAgent=true` 时，主 agent 必须在技能前段**显式判断一次**本次是否拆子，并说明原因；即使判断不拆，也必须输出不拆原因。`subAgent=false` 时不得拆子 agent。
- `intentRecognition=false` 或字段缺失时，禁止自动进入任何 skill；只能按用户显式触发或当前规则允许的高置信分流进入。

配置细表与补充规则见 **`./.codex/topics/f2s-config-check.md`**。

## KB 路由规则

- 机读事实源只认 **`./.Knowledge/manifest-routing.json`** 与其 `matcherPath` 指向的 **`./.Knowledge/matchers/*.json`**。
- 按 `match -> expand -> verify -> act` 执行：主命中后先展开 `topicDependencies`，再检查是否缺关键上下文。
- 仅在以下情况允许跨 matcher 全量补检索：无命中、主次候选过近、缺口检查失败、用户明确要求“全量检查/不要遗漏”。
- `fallbackTopic` 仅作低置信兜底，不能直接作为最终执行依据。

## 普通问答收口门禁

- 普通问答 / 排查 / 解释若需要下钻业务源码，先按 **`./.codex/topics/f2s-knowledge-preflight.md`** 执行首读与缺口说明。
- 只要本轮读取过业务源码，且最终答案引用了源码事实，发出答案前必须按 **`./.codex/topics/f2s-kb-feedback-closing.md`** 四 case 收口；答案末尾必须显式输出 **`知识库补充建议`** 或 **`知识库已覆盖`**，不得静默省略。
- 已进入 `f2s-*` 技能、`implement-tech-design`、`f2s-git-commit` 或其他已有后续流程时，不重复追加普通问答收口提示。

## 渐进式读取顺序

1. `./.Knowledge/manifest-routing.json`
2. 命中规则的 `./.Knowledge/matchers/<id>.json`
3. 相关 `./.Knowledge/topics/<topic>.md`
4. 仅在 topic 指向或上下文不足时再读 `./.Knowledge/index.md` / `stock-docs` / `req-docs`
5. 最后才下钻业务代码

禁止跳过 `manifest-routing.json` 直接全仓搜索。  
禁止把 `./.Knowledge/stock-docs/` 作为“按方案实现代码”的直接输入。  
同一任务线内不要反复全文读取 `manifest-routing.json`，除非用户明确说路由/知识已更新。

## 执行依据

- Flow2Spec 执行依据只认：
  - 仓库根 **`./AGENTS.md`**
  - **`./.codex/topics/f2s-*.md`**
  - **`./.codex/skills/`**
- **`.codex/AGENTS.md`** 仅为目录指针，不能替代根 `AGENTS.md`。

## Codex 规则镜像（按需打开）

这些文件由 `flow2spec init codex` 从规则模板镜像到 `.codex/topics/`。它们不会自动全文加载；当前任务需要细则时再打开。

| 规则 | 路径 | 什么时候读 |
| --- | --- | --- |
| 统一入口 | `./.codex/topics/f2s-flow2spec-unified-entry.md` | 执行 `f2s-*` 技能、判断 KB 路由 / 子 agent / 校验语义时 |
| 配置前置 | `./.codex/topics/f2s-config-check.md` | 核对 `flow2spec.config.json`、`subAgent`、`changeTracking` 细则时 |
| 普通问答首读门禁 | `./.codex/topics/f2s-knowledge-preflight.md` | 普通问答要下钻源码前 |
| 普通问答收口 | `./.codex/topics/f2s-kb-feedback-closing.md` | 普通问答读取源码后判断是否建议补知识库 |
| 意图识别 | `./.codex/topics/f2s-intent-routing.md` | 仅当 `intentRecognition=true`，需要判断是否自动进入 skill 时 |

`implement-tech-design`、`f2s-doc-routing` 等长文按命中 topic 再打开，不必默认通读。

## Codex Hooks

`flow2spec init codex` 会写入 **`.codex/hooks.json`**。当前 Flow2Spec 在 Codex 侧只把 hooks 用于：

- `SessionStart` 配置摘要提醒：`.codex/hooks/f2s-config-session.js`
- `SessionStart` 知识库版本检查：`.codex/hooks/f2s-update-check.js`

这些 hook 只做提醒 / 检测，不替代 `Read("flow2spec.config.json")` 与 KB 路由门禁。

## Flow2Spec 技能

可用技能位于 **`./.codex/skills/`**。仅在用户显式触发或当前规则允许自动分流时进入对应 skill。

- `f2s-doc-arch`：根据用户说明或文档（或扫描代码）生成项目架构说明初稿，无固定格式，描述清楚即可；触发：项目架构说明、f2s-doc-arch、架构初稿
- `f2s-doc-final`：将 PDF 或 MD 转为《终稿模版》规范格式，便于后续用 f2s-kb-build 同步 topics/index/manifest；触发：f2s-doc-final、转成概述模板、终稿模版
- `f2s-doc-milestone`：据 req-docs、git log、.task 与知识库主题语义生成里程碑（《项目里程碑模版》）；触发：f2s-doc-milestone、生成项目里程碑、里程碑。命令后可附语义化范围。本技能固定子 agent 生成、主 agent 验证，不受 flow2spec.config 编排开关影响
- `f2s-doc-pdf`：将 PDF 技术方案转为 Markdown 并保存到 req-docs，可补全流程说明；触发：PDF转MD、按方案实现前的 PDF
- `f2s-git-commit`：代码写完后提交 Git：默认检查变更与知识库覆盖；用户明确要求“快捷提交”时跳过知识库覆盖检查；**改动全为纯文档 / 知识库自身**或**近 30 分钟内已跑过 kb-sync/kb-feat/kb-fix** 时自动跳过覆盖检查；生成带 emoji 首行的提交说明后**可直接 commit**（须在当条回复展示首行，不要求用户单独确认 commit）；**git pull 类拉取须用户先确认**。触发：f2s-git-commit、提交代码、快捷提交、git commit、帮我提交
- `f2s-kb-add`：工作中把已落地能力解析进知识库（多文件聚合）：初稿→终稿→topics/index/manifest；触发：f2s-kb-add、已有能力进知识库、多文件生成上下文
- `f2s-kb-addRules`：把用户口述的规则沉淀进知识库，自动判定「新建主题 / 并入存量主题」并同步路由；不写代码、不创建 .task/；触发：f2s-kb-addRules、新增规则、口述规则、把这条记到知识库
- `f2s-kb-build`：根据 .Knowledge/stock-docs 文档生成知识路由主题与索引；触发：生成项目上下文、f2s-kb-build、终稿生成上下文
- `f2s-kb-distill`：从问答过程中提取可复用知识事实并自动入库；根据下钻深度与命中主题判断新增主题或补充既有主题；触发：f2s-kb-distill、问答知识提取、从对话中提取知识
- `f2s-kb-feat`：新增能力时补全实现与知识库；已实现则仅同步知识库；触发：f2s-kb-feat、新增能力
- `f2s-kb-fix`：根据用户指出的实现或规则错误修正代码，并默认同步知识库；触发：f2s-kb-fix、修正实现规则
- `f2s-kb-merge`：解决 Git 合并后编辑器上下文冲突；可选传入冲突文件；实现侧冲突仅罗列待用户确认；触发：合并上下文冲突、f2s-kb-merge
- `f2s-kb-migrate`：旧版知识库一次性迁到 `.Knowledge`：以配置根 `docs-index.md` + 规则统一入口（旧版 `rules/main.md(c)` 或新版包 `rules/f2s-flow2spec-unified-entry.md(c)`）为主索引线索，全量处理业务 `rules/` 与业务 `skills/`（排除 `f2s-*` 包技能），并全量迁移 `stock-docs`/`req-docs`；**迁移验收后必选**落盘 `.Knowledge/migration-report.md`（迁移对照表 + 拟删除路径列表）；**收尾必选**删除已迁旧的 `rules/`、已迁业务 `skills/`、旧版 `docs-index.md`/`index-doc.md`；用户只**核对/修订删除清单（排除项）**；触发：f2s-kb-migrate、知识库迁移、旧版迁移
- `f2s-kb-rm`：删除某 stock-docs 文档对应的知识主题与索引映射；触发：删除项目上下文、f2s-kb-rm
- `f2s-kb-sync`：可显式给出能力或零输入推断；先输出知识库更新大纲，确认后写入 topics/index/manifest；触发：f2s-kb-sync、全局同步、知识库同步、已实现能力
- `f2s-kb-upgrade`：知识库模板升级技能（仅指本 SKILL）：**流程分流 V1** 须先 f2s-kb-migrate 再在流程内代跑 flow2spec init；**现行库（流程代号 V2+，含已用 .Knowledge 的 Flow2Spec npm v3.x 等项目）** 则代跑 init 以对齐 manifest-routing + matchers 分片（包内 `manifest-matchers.json` 仅作 init 合并种子，不落盘 .Knowledge）。触发：f2s-kb-upgrade、一键升级迁移、旧项目升级、知识库模板升级。注意：不要把单独的 flow2spec init 称作「升级命令」；**V1/V2+ 为技能内分流代号，不等于 npm 包主版本号**。
- `f2s-req-clarify`：针对 PRD/需求反问直到清楚，再可用 f2s-req-tech 出技术方案；触发：需求澄清、PRD 澄清
- `f2s-req-plan`：根据技术方案/需求描述/变更描述规划并实现任务；始终按 f2s-task 维护 .task/；支持子 agent 并行实现；触发：f2s-req-plan、创建任务、任务规划、我需要任务清单
- `f2s-req-tech`：根据澄清后的需求基于项目知识库/Skills/Rules 生成技术方案文档；触发：生成技术方案、技术方案、f2s-req-tech
