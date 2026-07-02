---
name: repo-dev-check
description: 在 Flow2Spec 双仓自身开发时自查「写盘边界 + 双仓一致 + 分发口径」：识别当前 pending 改动是否落错地方（应改 templates 却动了配置根、本仓专属却写进 templates、只改单侧仓库），并给出修复动作。触发词：dev-workflow 自查、写盘边界、双仓漂移、templates vs 配置根、分发检查。
---

# repo-dev-check（本仓开发纪律自查）

> **适用**：仅在 Flow2Spec 双仓自身（`Flow2Spec-public` / `flow2spec`）里开发时启用。**下游项目不会拿到本 SKILL**——它只存在于本仓的 `.claude/skills/`、`.cursor/skills/`、`.codex/skills/`，从不进 `templates/`。
>
> **单一事实源**：本 SKILL 依据 **`f2s-dev-workflow-constraints`** 规则执行（Claude：`.claude/rules/repo-dev-workflow-constraints.md`；Cursor：`.cursor/rules/repo-dev-workflow-constraints.mdc`；Codex：`.codex/topics/repo-dev-workflow-constraints.md`）。步骤 0 必须 Read 该规则全文。

## 触发场景

- 用户显式说「跑 dev-workflow 自查 / 检查双仓 / 检查是不是改错地方了」；
- 用户在 Flow2Spec 双仓内、Agent 即将提交前主动自查；
- Agent 发现自己刚做了配置根下的 `Edit` / `Write`，或只在单侧仓库落了盘，须补做本自查；
- Agent 在改开发纪律相关的规则 / skill / topic 时（比如本文件、`f2s-dev-workflow-constraints`）。

**不触发**：下游项目内、纯业务代码修改无 template/config-root 交集时。

## 前置

**步骤 0**：`Read` **`.claude/rules/repo-dev-workflow-constraints.md`**（Cursor：`.cursor/rules/*.mdc`；Codex：`.codex/topics/*.md`）全文。**不 Read 直接开跑属违规**。

## 编排

- **主 agent 通篇执行**：本 skill 无重 IO 操作，无需拆子。
- **配置**：不受 `flow2spec.config.json.subAgent` 约束（无论 true / false 都主 agent 跑）。
- **写权**：本 skill **不**主动落盘业务文件；只做**判定 + 建议**；确实需要写盘时**逐条**回到具体 skill（如 `f2s-git-commit`）流程。

## 步骤

### 步骤 1：定位当前仓 + git 摸底

1. 判断当前工作目录是否在 Flow2Spec 双仓内：`Bash` 跑 `git remote -v` 查看，若 URL 含 `github.com/Lands-1203/Flow2Spec` 或 `git.dev.sh.ctripcorp.com/trainH5/flow2spec` 则算作双仓，否则**报错退出**（下游项目不该跑本 skill）。
2. `Bash`：`git status -s | grep -v DS_Store` 列出所有未提交改动。
3. `Bash`：`ls "/Users/<user>/Desktop/项目/ai/flow2spec 双仓/"`（或用户当前放双仓的父目录）确认另一侧仓库是否存在于本机。用户不用双父目录时，跳过对侧检查、只做本侧自查（并在摘要提示）。

### 步骤 2：写盘边界判定（对每份 pending 文件）

对步骤 1 列出的每一份改动文件，套下表判定：

| 文件路径模式 | 是否合规 | 判定依据 |
| --- | --- | --- |
| `templates/zh-CN/**` 或 `templates/en-US/**` | ✅ 合规 | 生产侧唯一入口 |
| `docs/**` / `lib/**` / `cli.js` / `scripts/**` / `package.json` | ✅ 合规 | 包源码 |
| `.Knowledge/**` | ✅ 合规 | 本仓自身知识库 |
| `.claude/rules/repo-dev-workflow-constraints.md` | ✅ 合规 | 本仓专属手写规则（templates 无对应源） |
| `.claude/skills/repo-dev-check/**` | ✅ 合规 | 本仓专属手写 skill（templates 无对应源） |
| `.cursor/rules/repo-dev-workflow-constraints.mdc` | ✅ 合规 | 同上（Cursor 端） |
| `.cursor/skills/repo-dev-check/**` | ✅ 合规 | 同上 |
| `.codex/topics/repo-dev-workflow-constraints.md` | ✅ 合规 | 同上（Codex 端） |
| `.codex/skills/repo-dev-check/**` | ✅ 合规 | 同上 |
| `.claude/rules/<其它>.md` / `.cursor/rules/<其它>.mdc` / `.codex/topics/<其它>.md` | ❌ 违规 | 有 templates 对应源 → 应改 `templates/{zh-CN,en-US}/rules/<其它>.md` |
| `.claude/skills/<其它>/**` / `.cursor/skills/<其它>/**` / `.codex/skills/<其它>/**` | ❌ 违规 | 有 templates 对应源 → 应改 `templates/{zh-CN,en-US}/skills/<其它>/SKILL.md` |
| 根 `AGENTS.md` | ❌ 违规 | 由 `buildCodexAgentsMd(templatesDir, ...)` 从 templates 拼装 → 应改 `templates/{zh-CN,en-US}/AGENTS.md` |
| `.claude/hooks/**` / `.cursor/hooks/**` / `.codex/hooks/**` / `.claude/settings.json` / `.cursor/hooks.json` / `.codex/hooks.json` | ❌ 违规 | init 产物 → 需求要改的话改 `lib/init.js` 或 `templates/` |
| `.claude/memory/**` / `LOCAL_CONTEXT.md` | ⚠️ 本地态 | 不入库，不受约束（但提醒别 commit） |

