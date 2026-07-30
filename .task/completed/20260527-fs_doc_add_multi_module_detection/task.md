# fs_doc_add_multi_module_detection

## 步骤
- [x] 步骤 1：明确违规点与影响范围
- [x] 步骤 2：修复 templates 仓 SKILL.md（添加多模块检测步骤）
- [x] 步骤 3：修复 public 仓 SKILL.md（同步）
- [x] 步骤 4：更新 .flow-spec 知识库（stock-docs / topics / index）
- [x] 步骤 5：输出修正摘要并完成自检

## 备注
用户描述：fs-doc-add 在用户指定多文件且这些文件分属不同功能模块时，缺少检测步骤，会将所有内容合并到同一个输出文件。需要在步骤 0 之后增加多模块检测（步骤 0.5），触发时向用户展示分组并要求选择分别生成或合并。
