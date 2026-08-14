---
name: f2s-kb-upgrade
description: 知识库模板升级技能（仅指本 SKILL）：**流程分流 V1** 须先 f2s-kb-migrate 再在流程内代跑 flow2spec init；**现行库（流程代号 V2+，含已用 .Knowledge 的 Flow2Spec npm v3.x 等项目）** 则代跑 init 以对齐 manifest-routing + matchers 分片（包内 `manifest-matchers.json` 仅作 init 合并种子，不落盘 .Knowledge）。触发：f2s-kb-upgrade、一键升级迁移、旧项目升级、知识库模板升级。注意：不要把单独的 flow2spec init 称作「升级命令」；**V1/V2+ 为技能内分流代号，不等于 npm 包主版本号**。
---

> 执行口径：本技能用于「代替用户跑 shell」完成 **按本 SKILL 定义的** Flow2Spec **模板与配置根对齐**；其中一步会代跑 **`flow2spec init`**，但 **`init` 不是「升级命令」**，**升级命令 / 知识库升级** 仅指 **`f2s-kb-upgrade` 本技能全流程**。

# f2s-kb-upgrade（知识库模板升级技能）

**术语（必须）**：**「升级」「升级命令」「知识库升级」** 仅指按本文件 **`f2s-kb-upgrade`** 执行的完整技能流程。**`flow2spec init`** 是 CLI **初始化/落盘**命令；本技能 **步骤 2** 会代跑它，**禁止**把用户单独执行的 `init` 或 CLI 帮助里的 `init` 表述为「升级命令」。

## 边界（避免误区）

- **`flow2spec init` 不写业务知识**：不替代 `f2s-kb-add`、`f2s-kb-fix`、`f2s-kb-feat`、`f2s-kb-sync`、`f2s-kb-build` 等对 `stock-docs` / `req-docs` / `topics` 正文与业务向路由词条的维护。
- 本技能跑通的是 **包版本下的目录、模板占位、路由结构对齐**；用户若说「把新能力写进知识库」，应引导 **`f2s-kb-sync` / `f2s-kb-add`** 等，而非仅 `f2s-kb-upgrade`。
- 本技能负责存量 `topicMetadata` 审计：`primary` / `tags` 仅用于治理、审计、盘点和阅读预期，不参与路由命中或执行强制性；执行强制性仍以 `AGENTS.md`、rules、skills 与 topic 正文为准。

## 包侧发版纪律（`projectRev` 必须正确 bump）

**字段位置**：`templates/{zh-CN,en-US}/knowledge/manifest-routing.json` 的根级整数字段 `projectRev`（起始 `1`）。

**字段写入语义（必读）**：
- **包侧**：维护者按下文规则手动 bump（包模板自身的 `projectRev` 永远是最新值）。
- **项目侧**（落盘到 `.Knowledge/manifest-routing.json`）：
  - **首次 init**：项目 `.Knowledge/manifest-routing.json` 不存在 → `init` 把模板原值落盘，等同首次落地即基线对齐。
  - **后续 init**：项目 `.Knowledge/manifest-routing.json` 已存在 → `init` **不再覆盖该字段**（保留项目原值）；该字段只由本技能完整流程末尾 3b 写入（见步骤 3b「回写 `projectRev`」）。
  - 这使「项目侧 `projectRev`」语义清晰：**「本项目已基线对齐到的包模板修订号」**，而非"上次 init 时碰到的"。

**必须 bump 的修改**（每次发版至少 `+1`）：
- 包模板 `templates/<locale>/knowledge/topics/<topic>.md` 任一文件的**正文**修改、新增、删除或改名；
- 包模板 `templates/<locale>/knowledge/matchers/<id>.json` 的 `includeAny` 词条、`id` 或新增 / 删除 matcher 文件；
- 包模板 `templates/<locale>/knowledge/manifest-routing.json` 的 `topicPaths` / `taskToTopicRules` / `topicDependencies` / `fallbackTopic` / `topicMetadata` 任一段修改；
- 包模板 `templates/<locale>/knowledge/index.md` 「主题一览」节或包级章节修改。

**不需要 bump 的修改**：
- 包源码（`lib/`、`cli.js`、`scripts/`）、`AGENTS.md`、`README*` 文档；
- `templates/<locale>/flow2spec.config.json` 默认值；
- `templates/<locale>/rules/*` / `templates/<locale>/skills/*` 仅规则与技能正文修改（这些与主题层无关，无需触发完整流程）。

**判定准则一句话**：模板里 `knowledge/` 目录下 topic / matcher / manifest / index 任一**主题层产物**变了 → 必 bump；否则不动。漏 bump 会让用户的 `f2s-kb-upgrade` 跑快速路径，错过包带来的主题变更。

