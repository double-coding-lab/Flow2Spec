# negation_style_global_rule

## 步骤
- [x] 步骤 1：读取 flow-spec.config.json，确认编排模式
- [x] 步骤 2：理解 flow-spec 全貌（读取所有相关 SKILL.md 与 manifest）
- [x] 步骤 3：与用户确认规则表述与改造范围（全局 rules vs 每个 skill 单独写）
- [x] 步骤 4：参考实际触发案例（538d7775 对话）修订规则描述
- [x] 步骤 5：确认落盘位置（templates/rules 全局 + fs-kb-fix/fs-kb-feat 精简引用）
- [x] 步骤 6：改写 flow-spec-public templates（unified-entry + 两个 SKILL）
- [x] 步骤 7：同步到 flow-spec 私仓 templates（双仓一致）
- [x] 步骤 8：diff 自检，确认双仓完全一致

## 备注
changeTracking.fix: false，但用户明确要求任务清单形式，应创建 .task/。
用户 init 后配置根自动同步，无需手动操作。