**判定捷径**：**在 `templates/{zh-CN,en-US}/` 里能找到对应源** ⇒ 属「下游会用到的 init 产物」，禁止手改配置根。否则属本仓专属手写内容，配置根版本就是原始版本。

### 步骤 3：双仓漂移判定

**须双父目录都存在**才能做这步。对上一步判定「合规」的每份文件（不含本地态）：

1. 计算对侧仓库对应路径（`Flow2Spec-public/foo/bar.md` ↔ `flow2spec/foo/bar.md`）。
2. `Bash`：`diff <(sed 's/@double-codeing\/flow2spec/@ctrip\/flow2spec/g' 本侧) 对侧` 或反向。
3. **漂移标志**：diff 非空 → 提示「双仓漂移：<路径>」；建议动作：把改动同步到对侧同名路径。
4. **例外**：`package.json` 的 `version` 字段、包名字段允许天然不等；`README*` 的 remote URL 段允许不等。

### 步骤 4：分发口径检查

1. 检查用户最近对话里是否有「跑 init / sync / 分发」的明确指令。**没有**则：Agent **禁止**主动跑 `flow2spec init` / `npm run sync:agents`。
2. 若本轮已完成 templates 侧改动、用户未明示分发，摘要末尾提示：
   > **已改 templates；请你执行 `npm run sync:agents` 或 `node ./cli.js init codex claude cursor` 分发到配置根**。
3. 若本轮改了**本仓专属**配置根文件（本规则、本 skill 等），点名「本仓专属手写；无需 init 分发」。

### 步骤 5：输出摘要

按以下模板输出（都写完为止）：

```markdown
## repo-dev-check 结果

### 当前仓
- 仓库：Flow2Spec-public / flow2spec / 非双仓（退出）

### 写盘边界（步骤 2）
- ✅ 合规改动：<数量>
  - <路径 1>
  - <路径 2>
- ❌ 违规改动：<数量>
  - <路径>：违规原因（应改 templates/{zh-CN,en-US}/... 的哪份）
- ⚠️ 本地态（不入库）：<路径>

### 双仓漂移（步骤 3）
- 双父目录：存在 / 缺失（跳过对侧检查）
- 漂移文件：<数量>
  - <路径>：本侧 vs 对侧（附首条差异）
- 一致文件：<数量>

### 分发建议（步骤 4）
- 是否有用户明示 init 指令：是 / 否
- 本轮涉及 templates 改动：是 / 否
- **建议**：<「请你跑 npm run sync:agents ...」 / 「本轮改动均为本仓专属，无需分发」 / 「等你补完对侧改动再讨论分发」>
```

## 完成后自检

1. 步骤 0 是否 Read 了 `f2s-dev-workflow-constraints` 规则全文？
2. 步骤 1 是否 `git remote -v` 确认当前仓是 Flow2Spec 双仓其一？
3. 步骤 2 是否**逐份**改动都套了表判定，未凭记忆断言？
4. 步骤 3 是否在双父目录存在时**都**跑了对侧 diff（不是抽查）？
5. 步骤 4 分发建议是否明确指出：是否需要 sync:agents、由谁跑？
6. 摘要是否覆盖所有 5 节，且违规 / 漂移条目都点了名（不是"疑似"）？

## 禁止项

- 禁止在下游项目内调用本 skill——它只对 Flow2Spec 双仓生效。
- 禁止跳过步骤 0 直接判定；须先读规则全文再对照。
- 禁止 Agent 主动执行 `flow2spec init` / `npm run sync:agents` 分发命令；本 skill 只出建议。
- 禁止把「本仓专属手写内容」写进 `templates/`；也禁止把「templates 有源的规则/技能」的配置根版本视为本仓专属。
