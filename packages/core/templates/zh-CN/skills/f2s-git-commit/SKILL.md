---
name: f2s-git-commit
description: 代码写完后提交 Git：默认检查变更与知识库覆盖；用户明确要求“快捷提交”时跳过知识库覆盖检查；**改动全为纯文档 / 知识库自身**或**近 30 分钟内已跑过 kb-sync/kb-feat/kb-fix** 时自动跳过覆盖检查；生成带 emoji 首行的提交说明后**可直接 commit**（须在当条回复展示首行，不要求用户单独确认 commit）；**git pull 类拉取须用户先确认**。触发：f2s-git-commit、提交代码、快捷提交、git commit、帮我提交
---

> 执行口径：本技能代用户执行 git 操作；不使用 `git add -A` / `git add .`，不跳过 hooks（`--no-verify`），不自动 push。**`git pull` / `git fetch` 合并入本地前必须取得用户对「拉取」的明确确认**；`git commit` 不要求单独一轮「确认」交互（见步骤 3–4）。用户明确要求“快捷提交”时，仅跳过步骤 2 知识库覆盖检查，其余安全步骤照常执行。

## 编排（主 / 子 agent）

- `subAgent` / `switchAgentVerification` 语义以统一入口为唯一事实源：**Cursor/Claude** 读配置根 `rules/f2s-flow2spec-unified-entry.*`；**Codex** 读 `.codex/topics/f2s-flow2spec-unified-entry.md`。
- 本技能全程在主 agent 完成（**pull 的确认**不可下放子 agent；`git commit` 不要求单独一轮用户确认，见步骤 3–4）。

# f2s-git-commit（提交代码）

## 强制流程

### 快捷提交模式

当用户本轮明确说出 **“快捷提交”**、**“快速提交”** 或 **“quick commit”** 时，进入快捷提交模式：

- 跳过 **步骤 2：知识库覆盖检查**，不读取 `.Knowledge/topics/` / `.Knowledge/stock-docs/` 做覆盖判断。
- 不提示用户先运行 `f2s-kb-sync` / `f2s-kb-feat`。
- **不跳过**步骤 1 的变更读取与冲突标记检查。
- **不跳过**步骤 3 的提交信息生成与展示。
- **不跳过**步骤 4 的精确 `git add <文件列表>`、正常 `git commit` 与 git hooks。
- **不得**因快捷提交使用 `git add -A` / `git add .` / `--no-verify` / 自动 push。

### 步骤 1：读取变更（只读）

```bash
git status --short
git diff HEAD
```

- 从 `git status --short` 区分三类文件：
  - **Staged**：已 `git add`，前缀为 `M `、`A `、`D `（首列非空）
  - **Unstaged**：已追踪但未 add，前缀为 ` M`、` D`（次列非空）
  - **Untracked**：`??` 前缀，新文件尚未追踪
- 若三类均为空（nothing to commit），直接告知用户并结束。

**冲突检查（必须，先于一切）**：

扫描所有变更文件内容，若任意文件包含 `<<<<<<<`、`=======`、`>>>>>>>` 冲突标记，立即终止并提示：

```
❌ 检测到未解决的 merge conflict：
  - <文件路径>

请先解决冲突后再提交。
```

### 步骤 2：知识库覆盖检查（默认必须；三种情况可跳过）

若处于**快捷提交模式**，本步骤直接跳过，并在步骤 5 收尾提示中说明“已按快捷提交跳过知识库覆盖检查”。

**先判断 `.Knowledge/` 是否存在：**

- 若 `.Knowledge/manifest-routing.json` 不存在：跳过本步骤，在步骤 5 收尾提示「项目尚未初始化 Flow2Spec 知识库，建议运行 flow2spec init」，继续步骤 3。

**跳过判定 A：改动纯文档 / 知识库自身**（进入覆盖检查前先判定）

若步骤 1 收集到的 pending 文件路径**全部**命中以下模式,直接跳过本步骤（在步骤 5 说明「本次改动纯文档,已跳过覆盖检查」）：

