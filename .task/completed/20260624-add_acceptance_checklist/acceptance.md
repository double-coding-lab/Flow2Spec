# 验收清单

> Agent 整理；用户核对后可将对应 `- [ ]` 改为 `- [x]`。

本次新增能力：`.task/` 任务清单新增 **`acceptance.md`**（验收清单），与 `user-todos.md` 平级、职责分离。

## 规则真值源（5 处镜像）

- [ ] `.claude/rules/f2s-task.md`：新增「acceptance.md 格式与写盘义务」节；目录结构、归档门禁、续作展示、context.md 引用、禁止项均已更新（验收方式：打开文件搜索 `acceptance.md`，应有 12 处命中）
- [ ] `.codex/f2s-rules/f2s-task.md`：body 与 `.claude` 同源；frontmatter 缺省（Codex 约定）（验收方式：`diff <(sed -n '/^# f2s-task/,$p' .claude/rules/f2s-task.md) .codex/f2s-rules/f2s-task.md` 应无差异）
- [ ] `.cursor/rules/f2s-task.mdc`：body 与 `.claude` 同源；保留 `alwaysApply: true` frontmatter（验收方式：`head -10` 查 frontmatter；正文搜 `acceptance.md` 应 12 处）
- [ ] `templates/zh-CN/rules/f2s-task.md`：body 与 `.claude` 同源；保留 `alwaysApply: true` frontmatter（验收方式：同上）
- [ ] `templates/en-US/rules/f2s-task.md`：英文版本同步更新（目录、归档门禁、续作、context.md、新增「Acceptance」一节、禁止项；验收方式：打开文件搜索 `acceptance.md`，应有 12 处命中）

## 知识库 topic 摘要（3 处）

- [ ] `.Knowledge/topics/f2s-task.md`：目录块新增 `acceptance.md` 行；指针段新增"`acceptance.md` 管用户验收"；续作摘要含「提示 `acceptance.md` 当前形态」（验收方式：打开文件确认 4 处 `acceptance.md` 出现）
- [ ] `templates/zh-CN/knowledge/topics/f2s-task.md`：同上同步（验收方式：同上）
- [ ] `templates/en-US/knowledge/topics/f2s-task.md`：英文版本同步（验收方式：搜 `acceptance.md` 应有 4 处）

## stock-doc（1 处）

- [ ] `.Knowledge/stock-docs/Flow2Spec-任务清单与变更追踪.md` 第 3 节目录块新增 `acceptance.md` 行；新增 **3.1 节**用 3×3 表格说明 `task.md` / `user-todos.md` / `acceptance.md` 三者职责分离（验收方式：打开文件，第 3 节末尾应能看到「3.1 `user-todos.md` 与 `acceptance.md`：用户侧两份文件，职责分离」小节）

## matcher 触发词（3 处）

- [ ] `.Knowledge/matchers/m-change-tracking.json`：新增 `验收清单` / `acceptance.md` / `归档前验收`（验收方式：`cat` 文件确认 includeAny 含上述三词）
- [ ] `templates/zh-CN/knowledge/matchers/m-change-tracking.json`：同上同步（验收方式：同上）
- [ ] `templates/en-US/knowledge/matchers/m-change-tracking.json`：同上同步，并加 `acceptance checklist` / `acceptance before archive`（验收方式：同上）

## 未变更项（按"手术式修改"原则不动）

- [ ] `.Knowledge/manifest-routing.json`：未改动（无新增 topic / 依赖 / metadata；`acceptance.md` 是 `.task/` 子能力，属既有 topic `f2s-task` 内部细节）
- [ ] `.Knowledge/index.md`：未改动（无新增主题行）
- [ ] 各业务 SKILL（`f2s-kb-feat` / `f2s-kb-fix` / `f2s-req-plan` / `f2s-implement-tech-design`）：未改动（其归档自检已写「满足 `f2s-task` 归档门禁」；新增门禁条目自然覆盖）

## 任务清单本体

- [ ] `.task/active/add_acceptance_checklist/` 目录齐全：`task.md` / `context.md` / `user-todos.md` / `acceptance.md`（验收方式：`ls .task/active/add_acceptance_checklist/`）
- [ ] `task.md`「步骤」全部 `[x]`（验收方式：打开 `task.md`，应见所有列表项均 `[x]`）
- [ ] 归档后：目录在 `.task/completed/20260624-add_acceptance_checklist/`；`todo.json` 中该条目已删除（验收方式：`ls .task/completed/ | grep add_acceptance_checklist` 应有命中；`cat .task/todo.json` 不含 `add_acceptance_checklist`）

## 端到端验证（推荐，下一次任意 `f2s-*` 任务）

- [ ] 下一次触发 `f2s-kb-feat` / `f2s-kb-fix` / `f2s-implement-tech-design` / `f2s-req-plan`：观察 Agent 在 `task.md` 全部 `[x]` 后是否**主动**生成 `acceptance.md`，而非直接归档（验收方式：执行任一新任务，归档前 `ls .task/active/<task-name>/` 应见 `acceptance.md` 且为成稿）
