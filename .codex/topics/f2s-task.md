# f2s-task（变更追踪规则）

## 生效条件

各技能按自身子项判断：

- `f2s-kb-feat`：读 `changeTracking.feat`
- `f2s-kb-fix`：读 `changeTracking.fix`
- `f2s-implement-tech-design`：读 `changeTracking.implement`

若对应子项为 `false` 或字段不存在，**该技能内的变更追踪步骤不执行**，直接跳过。

> `f2s-req-plan` 命令不受此条件约束，始终执行（见 `skills/f2s-req-plan/SKILL.md`）。

## 多人协作与任务根 `TASK_ROOT`（必须先解析）

进入本规则任何「读/写 `.task`」步骤前，**必须** `Read("flow2spec.config.json")`，并解析 **`TASK_ROOT`**（本会话内固定，禁止中途改 id）：

| 条件 | `TASK_ROOT` | `developerId` 来源 |
| --- | --- | --- |
| `collaboration.enabled === false` | `.task` | legacy（强制单人根） |
| `collaboration.developerId` 非空（trim 后） | `.task/<sanitize(id)>` | **config** |
| 否则能读到 `git config user.email` | `.task/<sanitize(email@前)>` | **git-email** |
| 否则能读到 `git config user.name` | `.task/<sanitize(name)>` | **git-name** |
| 仍无 | `.task` | **legacy**（单人旧布局；须在回复中提示：建议配置 `collaboration.developerId`） |

**sanitize**：小写；若含 `@` 只取本地部分；非 `[a-z0-9]` 收成 `-`；去首尾 `-`；长度 1–64，否则视为无 id。

**路径一律用 `TASK_ROOT` 前缀**（下面凡写 `TASK_ROOT/...` 均指解析结果）：

- 索引：`TASK_ROOT/todo.json`
- 进行中：`TASK_ROOT/active/<task-name>/`
- 已完成：`TASK_ROOT/completed/<YYYYMMDD>-<task-name>/`

**防串戏（硬约束）**：

1. **只**读写当前会话的 `TASK_ROOT`；**禁止**为续作/匹配去遍历 `.task/*/todo.json` 或其他 developer 目录。
2. keywords 匹配范围 **仅** 当前 `TASK_ROOT/todo.json` 内条目。
3. 创建任务时 `todo.json` 的 `folder` 必须写成当前 `TASK_ROOT/active/<task-name>/`（posix 相对路径）。
4. 可选在任务开始时向用户回显一行：`[task] developerId=<id|legacy> TASK_ROOT=<path>`。
5. **`.Knowledge/` 仍为全员共享**；本规则不按人拆分知识库。

> 实现参考（CLI/工具）：包内 `lib/developerId.js` 的 `resolveDeveloperContext` / `taskRootFor`（与上表同口径）。

## f2s-req-plan 调用时的绑定

执行 **`f2s-req-plan`**（或续作命中 `linkedSkill: "f2s-req-plan"`）时：

- **不受** `changeTracking.feat` / `fix` / `implement` 限制，但 **必须** 按本规则「任务开始 / 执行中 / 中断与会话结束 / 任务完成 / 新会话续作」维护 **`TASK_ROOT`** 下任务树；
- 技能 **步骤 0** 须 `Read` 本规则全文（**Cursor/Claude**：`rules/f2s-task.*`；**Codex**：`.codex/topics/f2s-task.md`）；
- 落盘、打钩、归档、`user-todos.md` / `acceptance.md` 格式 **以本规则为准**；技能正文不得省略 `todo.json` / `user-todos.md` / `acceptance.md`，不得改写归档目录命名（`<YYYYMMDD>-<task-name>`）。

## 目录结构

```
TASK_ROOT/                             ← `.task` 或 `.task/<developerId>`
├── todo.json                          ← 活跃任务索引，仅主 agent 写
├── active/
│   └── <task-name>/
│       ├── task.md                    ← checklist（执行步骤）
│       ├── context.md                 ← 涉及文件路径、相关资料链接
│       ├── user-todos.md              ← 须用户执行的代办（改库、配环境等），见下文
│       └── acceptance.md              ← 验收清单：task.md 全部 [x] 后、归档前生成，见下文
└── completed/
    └── <YYYYMMDD>-<task-name>/
        ├── task.md
        ├── context.md
        ├── user-todos.md              ← 随任务一并归档，便于验收后逐项消项
        └── acceptance.md              ← 随任务一并归档，便于用户最终核对
```

**归档目录命名**：`completed/` 下文件夹名为 **`<YYYYMMDD>-<task-name>`**（**本地日历日期 8 位在前**，`<task-name>` 与 `active/` 下一致、为 snake_case；便于按时间排序）。**新归档一律使用本格式**；仓库中已有的旧式 `<task-name>-<YYYYMMDD>` 目录可保留，择机人工重命名即可。