- `.Knowledge/**`（改的就是知识库自己,检自己无意义）
- `docs/**` / `docs/en/**`
- `README*.md` / `LICENSE` / `CHANGELOG*`
- `.claude/**` / `.cursor/**` / `.codex/**`（agent 配置根,由 flow2spec init 分发,与业务能力覆盖无关）
- `presentations/**` / `assets/**` / 其他纯静态资源

**任一**文件落在 `src/` / `lib/` / `cli.js` / `templates/` / 业务代码目录时,本捷径**不生效**,继续走覆盖检查。

**跳过判定 B：近期已同步过知识库**

读取 `.Knowledge/.last-sync.json`（若不存在直接跳过本判定）：

```json
{
  "syncedAt": "2026-08-04T10:30:00.000Z",
  "skill": "f2s-kb-sync",
  "developerId": "<可选>"
}
```

- 若 `Date.now() - Date.parse(syncedAt) < 30 * 60 * 1000`（30 分钟内）→ 直接跳过本步骤,在步骤 5 说明「近 30 分钟内已跑过 <skill>,已跳过覆盖检查」。
- 若时间戳过期或文件损坏 → 忽略,正常走覆盖检查。
- 该文件由 `f2s-kb-sync` / `f2s-kb-feat` / `f2s-kb-fix` / `f2s-kb-add` / `f2s-kb-addRules` / `f2s-kb-distill` 等**知识库写入类技能**在成功完成后写入,`f2s-git-commit` **只读**不写。
- 用户显式说「重新检查一次覆盖」/「不要跳过覆盖检查」→ 本判定失效,强制走覆盖检查。

**存在时执行覆盖检查：**

**先执行 KB 自动合并预检（必须，不让用户手动跑命令）：**

1. Agent 在本步骤内部执行 `flow2spec kb check --json` 与 `flow2spec kb status --json`，或使用等价的内置 KB 引擎能力；不得把这些命令变成用户要手动执行的提交前置工作。
2. 若 `check` 返回知识库结构错误、matcher 缺失、routing drift 等健康问题：终止本次 commit，报告具体问题与建议修复动作；不要把损坏的知识库一起提交。
3. 若 `status.tasks` 中存在当前 developer 任务根下的 `kb-delta.json`：
   - 能唯一定位当前任务线且 `mergeable=true`：自动执行 `plan → apply → build → check`（CLI 或等价内置能力均可），并把被写入的 `.Knowledge/**` 文件纳入本次提交文件列表。
   - `mergeable=false`、delta 解析失败，或存在多个 active delta 且无法判断哪个属于本次提交：停止自动写入，列出 `topic / reason / deltaPath`，提示用户需要语义合并或选择任务线；不得猜测合并。
4. 若没有当前任务线的 active `kb-delta.json`，才进入下面的粗粒度覆盖判断。

**没有可自动应用的 delta 时，执行粗粒度覆盖检查：**

1. 从 `git diff HEAD` 及 untracked 文件路径推断本次变更涉及的**功能模块**（以仓库内目录/包名为准，勿臆测未出现的业务名）。
2. 读取 `.Knowledge/topics/` 目录列表与 `.Knowledge/stock-docs/` 目录列表。
3. 对比步骤 1 推断出的功能模块，判断对应文档是否已在知识库中登记。
4. 得出结论：**已覆盖 / 部分覆盖 / 未覆盖**。

> 判断粗粒度即可：有对应 topic 或 stock-docs 文档即视为已覆盖；若知识库为空或找不到相关文档则视为未覆盖。

**未覆盖或部分覆盖时（必须提示）：**

```
⚠️  本次变更涉及以下能力尚未入知识库：
  - <能力描述>

建议在提交前同步知识库，可选：
  A) 现在运行 f2s-kb-sync 补录，完成后自动继续提交流程
  B) 先提交，稍后手动补录（输入 B 确认）
  C) 取消本次提交（输入 C）
```