## 编排（主 / 子 agent）

- 两字段（`subAgent` / `switchAgentVerification`）语义以统一入口为唯一事实源：**Cursor/Claude** 读配置根 `rules/f2s-flow2spec-unified-entry.*`；**Codex** 读 `.codex/topics/f2s-flow2spec-unified-entry.md`（与上同源，`flow2spec init` 镜像）。本节不复述。
- **子 agent 职责**（仅当 `subAgent=true`）：代跑 `flow2spec init` 等 shell 命令；仅承接命令执行，不承担知识库正文落盘。
- **主必控**（主 agent 不可下放）：
  1. **版本分流**：**V1** 先走 `f2s-kb-migrate` 再进入本技能；**现行库（V2+）** 直接进入 `init` 流程（含 Flow2Spec **npm v3.x** 等，只要已满足步骤 0 中「现行库」条件，均走此支，**勿**因主版本为 3 再单独设一套流程）。
  2. **`init` 后重读**：从磁盘重读 `f2s-kb-upgrade/SKILL.md`，对比标识是否变化。
  3. **整技能重跑**：SKILL 有变化时，按新版字面从头再跑一轮，直至连续两轮无变化。
  4. **步骤 3b 融合**：`.Knowledge/index.md` 的维护区保留 + 包版对齐融合由主 agent 执行。
  5. **校验摘要**：校验结论与输出摘要由主 agent 汇总。
- **写权硬约束**：`.Knowledge/index.md` **只由主 agent 落盘**，子 agent **不得触碰**；`manifest-routing.json` 同属主落盘。
- 本 SKILL 不绑定交叉校验；落盘侧自验。

## 与 `f2s-kb-migrate` 为何并存

| 技能 | 解决的问题 |
| --- | --- |
| **`f2s-kb-migrate`** | **结构搬家**：`docs-index.md` / `index-doc.md`、`rules/main.md(c)`、业务 `skills/`、散落 `stock-docs`/`req-docs` → **迁入 `.Knowledge`**，落盘 `migration-report.md`、删除清单需用户确认。不代跑 npm 包升级。 |
| **本技能 `f2s-kb-upgrade`** | **包与模板对齐**：代跑 **`flow2spec init`**，合并 **`manifest-routing.json`** 与 **`matchers/*.json`**，刷新各 agent **`rules`/`skills`**（或 Codex **`AGENTS.md`**）；`init` 另将当前语言的 **`index.md` → `.Knowledge/template/index.template.md`** 作对照快照，**`.Knowledge/index.md`** 由步骤 3b **diff 对齐**，init **不**自动改其正文。 |

- **旧项目一键闭环**：**先 `f2s-kb-migrate`** → **再本技能**（`init`）。禁止仅用 `init` 代替完整迁移。
- **已是新版 `.Knowledge` 的项目**：**只跑本技能**，勿重复 migrate。

**为何每个已配置客户端目录下都有一份同名 `SKILL.md`？**
各客户端只加载**自身配置根**下的 `skills/`。`flow2spec init` 会向所选 agent 目录**同步落盘**当前语言对应的技能内容。

## 目标

当用户说「帮我升级知识库模板 / 跑 f2s-kb-upgrade / 同步最新 Flow2Spec」时，Agent **按本技能 `f2s-kb-upgrade` 全文流程执行**（含代跑 `flow2spec init`、清理、校验、摘要）；**勿**把仅执行 `init` 等同于完成本技能。

## 默认行为

1. 本技能步骤 2 代跑 **`flow2spec init`** 时，默认 **增量落盘**（不带 `--reset-knowledge`）。
2. 仅当用户明确要求「覆盖重置」时，才在 `init` 末尾追加 `--reset-knowledge`。
3. 优先写入用户指定的 agent；未指定时使用包的默认客户端选择。

## init 与技能自更新（必须）

本技能在 **步骤 2** 会执行 **`flow2spec init`**；`init` 会把当前语言对应的技能内容同步到各 agent **配置根**，因此 **`init` 成功结束后**，本仓库里的 **`skills/f2s-kb-upgrade/SKILL.md`** **可能被新版本覆盖**，与当前对话里已缓存的旧说明不一致。

**闭环（防旧条令）**：

