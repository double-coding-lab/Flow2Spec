# add_acceptance_checklist

## 步骤

- [x] 更新 `fs-task` 规则（真值源）：`.claude/rules/fs-task.md`，新增「acceptance.md 格式与写盘义务」节、目录结构、归档门禁、续作展示、禁止项、context.md 引用
- [x] 同步 `fs-task` 规则镜像：`.codex/fs-rules/fs-task.md`、`.cursor/rules/fs-task.mdc`、`templates/zh-CN/rules/fs-task.md`
- [x] 同步 `fs-task` 规则英文模板：`templates/en-US/rules/fs-task.md`
- [x] 更新 topic 摘要：`.flow-spec/topics/fs-task.md` 目录结构 + 一句话指针；同步中英模板 topic
- [x] 更新 stock-doc：`.flow-spec/stock-docs/flow-spec-任务清单与变更追踪.md` 第 3 节目录、新增「3.1 验收清单」最小段
- [x] 更新 matcher 触发词：`.flow-spec/matchers/m-change-tracking.json` + 中英模板，追加「验收清单 / acceptance」
- [x] 自检：自身 `task.md` 全部 `[x]` 后，按本次新增规则**先生成本任务的 `acceptance.md`**，再归档（dogfood）

## 备注

- 决策：规则层增量为主，**不改各业务 SKILL**（feat/fix/req-plan/implement 的归档门禁已写「满足 fs-task 归档门禁」，新增门禁条目自然覆盖）。
- 决策：不动 `manifest-routing.json`（acceptance 是 `.task/` 子能力，无新增 topic/依赖/metadata）。
- 决策：不动 `.flow-spec/index.md`（无新增主题行）。
- 触发时机：`task.md` 全部 `[x]` 后、归档前生成（用户已确认）。
- 文件名：`acceptance.md`（与 user-todos.md 平级、同目录）。
- 内容形态：可勾选 `- [ ]` 列表 + 验收方式。
- 生效条件：凡使用 `.task/` 的任务均生成（含 fs-req-plan / changeTracking.feat / fix / implement 触发的）。