- 选 **A**：提示用户运行 `f2s-kb-sync` 或 `f2s-kb-feat` 补录；用户补录完成后在**同一会话声明已补录**或**再次触发本技能**时，从步骤 1 或步骤 3 继续（**不要求**为「继续 commit」单独打字确认，与步骤 3–4 一致）。
- 选 **B**：记录未覆盖能力描述，在步骤 5 收尾提示中输出。
- 选 **C**：终止本技能。

### 步骤 3：生成提交信息草稿（必须）

读取 `git diff HEAD`（内容过长时取前 300 行），基于实际变更内容生成提交信息。

#### 首行格式（必须）：类型图标 + Conventional Commits

**首行**须同时满足：

1. **以一个 emoji 开头**（与下表 `type` 对应，**禁止**用多个装饰 emoji 堆叠）。
2. 紧跟 **一个 ASCII 空格**，再写 **小写 `type`**、英文冒号 `:`、**一个空格**、**中文或英文简述**。
3. **可选 scope**：使用 Conventional 的 `type(scope):`，紧跟在 `type` 之后、冒号之前，例如 `🐛 fix(auth): 修复登录态丢失`。
4. 首行总长度建议 **≤ 72 个字符**（含 emoji；过宽时优先缩短描述）。

**推荐模板（单行）**：

```text
<emoji> <type>[(scope)]: <简述>
```

无 scope 时省略括号段，例如：`🚀 feat: 简述`。

**`type` → 首字符 emoji（固定选用下表，便于检索与发布说明）**：

| `type` | emoji | 典型场景 |
|--------|--------|----------|
| `feat` | 🚀 | 新功能、对用户可见的能力增量 |
| `fix` | 🐛 | 缺陷修复、线上/测试问题 |
| `docs` | 📚 | 仅文档、注释、README、知识库正文类 |
| `style` | 💄 | 纯格式、缩进、分号等不改变行为的排版 |
| `refactor` | ♻️ | 重构、改名、无行为变化的结构调整 |
| `perf` | ⚡ | 性能优化 |
| `test` | 🧪 | 测试用例、测试桩、快照 |
| `build` | 🏗️ | 打包、依赖、编译脚本、artifact |
| `ci` | 👷 | CI 配置、流水线、自动化脚本 |
| `chore` | 🔧 | 杂项、工具脚本、非 build/ci 的维护性改动 |
| `revert` | ↩️ | 回滚某次提交 |

**示例**：

```text
🚀 feat: 支持xxx活动缓存预热
🐛 fix(coupon): 领券窗口边界条件错误
📚 docs: 补充公共模块 QConfig 说明
♻️ refactor: 提取拼团校验为独立函数
🔧 chore: 升级 ESLint 配置
```

**正文（可选）**：第二行起可为列表或段落，**不要求**每行再加 emoji；若需条目，用 `- ` 即可。

**用户已给出首行时**：若已含上表之一且 emoji 与 `type` 一致，**尊重用户文案**；若仅有 `type:` 无 emoji，**须补全 emoji** 再进入步骤 4。

**与 `git commit` 的确认策略（必须）**：

- 在**同一条 assistant 回复**中：**先**展示拟提交说明的**首行**（及可选正文），**随后立即**执行步骤 4（`git add` 逐项 + `git commit`）。**不要求**用户再回复「确认」才允许 commit。
- 若用户在该轮对话中**已先写明**提交说明且合规，可直接使用并进入步骤 4，仍须在执行前**复述首行**再 commit。
- 用户若明确表示「改提交说明 / 换一个 type」：改稿后仍在本策略下**展示即提交**，不增加「请回复确认」门槛。

### 步骤 4：执行提交（展示说明后立即执行）

根据步骤 1 的三类文件分别处理：

```bash
# 1. Unstaged 文件：需先 add
git add <unstaged 文件列表>

# 2. Untracked 文件：需先 add
git add <untracked 文件列表>

# 3. Staged 文件：已 add，无需重复操作

# 执行提交
git commit -m "<步骤 3 定稿的完整提交信息>"
```