1. **`init` 前**（推荐）：记下当前配置根内 **`skills/f2s-kb-upgrade/SKILL.md`** 的标识（如 `mtime`、文件大小或正文 hash）。  
2. **`init` 成功结束后**：**重新读取磁盘上** 该 **`SKILL.md` 全文**（Cursor：`.cursor/skills/f2s-kb-upgrade/SKILL.md`；Claude：`.claude/skills/...`；Codex：`.codex/skills/...`，与本次 `init` 写入的 agent 一致）。  
3. **若相对步骤 1 有变化**（或刚升级 Flow2Spec 包、无法确认是否无变）：**必须以最新 SKILL 为准**，按新版字面**重跑评估与落盘**（即从下文「步骤 2c」开始：重新读 `projectRev` / `pkgRev`、按新版判定表决定快速路径或完整流程、跑步骤 3 / 3a / 3b / 4 / 5）。**重跑时不再次执行 `flow2spec init`**——本轮已在步骤 2 跑过；再 init 不会带来新信息，反而会让 SKILL 自更新闭环陷入循环。可循环至**连续两轮**读到的 SKILL **无变化**，或用户明确要求停止。  
4. **若无变化**：继续执行步骤 2c 及以后。

> **快速路径例外**：若步骤 2c 判定为「快速路径」（`projectRev == pkgRev`，主题层未变），即便 SKILL.md 字面有变化，也**不要求**按新版重跑——重跑后仍会再次判定为快速路径，徒增开销。仅在「完整流程」分支下保留闭环。

> 口径：**本技能步骤 2 执行 `init` 后** → 再读最新 `f2s-kb-upgrade/SKILL.md` → 有变 + 走完整流程时才**按新版字面从步骤 2c 起重跑**（**不再次 init**）；不要仅凭会话记忆执行 **本技能**。

## 强制流程

### 步骤 -1：全局 flow2spec 版本预检（必须，先于一切，主 agent 前台探测）

**目的**：让「能用全局 `flow2spec` 就用全局」，只在**没装**或**版本过旧**时才动手升级；已装且已是 latest 时**完全跳过**升级动作，同时决定步骤 2 命令的**默认形态**（用 `flow2spec init` 还是 `npx @latest init`）。

**动作**：主 agent 在进入步骤 0 **之前**，**顺序、前台**执行以下 3 条探测（都是纯查询，无副作用，秒级返回；无需拆子 agent）：

```bash
# 1. 探测本机全局是否装了 flow2spec
flow2spec --version 2>/dev/null || echo __F2S_NOT_INSTALLED__
# 2. 查询 npm 上 latest 版本号（网络受限时可能失败，允许失败）
npm view @double-coding/flow2spec version 2>/dev/null || echo __F2S_NPM_UNREACHABLE__
# 3. （备用）若第 1 步返回 __F2S_NOT_INSTALLED__，用来确认 npx 可用
command -v npx >/dev/null 2>&1 && echo __NPX_OK__ || echo __NPX_MISSING__
```

**判定 3 分支**（按结果选一条，写入本轮上下文并影响步骤 2 与步骤 5 摘要）：

| 情况 | 判定条件 | 行动 | 步骤 2 命令默认形态 |
| --- | --- | --- | --- |
| **A. 已装且是 latest** | 第 1 步返回版本号 `V`，第 2 步返回版本号 `L`，且 `V === L` | **完全跳过升级**，本轮不派子 agent、不跑 `npm i -g` | **`flow2spec init <agents...>`**（用全局） |
| **B. 已装但落后** | 第 1 步返回版本号 `V`，第 2 步返回版本号 `L`，且 `V !== L`（`V < L` 或 semver 不等） | **派独立子 agent 后台跑** `npm i -g @double-coding/flow2spec@latest`（fire-and-forget，不等待，不阻塞主流程）；本轮步骤 2 仍用 `npx @latest` 保证本次拿到 latest 模板 | **`npx @double-coding/flow2spec@latest init <agents...>`** |
| **C. 未装 or 版本无法确认** | 第 1 步命中 `__F2S_NOT_INSTALLED__`，或第 2 步命中 `__F2S_NPM_UNREACHABLE__` 且第 1 步也未拿到版本号 | 若 A 情况「已装 latest」不成立且**未装**：派独立子 agent 后台跑 `npm i -g ...@latest`（同 B）；若第 2 步失败但第 1 步已装某版本：视作 B 且无法比对 latest，**不派**升级、仅提示「latest 未知，保守用 npx」 | **`npx @double-coding/flow2spec@latest init <agents...>`** |

**编排（必须）**：

- **A 分支**：主 agent 直接跳过所有升级动作，**不派**子 agent；本轮步骤 2 命令首选 `flow2spec init`。
- **B / C 分支**：若确需升级（未装或版本落后），派**独立子 agent** fire-and-forget 执行 `npm i -g @double-coding/flow2spec@latest`，**不等待完成**、**不阻塞**主流程；成败均不进入 SKILL 结论。该派子**强制**执行，**不受** `flow2spec.config.json.subAgent` 字段约束（全局 npm 装包不属业务拆分范畴）。
- **写权**：子 agent 仅执行该 shell，**不**触碰 `.Knowledge` / `manifest-routing.json` / `index.md` 等任何项目文件；写权硬约束不变。
- **探测失败兜底**：若 3 条探测全部失败（无 shell 权限、极端受限环境），按 C 分支处理并用 `npx @latest`；此时也可以直接放弃步骤 -1、把升级留给 `cli.js` 的 `maybeAutoUpdateGlobalInstall()` 收尾兜底。

