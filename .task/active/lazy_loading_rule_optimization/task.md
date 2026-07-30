# lazy_loading_rule_optimization

## 步骤

- [ ] 收敛 `AGENTS.md`：只保留硬约束和最短读取链，避免展开 topic 创作细节。
- [ ] 收敛 `fs-flow-spec-unified-entry`：只负责知识库消费路径，不重复 topic 创作规则。
- [ ] 将 `topicMetadata`、`topicDependencies`、大功能拆分策略继续集中到 `fs-topic-authoring` 单一事实源。
- [ ] 精简 `fs-kb-build` / `fs-kb-sync` / `fs-kb-add` / `fs-kb-addRules` / `fs-kb-upgrade` 中重复展开的字段规则，改为触发条件 + Read authoring + 简短自检。
- [ ] 保留必要自检清单，确保 Agent 不忘记配置根禁止改、manifest/index 写权、低置信度澄清、分类不参与路由等硬门禁。
- [ ] 完成 public 后同步 internal，并运行 metadata schema、`npm test`、`npm run pack:check`。

## 备注

2026-06-03 讨论结论：

- 当前 flow-spec 已有懒加载雏形：消费路径基本是 `manifest -> matcherPath -> topic -> stock-doc/code`。
- 当前不足：`AGENTS.md` 与 `fs-flow-spec-unified-entry` 仍有重复；部分 kb skill 重复展开 `topicMetadata`、`topicDependencies`、写权、自检规则。
- 优化目标不是减少规则总量，而是减少单次任务必须读取的规则量。
- 规则组织原则：短硬规则常驻；长规则按场景加载；同一规则只在一个事实源完整展开；其他位置只写触发条件和引用。
- 不应为了瘦身牺牲约束力；关键门禁要保留在入口或相关 skill 自检中。