- 禁止使用 `git add -A` / `git add .`，仅 add 步骤 1 中明确列出的文件。
- 若 pre-commit hook 失败：输出完整错误信息，提示用户修复后重新触发本技能，**不**使用 `--no-verify` 绕过。
- 若 commit 成功：读取 commit hash（`git rev-parse --short HEAD`）并进入步骤 5。

### 步骤 5：收尾提示

```
✅ commit <hash> 完成
   <提交信息首行>

[若步骤 2 选了 B]
📌 提醒：以下能力仍未入知识库，建议在合并前补录：
  - <能力描述>
  可运行：f2s-kb-sync 或 f2s-kb-feat

[若跳过了步骤 2（.Knowledge 不存在）]
💡 项目尚未初始化 Flow2Spec 知识库，如需接入可运行：flow2spec init

[若快捷提交跳过了步骤 2]
⚡ 已按快捷提交跳过知识库覆盖检查。

[若命中跳过判定 A：改动纯文档]
📄 本次改动纯文档 / 知识库自身,已跳过覆盖检查。

[若命中跳过判定 B：近 30 分钟内已同步]
🔄 近 30 分钟内已跑过 <skill 名>,已跳过覆盖检查（.Knowledge/.last-sync.json）。
```

## 约束

- 禁止使用 `git add -A` / `git add .`，只 add 已确认的变更文件。
- 禁止 `--no-verify`，hook 失败须修复后重试。
- 禁止 `--amend` 已推送的 commit，除非用户明确要求。
- 禁止自动 push，commit 完成后停止。
- 默认模式下知识库未覆盖时必须提示，但最终是否补录由用户决定（选 B 不阻塞）；快捷提交模式下跳过知识库覆盖检查，不提示补录选项。
- **`git pull` / `git pull --rebase` / 会改写当前分支工作区内容的 `git fetch` 后续合并操作**：**必须**先向用户说明目的与风险，**取得用户对「拉取」的明确确认**（如用户回复「确认 pull」）后再执行；**禁止**为 commit 而顺带静默 pull。
- **`git commit`**：**不要求**用户单独回复「确认」；但**禁止完全不展示**拟提交首行就执行 commit（须在当条回复中可见首行后再执行）。
- 提交信息**首行**须符合步骤 3 的 **emoji + type** 格式（用户已合规给出时可保留）。
- 存在 merge conflict 标记时必须终止，不得继续。

## 完成后自检

1. 步骤 1 是否检查了 merge conflict（必须为是）。
2. 是否区分了 staged / unstaged / untracked 三类文件（必须为是）。
3. 是否用了 `git add -A` / `git add .`（必须为否）。
4. 知识库检查是否执行或有明确跳过理由（快捷提交 / `.Knowledge` 不存在）（必须为是）；若存在 active `kb-delta.json`，是否已自动 plan/apply/build/check 或明确报告冲突（必须为是）。
5. 步骤 3 是否基于 `git diff` 实际内容生成提交信息（必须为是，而非仅 `--stat`）。
6. 执行 commit 前是否在当条回复中**展示了拟提交首行**（必须为是）；**不得**要求用户单独「确认 commit」才执行（与策略一致）。
7. 提交信息**首行**是否为 `<emoji> <type>[(scope)]: <简述>` 且 emoji 与 type 与上表一致（合并 revert 等例外须在展示中说明）。
8. 若 pre-commit 失败，是否跳过了 hook（必须为否）。
9. 若步骤 2 选 B，收尾提示是否包含未补录提醒。
10. 若步骤 2 选 A，是否在用户补录或再次触发后继续流程（**不要求**为继续 commit 单独要确认）。
11. 若本流程中曾需要 `git pull`：是否在执行前取得用户对 **pull** 的明确确认（必须为是）；未涉及 pull 则标 N/A。