**与 cli.js 的关系**：

- `cli.js` 内 `maybeAutoUpdateGlobalInstall()` 是 `init` 收尾兜底逻辑，**与本步不冲突**：本步在前台 init 之前完成探测/派工，cli 那段在 init 收尾时再兜一次；两次都成功就是 no-op，第一次失败第二次还能补救。

### 步骤 0：版本判定与分流（必须，先于 init）

> **命名说明**：下文 **「V1」「现行库（V2+）」** 为本技能**流程分流代号**。**npm 包为 v3.x、v4.x…** 且仓库**已**是 `.Knowledge` + `manifest-routing` 形态时，仍走 **「现行库（V2+）」** 支（仅 `init` 对齐），**不要**把 npm 主版本数字当成这里的「V2」字面限制。

**V1 — 旧版知识组织（须先迁移再 init）**  
命中**任一**强信号则按 V1：

- 配置根仍有 **`docs-index.md` 或 `index-doc.md`**，且主要仍经 **`rules/main.md` / `rules/main.mdc`** 收口；或  
- 业务 **`stock-docs` / `req-docs` 与规则、业务 skills** 仍以配置根旧树为主，**未**稳定落在 `.Knowledge`。

**动作**：先按 **`f2s-kb-migrate`** 全流程执行（含 `migration-report`、删除清单确认），**再**进入步骤 1–5 执行 `flow2spec init`。

**现行库（V2+）— 已上 `.Knowledge` + 新版路由（仅包级 / 形态对齐）**  
同时满足：

- 存在 **`.Knowledge/manifest-routing.json`**，且 **`topicPaths` / `taskToTopicRules`** 可用；  
- 业务文档已以 **`.Knowledge/stock-docs`、`req-docs`、`topics`** 为主（可与 V1 刚结束状态衔接）。

**历史口径**：若仓库里仍有遗留 **单文件 `manifest.json`**，**不得**再当作机读事实源；机读以 **`manifest-routing.json` + `matcherPath` 指向的 `matchers/*.json`** 为准，`init` 负责与模板**合并 / 回填分片**。

**动作**：直接进入步骤 1–5；**无需** migrate，除非用户明确要求重做迁移。

### 步骤 1：确认本技能内 `init` 模式（必须）

- 若用户未明确「覆盖重置」，本技能步骤 2 默认 **增量 `init`**。
- 若用户提到「全部按模板覆盖/重置」，二次确认后再使用 `--reset-knowledge`。
- **locale 规则**：普通升级沿用项目 `flow2spec.config.json.locale`；字段不存在时按 `zh-CN` 补齐。禁止在本技能中顺手切换语言；只有用户显式要求 `--locale en-US` / `--locale zh-CN` 时才传入对应参数。

### 步骤 2：执行命令（代用户跑 shell）

**步骤 2 开始前**：读取项目侧 **`.Knowledge/manifest-routing.json`** 的 `projectRev` 字段（**字段不存在则记为 `null`**），将该值记为 **`projectRev`**。`projectRev` 表示**「本项目已基线对齐到的包模板修订号」**（由本技能完整流程跑完步骤 3 / 3a / 3b 后写入；首次 init 时 init 会以模板值落盘）；**`init` 在 manifest 已存在时不再覆盖该字段**，因此 `projectRev` 反映的是本项目最近一次完整流程对齐到的版本，而非"上次 init 时包带过来的"。`projectRev` 将用于步骤 2c 与 `pkgRev` 对比。

在目标项目根目录执行以下命令（**按步骤 -1 的分支结论选默认形态**）：

1. **步骤 -1 判定为 A（已装且是 latest）**：直接用全局 CLI（**首选**）：
   - `flow2spec init <agents...>`
2. **步骤 -1 判定为 B/C（未装 / 落后 / latest 未知）**：拉 npm latest 跑（**保证本次拿到最新模板**）：
   - `npx @double-coding/flow2spec@latest init <agents...>`
3. 覆盖重置时：
   - 在上述命令末尾追加 `--reset-knowledge`
4. 用户显式要求切换模板语言时：
   - 在上述命令末尾追加 `--locale <zh-CN|en-US>`
5. **手动 override**：若用户明确说「就用全局」或「就用 npx」，按用户意愿选定；不再走步骤 -1 分支自动匹配。

> `<agents...>` 示例：`cursor claude codex`。