**从单人布局迁移**：若磁盘仍有根级 `.task/active/` 与 `.task/todo.json`，而当前已解析出非 legacy 的 `TASK_ROOT=.task/<id>`，可在用户确认后将旧 `active/*` 与条目迁入新根（一次性）；未确认前 **不要** 自动挪动他人可能共用的根目录。

## todo.json 结构

```json
[
  {
    "name": "任务名称",
    "folder": "TASK_ROOT/active/<task-name>/",
    "keywords": ["关键词1", "关键词2"],
    "linkedSkill": "f2s-kb-fix",
    "createdAt": "YYYY-MM-DD",
    "assignee": "<developerId 或 legacy>"
  }
]
```

`folder` 落盘时须写成真实相对路径（例如 `.task/alice/active/fix_foo/` 或 legacy 的 `.task/active/fix_foo/`）。`assignee` 建议写入当前 `developerId`（legacy 可写 `"legacy"` 或省略）。

**写权约束**：`todo.json` 仅由主 agent 写，禁止子 agent 修改。

## 任务开始（代码变更前）

0. 按上文解析并固定 **`TASK_ROOT`**（及 developerId / legacy）。
1. 检查 `TASK_ROOT/todo.json` 是否存在活跃任务。
2. 将用户输入与**该文件内**各条目 `keywords` 匹配（**禁止**读取其他 `TASK_ROOT`）：
   - 命中一个 → 加载对应 `task.md`、`context.md`，**若存在** `user-todos.md` 则一并加载，展示剩余清单与未消用户代办
   - 命中多个 → 列出候选，让用户选择
   - 无命中 → 确认任务名称后创建新任务
3. 创建新任务（无命中时）：
   a. 确认任务名称（snake_case，简短描述变更内容）
   b. 在 `TASK_ROOT/active/<task-name>/` 创建文件夹
   c. 将本次工作步骤写入 `task.md`
   d. 将涉及文件路径和相关资料链接写入 `context.md`
   e. **创建 `user-todos.md`**（固定文件名，与 `task.md` 同目录）：见下文「`user-todos.md` 格式与写盘义务」；尚无代办时可写入占位说明
   f. 在 `TASK_ROOT/todo.json` 新增条目（仅主 agent 写；`folder` 指向本任务目录）

## 执行中

- 每完成一个步骤，**立即**用 `Edit` / `Write` 将 `task.md` 中对应 checkbox 由 `[ ]` 改为 `[x]`（与代码改动同等对待，**禁止**仅靠会话内口头宣称「已完成」代替磁盘更新）
- 禁止批量勾选或跳步
- **用户代办须落盘**：凡须任务责任人（用户）在本机、数据库、配置平台或流程上完成的项（例如执行 DDL/DML、填密钥、点审批、发版、补数据），**同一会话内**追加写入 `user-todos.md`（`Edit` 追加小节或列表项），**禁止**仅在对话里交代而不写入该文件；可与对话摘要并存，以磁盘文件为交接真值

## 中断与会话结束（硬约束）

- **长记忆以 `task.md` 的 checkbox 为真值**：下一会话通过「首个仍为 `[ ]` 的步骤」定位进度；未写盘则续作失真。
- 本会话内每真实完成 `task.md` 所列一步：**当步**打钩，不得积压到归档前一次性勾选。
- 若用户结束对话、工具流中断、或预计无法继续：在结束前至少打钩**已真实完成**的步骤，并在「## 备注」写明阻塞原因或「下一会话从步骤 N 继续」；**禁止**在未更新 `task.md` 的情况下直接结束（否则等同丢失进度信号）。
- 中断前若本会话已识别出**用户代办**：**必须**写入或追加到 `user-todos.md`，避免下一会话丢失「交给用户的事」。
- 若本会话为子任务创建过 **`git worktree`** 或等价隔离目录：结束前按 **`f2s-flow2spec-unified-entry`**「Git worktree 与子任务工作目录卫生」完成移除或写明残留路径与删除命令（必要时写入 `user-todos.md`）。

## 任务完成

**归档门禁（须先于移动目录自检）**：

- 将目录移入 `completed/` **当且仅当** `task.md` 的「## 步骤」下，与本次交付相关的条目**全部为 `[x]`**（或用户明确取消的项已在「## 备注」说明，且对应列表项已改为 `[x]` / 已删除该项并注明取消）。
- `task.md` 全部 `[x]` 后、移动目录前，**必须**已生成或更新 `acceptance.md`（见下文「acceptance.md 格式与写盘义务」）；缺失 `acceptance.md` 或仍为创建任务时的占位说明 → 视为门禁未过，禁止归档。
- 若仍存在 `[ ]`：**禁止**移动 `active` → `completed/`、**禁止**从 `todo.json` 删除该条目；应先回到「执行中」补完或改清单后再归档。

