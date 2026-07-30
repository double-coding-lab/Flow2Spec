# lazy_loading_rule_optimization 上下文

## 涉及文件

- `templates/AGENTS.md`
- `templates/rules/fs-flow-spec-unified-entry.mdc`
- `templates/rules/fs-topic-authoring.mdc`
- `templates/rules/fs-knowledge-preflight.mdc`
- `templates/skills/fs-kb-build/SKILL.md`
- `templates/skills/fs-kb-sync/SKILL.md`
- `templates/skills/fs-kb-add/SKILL.md`
- `templates/skills/fs-kb-addRules/SKILL.md`
- `templates/skills/fs-kb-upgrade/SKILL.md`

## 当前判断

- 消费侧懒加载约 70%：已按 manifest / matcher / topic / stock-doc 渐进读取。
- 创作侧懒加载约 55%-60%：已集中到 `fs-topic-authoring`，但多个 skill 仍重复展开规则。
- `fs-kb-addRules` 因任务性质就是写规则/topic，可接受较重的前置读取。
- `fs-kb-upgrade` 可保留审计流程，但分类/拆分规则应更多引用 `fs-topic-authoring`。

## 优化原则

- `AGENTS.md`：只放不可忘的硬约束。
- `fs-flow-spec-unified-entry`：只放消费侧路由和缺口处理。
- `fs-topic-authoring`：承载 topic 写入、metadata、dependencies、拆分策略。
- 各 skill：只保留触发条件、必须读取的规则、与本 skill 独有的流程和简短自检。

## 用户代办清单

- 见同目录 `user-todos.md`。