> **辅助命令（用户可自查）**：`flow2spec --version` 看当前全局版本；`flow2spec update` 触发 CLI 内置的自更新。这两条**不**替代本 SKILL 的完整流程——它们只是「让全局 CLI 保鲜」，主题层对齐仍须走本 SKILL 步骤 2 及以后。

**步骤 2 完成后**：立刻执行上文 **「init 与技能自更新」**：重读 **`skills/f2s-kb-upgrade/SKILL.md`**；若有更新则**按新版字面从步骤 2c 起重跑**（**不再次 init**；避免用旧版 SKILL 做后续校验）。

### 步骤 2c：主题层变更判定（必须，决定走快速路径或完整流程）

**目的**：包升级若**未带主题层变更**（topic / matcher / index 模板正文未改），跳过步骤 3 / 3a / 3b 与"整技能重跑"闭环，直接进入步骤 4 轻量校验。仅当包侧明确 bump 了 `projectRev` 才走完整流程。

**判定方法**：

1. **`init` 跑完后**，从**项目侧 manifest**取 `pkgRev`。**口径**：直接 `Read` 项目根 **`.Knowledge/manifest-routing.json`** 的 **`pkgRev`** 顶层字段。该字段由本次 `init` 写入，记录"本次 init 用的包模板 projectRev"——是包侧最新值，与同文件里的 `projectRev`（= `projectRev`，"本项目已基线对齐到的包模板修订号"）形成「包侧 / 项目侧」对照，无需新增文件。

   - 字段存在且为整数 → `pkgRev = <整数>`；
   - 字段缺失或非整数 → `pkgRev = null`（包模板自身未声明 `projectRev`）；
   - 项目侧 manifest 文件本身缺失 → 不在本步处理，应在步骤 2 / 步骤 1 自检阶段就报错。

2. 比对 `projectRev`（步骤 2 开始前记录）与 `pkgRev`：

| `projectRev` | `pkgRev` | 判定 | 后续 |
| --- | --- | --- | --- |
| 任意值 | `null` | **完整流程**（包未声明字段，走旧逻辑兜底） | 走完整步骤 3 / 3a / 3b |
| `null` | 任意整数 | **完整流程**（项目首次接入或老项目升级，需走完整流程做基线对齐） | 走完整步骤 3 / 3a / 3b |
| 整数 X | 整数 X（相等） | **快速路径**（主题层未变） | **跳过** 步骤 3 / 3a / 3b 及"整技能重跑"闭环，**直接进入步骤 4** |
| 整数 X | 整数 Y（不等） | **完整流程**（包带来主题层变更） | 走完整步骤 3 / 3a / 3b |

3. **`--reset-knowledge` 例外**：用户显式 reset 时，**强制走完整流程**，忽略本步判定（reset 必须走完整 3b 重建）。

4. **本步判定结论必须写入步骤 5 摘要**，形如「`projectRev`：项目 `X` vs 包 `Y` → 快速路径 / 完整流程 / 字段缺失走兜底」。

> **盲点声明**：本判定只看 `projectRev`，**信任包侧维护者在改了 topic / matcher 模板正文时按规矩 bump**。若包侧未守纪律，可能漏判；用户主观觉得不对时可显式追加 `--full` 语义（口头要求"完整流程"即可），技能侧应忽略快速路径直接走完整流程。

### 步骤 3：旧主题模板清理与引用修复（若存在则必须执行）

> **快速路径跳过**：若步骤 2c 判定为「快速路径」，**本步骤整段跳过**，直接进入步骤 4。仅在「完整流程」时执行以下内容。

**本技能步骤 2** `flow2spec init` 成功后，先执行「旧文件清理 + 引用修复」：

> **skill 目录自动对齐**：`flow2spec init` 现已自动删除配置根 `skills/` 中当前版本不再提供的旧目录（重命名/删除的 skill 如 `f2s-ctx-build`、`f2s-doc-add`、`f2s-rule-capture`、`stock-docs-vs-req-docs` 等），**无需 Agent 手动清理**。

1. 清理旧命名主题文件（仅在文件存在时删除，均为无 `f2s-` 前缀的旧版遗留）：
   - `.Knowledge/topics/flow2spec-architecture.md`
   - `.Knowledge/topics/implement-tech-design.md`
2. 修复引用（仅在文件存在时更新；**`.Knowledge/index.md` 正文不由 init 改写**，见步骤 3b）：
   - `.Knowledge/index.md`（按需人工或技能侧改路径/段落）
   - `.Knowledge/manifest-routing.json`
3. 引用更新目标（确认使用新名）：
   - `.Knowledge/topics/f2s-flow2spec-architecture.md`
   - `.Knowledge/topics/f2s-implement-tech-design.md`
   - `.Knowledge/topics/f2s-stock-docs-vs-req-docs.md`