完成上述门禁后：

1. 将 `TASK_ROOT/active/<task-name>/` 整体移至 `TASK_ROOT/completed/<YYYYMMDD>-<task-name>/`
2. 从 `TASK_ROOT/todo.json` 删除该条目
3. 若 `todo.json` 变为空数组，删除该文件

## 新会话续作

新会话开始时，先解析 **`TASK_ROOT`**；若存在 `TASK_ROOT/todo.json`：

1. **仅**读取该文件中的活跃任务（禁止合并其他 developer 的 todo）
2. 将用户首条消息与各条目 `keywords` 匹配
3. 命中则展示剩余 checklist，**若存在 `user-todos.md` 则摘要其中仍为 `- [ ]` 的用户代办**；**若存在 `acceptance.md` 则提示其当前形态**（占位 / 已成稿；归档前必须成稿）；提示「检测到未完成任务，是否继续？」
4. 用户确认后：**若 `linkedSkill` 非空，先加载对应技能规则文件（配置根 `skills/<linkedSkill>/SKILL.md`）作为执行上下文**，再按 `task.md` 剩余步骤继续——技能的落盘约束、文风规则、自检清单全部生效，与首次调用一致
5. 无命中则不打扰，正常响应

**孤儿 `active/`（`todo.json` 缺失或损坏）**：若**当前 `TASK_ROOT`** 下仍存在 `active/<task-name>/` 且其中 `task.md` 含未勾选步骤，应 `Read` 该 `task.md` 并提示用户是否续作；续作前宜按「任务开始」一节恢复或补写 `todo.json`（仅主 agent）。**禁止**扫描其他 `.task/<otherId>/active/` 当作孤儿续作。

## task.md 格式

```markdown
# <任务名>

## 步骤
- [ ] 步骤1
- [ ] 步骤2
- [x] 步骤3（已完成）

## 备注
<执行中的发现、决策等>
```

## context.md 格式

```markdown
# <任务名> 上下文

## 涉及文件
- `src/<模块>/callback.js`
- `src/<模块>/retry.js`

## 相关资料
- `.Knowledge/req-docs/<能力>-spec.md`
- `.Knowledge/stock-docs/<能力>-arch.md`

## 用户代办清单
- 见同目录 `user-todos.md`（须用户执行的项统一写在该文件，勿仅在对话中罗列）

## 验收
- 见同目录 `acceptance.md`（task.md 全部 `[x]` 后、归档前生成）
```

## user-todos.md 格式与写盘义务

**路径**：`TASK_ROOT/active/<task-name>/user-todos.md`（归档后位于 `TASK_ROOT/completed/<YYYYMMDD>-<task-name>/user-todos.md`）。**固定文件名** `user-todos.md`，便于 Hook 与脚本引用。

**用途**：汇总 **Agent 无法代劳**、必须由用户（或持权人在平台）完成的项，例如：

- 在指定环境执行 SQL / 迁移脚本（可引用 `req-docs` 或仓库内 `.sql` 路径）
- 配置中心 / 环境变量 / 密钥 / 白名单
- 发布、审批、工单、外部系统开关

**写盘义务**：

1. **创建任务时**（`f2s-task`「任务开始」步骤 3.e）：创建该文件；可含简短说明 + 空列表。
2. **执行中**：每出现一类新的用户代办，**当次**追加（推荐按日期分二级标题 `## YYYY-MM-DD`，下列 `- [ ]` 可勾选项或步骤编号）。
3. **与 `task.md` 分工**：`task.md` 管 Agent 侧步骤 checkbox；`user-todos.md` 管用户侧待办；**勿**把「仅用户可执行」的长操作说明只写在 `task.md` 步骤正文代替本文件。
4. **续作**：加载任务时 `Read` 本文件，向用户展示仍未勾选的 `- [ ]` 项（若有）。

**示例结构**：

```markdown
# 用户代办清单

> Agent 追加；用户完成后可将对应 `- [ ]` 改为 `- [x]` 或删除该行。

## 2026-05-09

- [ ] 在目标环境执行：`.Knowledge/req-docs/xxx.sql`（先备份）
- [ ] 在配置中心打开功能开关 `feature.foo.enabled`

## 2026-05-10

- [ ] 生产发版后回写实际版本号到本文档备注
```

## acceptance.md 格式与写盘义务

**路径**：`TASK_ROOT/active/<task-name>/acceptance.md`（归档后位于 `TASK_ROOT/completed/<YYYYMMDD>-<task-name>/acceptance.md`）。**固定文件名** `acceptance.md`，与 `task.md` / `user-todos.md` 同目录。