> 口径：只清理”旧命名主题文件”，不删除带 `f2s-` 前缀的现行主题文件。

### 步骤 3a：`topicMetadata` 存量审计（必须执行）

> **快速路径跳过**：若步骤 2c 判定为「快速路径」，**本步骤整段跳过**。仅在「完整流程」时执行。

1. 读取 `.Knowledge/manifest-routing.json`，以 `topicPaths` 为主题全集。
2. 校验 `topicMetadata`：key 必须存在于 `topicPaths`；`primary` 仅允许 `feature` / `module` / `config` / `policy`；`tags` 若存在须为数组，元素取值同 `primary` 且不得与 `primary` 重复；`confidence` 仅允许 `manual` / `inferred`。
3. 对 `topicPaths` 中缺少 metadata 的主题做分类分析：**必须 Read 对应 `.Knowledge/topics/<id>.md` 正文**，禁止仅凭 topicId 名称推断。证据明确则写入 `inferred`；证据不足时**不写 metadata**，但须在摘要中列出推断方向与依据（如「建议 policy，正文含多处强制约束」），供用户确认后手动补写 `manual`。
4. 分类判断以 `f2s-topic-authoring` 准则第 3 节为准，Agent 基于 topic 正文判断主要性质，写 `primary`；同时覆盖多个性质时其余写 `tags`（可选）。
5. 禁止因为补分类创建、重命名或拆分 topic。
6. **主题粒度审计**（不阻断升级，仅列入摘要）：逐项检查，命中任一信号时在步骤 5 摘要中列为「建议拆分」：
   - 对应 stock-doc 超过 **300–500 行**；
   - `includeAny` 词数超过 **12 个**；
   - topic 正文包含超过 **3 个不相干职责域**的二级标题；
   - 该 topic 同时被多种不相干任务类型频繁命中（可从 `taskToTopicRules` 和 matcher 词宽度判断）。
7. **旧 topic frontmatter 自动补齐**：完整流程中必须由 agent 自行执行 `flow2spec kb build --fix-topics`（或等价内部能力），为缺少 frontmatter / `revision` 的存量 topic 补 `id`、`revision`、`summary`，并按 `manifest-routing.json` 补 `dependsOn` / `primary` / `confidence` / `tags`。随后执行 `flow2spec kb check --strict`；若 strict 失败，停止并在摘要中列出具体 topic / reason。不得要求用户手动逐个 topic 添加头部。

### 步骤 3b：`index.md` 融合与 `template/index.template.md`（必须执行）

> **快速路径跳过**：若步骤 2c 判定为「快速路径」，**本步骤整段跳过**（包模板的「主题一览」节未变 → 现有 `index.md` 仍是对的）。仅在「完整流程」时执行。

> **范围**：本条「融合」**仅在本技能内由 Agent 落盘 `.Knowledge/index.md`**；**不要求、也不假设**修改 Flow2Spec 包内 **`cli.js` / `lib/init.js`** 等 JS。`init` 行为仍以仓库现行为准（仅复制快照等）。

**`flow2spec init` 在本流程中的角色**：把当前语言的 `index.md` 快照复制到 **`.Knowledge/template/index.template.md`**，作为**包版外壳对照**；**不**替代本步骤对 **`index.md`** 的融合书写。

#### 融合规则（必须遵守）

0. **写权归属**：本步骤的 `.Knowledge/index.md` 融合恒由主 agent 执行并落盘；子 agent 不得直接写入（写权硬约束）。
1. **对照源**  
   - **包版全文**：**`.Knowledge/template/index.template.md`**。
   - **项目现状**：**`.Knowledge/index.md`**。

2. **项目自身维护区（锚点：`.Knowledge/template/index.template.md` 中的 `## 主题一览`）**
   - 以 `.Knowledge/template/index.template.md` 为参照：**从二级标题 `## 主题一览` 起**，**直至本节结束**：即到 **紧挨在 `## 命中与执行`（含括号说明）之前的那个 `---` 之前**的整块内容（含「主题一览」下的表格、节内说明段落等）。
   - 该整块 **必须保留来自当前项目 `.Knowledge/index.md` 的正文**（由业务与 **f2s-*** 维护）；**禁止**用包模板同一段落**整体替换**覆盖（避免丢失业务主题行与摘要列）。  
   - **允许**在该块内做**最小必要修补**：例如为新增的 `topicPaths` 主题**补行**、按 **`manifest-routing.json` 的 `topicPaths`** 改正「路径」列、与快照对比后补上新增的表格列说明——仍以保留项目已有行为主。

3. **必须与包模板一致的部分**  
   - **上述维护区之外**的所有内容（含 **`## 主题一览` 之前**从文件开头到该节前、以及 **`## 命中与执行` 及之后**直到文件结尾）：须与 **`.Knowledge/template/index.template.md`** 中对应段落 **一致**（以包版为准；diff 后以模板覆盖项目侧旧文）。

4. **产出**  
   - 将融合后的完整 **`index.md`** 写回 **`.Knowledge/index.md`**。  
   - **diff** 结论与是否改动写入步骤 5 摘要。

5. **与 `--reset-knowledge` 的关系**  
   - 若用户已 `reset`，`.Knowledge/index.md` 可能被模板整文件覆盖，仍须按本条 **2** 从备份或版本控制恢复「主题一览」块后再与包外壳做 **3** 的合并（若仓库无备份，则按 `topicPaths` + 快照**重建**主题表并让用户确认）。

#### 完整流程末尾：回写 `projectRev`（必须）

完整流程跑完上述步骤 3 / 3a / 3b 之后（**仅完整流程，快速路径不执行**），由主 agent 把项目侧 **`.Knowledge/manifest-routing.json`** 的 `projectRev` 字段**改写为 `pkgRev`**（步骤 2c 取到的整数；若 `pkgRev` 为 `null` 则**不动**该字段）：

- 这是 `projectRev` 的**唯一**写入路径（除首次 init 模板默写之外）；
- 下一次 `f2s-kb-upgrade` 据此判定 `projectRev == pkgRev` 走快速路径，避免重复跑 3 / 3a / 3b；
- 写入与 `manifest-routing.json` 其余字段同属主 agent 写权（写权硬约束）。

### 步骤 4：校验本技能执行结果（必须）

至少校验：

1. 步骤 2 的 `flow2spec init` 是否成功退出（exit code = 0）。
2. init 输出是否包含 **路由清单与 `.Knowledge` 的结论**（已对齐/已最新/reset 覆盖等），以及 **`index.template.md` 已复制** 一行（若包内缺 `index.md` 则无此行）。
3. `manifest-routing` 与各 `matcherPath` 分片是否可解析，且 `topicPaths` / `matcherId` 引用均有效。
4. 存在 **`.Knowledge/template/index.template.md`**；已按步骤 **3b** 完成 **`index.md` 融合**（维护区保留 + 其余与包版一致）或写明待用户处理原因。
5. 配置根产物是否存在：
   - Cursor/Claude：`rules/`、`skills/`
   - Codex：`.codex/AGENTS.md`、`skills/`
6. 本技能成功完成后，删除 `.Knowledge/update-check.json`（若存在），让下一次新会话重新检测并清除旧升级提示；若删除失败，在步骤 5 摘要中写明。

### 步骤 5：输出结果摘要（必须）

输出以下信息：

- **步骤 -1 全局版本预检**：分支结论（`A 已装且是 latest（跳过升级） / B 已装但落后（已派子 agent 后台升级） / C 未装或 latest 未知（已派或提示）`）+ 当前全局版本 + npm latest 版本（若拿到）
- 执行命令（含 agent 与是否 reset）
- 是否成功
- **`projectRev` 判定**：`projectRev` X vs `pkgRev` Y → 快速路径 / 完整流程 / 字段缺失走兜底（步骤 2c）
- 旧主题模板清理结论（删了哪些 / 哪些本就不存在；**快速路径下：未执行**）
- `index/manifest` 引用修复结论（**快速路径下：未执行**）
- **index**：`index.template.md` 是否已生成；**`index.md` 融合**是否完成（锚点 **18–19「主题一览」节**保留、其余与包版一致）及 `topicPaths` / diff 结论（步骤 3b；**快速路径下：未执行**）
- **`projectRev` 回写**：完整流程跑完后是否已把项目侧 `projectRev` 改写为 `pkgRev`（步骤 3b 末「回写 `projectRev`」；**快速路径下：未执行**）
- **SKILL 自更新**：`init` 后是否重读 `f2s-kb-upgrade/SKILL.md`；是否因文件变化**按新版字面从步骤 2c 起重跑**及轮次（**不再次 init**；见「init 与技能自更新」；**快速路径下：跳过该闭环**）
- manifest / matchers 对齐结论（随 init 输出）
- 关键文件校验结论
- `.Knowledge/update-check.json` 清理结论（已删除 / 不存在 / 删除失败）
- 如失败，给出下一步可执行修复建议

## 输出摘要模板（建议）