**用途**：Agent 在 `task.md` 全部 `[x]` 后、归档前，依据本次实际交付沉淀的**验收清单**：用户照单逐项核对就能确认「这次任务真的做完了」。与 `user-todos.md` **职责分离**：

| 文件 | 谁在做 | 内容焦点 |
| --- | --- | --- |
| `task.md` | Agent | 实现步骤的进度 checkbox |
| `user-todos.md` | 用户 | **代办**：Agent 做不了、必须用户在外部（库 / 平台 / 审批）执行的事 |
| `acceptance.md` | 用户 | **验收**：本轮 Agent 已交付项，用户核对是否真的可用 |

**生效范围**：凡使用 `.task/` 的任务均生成（自动模式 `changeTracking.feat` / `fix` / `implement` 命中、以及显式模式 `f2s-req-plan`）；不区分技能。

**写盘义务**：

1. **创建任务时**（`f2s-task`「任务开始」步骤 3.e 之后）：**可同时创建** `acceptance.md` 并写占位说明（如「task.md 全部 `[x]` 后由 Agent 在此填入验收清单」）；尚未实现时**不得**预先写入验收点，避免与最终交付脱节。
2. **执行中**：原则上**不写**；若交付边界发生重大变化，可在「## 备注」一行记录，最终成稿时再统一整理。
3. **task.md 全部 `[x]` 后、归档前**（**必写**）：Agent 基于本次实际改动整理为正式验收清单；占位说明须被替换为成稿。**这是归档门禁**（见「任务完成」）。
4. **续作**：加载任务时 `Read` 本文件，向用户展示当前形态（占位 / 已成稿）。

**内容形态**：可勾选 `- [ ]` 列表 + 验收方式。每项形如：

```markdown
- [ ] <验收点：交付了什么>（验收方式：<查看哪份文件 / 跑哪条命令 / 看哪个页面>）
```

按交付域分二级标题分组（如 `## 代码`、`## 规则与知识库`、`## 任务清单本体`）。**勿**重复列 `task.md` 的执行步骤；**勿**把 `user-todos.md` 中「用户代办」搬入此处。

**示例结构**：

```markdown
# 验收清单

> Agent 整理；用户核对后可将对应 `- [ ]` 改为 `- [x]`。

## 代码

- [ ] `src/<模块>/<文件>.ts`：<改动点>（验收方式：阅读该文件 / 跑 `npm test -- <文件>`）

## 规则与知识库

- [ ] `.Knowledge/topics/<topic>.md`：<新增/修订说明>（验收方式：打开该文件确认章节齐全）
- [ ] `.Knowledge/manifest-routing.json`：<是否变更与原因>（验收方式：阅读对应字段）

## 任务清单本体

- [ ] `TASK_ROOT/completed/<YYYYMMDD>-<task-name>/` 目录齐全：`task.md` / `context.md` / `user-todos.md` / `acceptance.md`
- [ ] `TASK_ROOT/todo.json` 已删除对应条目（或文件已删除，若数组变空）
```

## 推荐 Hook 配置（Claude Code）

在项目 `.claude/settings.json` 中添加，每次文件变更前将活跃任务注入上下文（示例为 **legacy** 单根；多人请改为当前 `TASK_ROOT/todo.json`，或在命令内按 `flow2spec.config.json` + git 解析路径）：

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "node -e \"try{const f='.task/todo.json',fs=require('fs');if(fs.existsSync(f)){const t=JSON.parse(fs.readFileSync(f,'utf8'));if(t.length)console.log('[task] 活跃任务: '+t.map(x=>x.name).join(', '))}}catch(e){}\" 2>/dev/null || true"
      }]
    }]
  }
}
```

## 禁止项

- 禁止子 agent 写入 `todo.json`
- 禁止在所有步骤完成前将任务移至 `completed/`
- 禁止批量勾选 checkbox（必须逐步勾选）
- 禁止在 `changeTracking.feat` / `changeTracking.fix` / `changeTracking.implement` 均为 `false` 或字段不存在时创建任务目录（`f2s-req-plan` 不受此约束）
- 禁止在已使用任务清单的流程中，将「须用户执行的代办」**仅**写在对话或仅写在 `task.md` 而**不**追加到 `user-todos.md`（无代办时文件可保持占位说明）
- 禁止在 `acceptance.md` 仍为占位说明、或缺失该文件时归档；禁止把 `user-todos.md`（用户代办）与 `acceptance.md`（用户验收）合并写入同一文件
- 禁止在任务实现完成前预先写入具体验收点（仅可写占位说明），避免与实际交付脱节
- **禁止**为匹配/续作遍历其他 developer 的 `.task/<otherId>/` 或合并多人 `todo.json`
- **禁止**在未解析 `TASK_ROOT` 的情况下默认写入仓库根 `.task/active/`（除非当前解析结果即为 legacy `.task`）