```markdown
## f2s-kb-upgrade 执行结果

- **步骤 -1 全局版本预检**：`A 已装且是 latest（跳过升级） / B 已装但落后（已派子 agent 后台升级 npm i -g） / C 未装或 latest 未知（已派 / 保守用 npx）`；当前版本=`<V>`，latest=`<L 或 未知>`
- 本技能内代跑命令：`<实际执行的 flow2spec init ... 或 npx @latest init ...>`
- init 模式：`增量` / `覆盖重置（--reset-knowledge）`
- 执行结果：`成功` / `失败`
- **主题层判定**：`projectRev=<X>` vs `pkgRev=<Y>` → `快速路径（已跳过 3/3a/3b）` / `完整流程` / `字段缺失走兜底`

### 核心校验
- 旧主题文件：`已清理` / `无需清理` / `快速路径下未执行`
- 引用修复：`已更新` / `已一致` / `快速路径下未执行`
- **index（快照 + 融合）**：`快照已复制` / `index.md 已融合` / `快速路径下未执行` / `待处理（见备注）`
- **topicMetadata（存量审计）**：`已补齐` / `待用户确认` / `快速路径下未执行`；列出新增 / 修正 / 删除的 topicId
- **topic frontmatter**：`已自动补齐 N 个` / `已完整无需补齐` / `strict 校验失败` / `快速路径下未执行`
- **f2s-kb-upgrade SKILL**：`init 后无变化` / `已按新版从 2c 起重跑 N 轮（不再次 init）` / `快速路径下跳过该闭环` / `待确认`
- **`projectRev` 回写**：`已写入项目 manifest（值=pkgRev）` / `快速路径下未执行` / `pkgRev=null 未动`
- manifest-routing / matchers 分片：`已与模板对齐` / `已是最新` / `reset 覆盖`
- topics.path：`全部存在` / `存在缺失（见下）`
- agent 产物：`通过` / `异常（见下）`
- update-check 缓存：`已删除` / `不存在` / `删除失败`

### 备注
- <失败原因或后续建议>
```

## 约束

- 不把“请用户自行运行命令”作为默认方案；优先由 Agent 直接执行。
- 未经明确同意，不执行 `--reset-knowledge`。
- 不修改业务代码；仅按 **本技能 `f2s-kb-upgrade`** 流程与结果做校验。
- 步骤 3b `.Knowledge/index.md` 融合与 `manifest-routing.json` 均恒由主 agent 落盘（写权硬约束）；子 agent 仅可代跑 shell 命令。

## 完成后自检

1. 是否已做 **步骤 -1**：在进入步骤 0 前**已顺序前台执行 3 条探测**（`flow2spec --version` / `npm view ... version` / `npx` 可用性），并按 A/B/C 分支得出结论；仅在 B/C 时才**派独立子 agent**后台跑 `npm i -g @double-coding/flow2spec@latest`（不等待），A 分支**未派**任何升级动作；步骤 2 命令默认形态是否随分支选定（A→`flow2spec init`，B/C→`npx @latest init`）；摘要中已写清分支与版本对比。
2. 是否已做 **步骤 0**：V1 未跳过 migrate、**现行库（V2+）** 未误跑 migrate。
3. 是否在 **步骤 2 开始前** 记录了项目侧 `projectRev`（`projectRev`），并在 **步骤 2 的 `init` 之后** 重读 `pkgRev`、执行 **步骤 2c** 判定。
4. 是否在 **步骤 2 的 `init` 之后**重读过 **`f2s-kb-upgrade/SKILL.md`**：完整流程下有变化必须**按新版字面从步骤 2c 起重跑**（**不再次 init**）；快速路径下可跳过该闭环（见「init 与技能自更新」「快速路径例外」）。
5. 是否已实际执行 shell 命令（而非只给建议）。
6. 是否明确标注增量 or reset 模式。
7. **完整流程时**：是否已处理旧主题文件清理与 `index/manifest` 引用修复（步骤 3）。
8. **完整流程时**：是否已执行 **步骤 3a**：审计 `topicMetadata`，确保无孤儿 key / 非法 primary / 非法 confidence；缺失旧主题已按证据补 `inferred` 或列为待确认。
9. **完整流程时**：是否已执行 `flow2spec kb build --fix-topics` 或等价内部能力，并随后执行 `flow2spec kb check --strict`，确保存量 topic 已具备 `revision`。
10. **完整流程时**：是否已执行 **步骤 3b**：**融合** `index.md`（**主题一览**节起至命中与执行前为项目维护区，其余同包版），并核对 `topicPaths`；**完整流程末尾**是否已**回写** 项目侧 `projectRev = pkgRev`（`pkgRev=null` 则保留原值）。
11. **快速路径时**：步骤 3 / 3a / 3b 是否真的跳过（未做无关扫描），摘要中明确标注「快速路径下未执行」。
12. 是否输出了 manifest 与关键路径校验结果。
13. 若失败，是否给出下一步具体命令建议。
14. 步骤 3b 的 `index.md` 融合由主 agent 完成并落盘，无子 agent 越权写入（仅在完整流程时适用）。
15. 成功升级后是否删除 `.Knowledge/update-check.json`，避免当天新会话继续提示旧升级信息。
