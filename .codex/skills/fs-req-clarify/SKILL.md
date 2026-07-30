---
name: fs-req-clarify
description: 针对 PRD/需求反问直到清楚，再可用 fs-req-tech 出技术方案；触发：需求澄清、PRD 澄清
---

## 编排（主 / 子 agent）

- `subAgent` / `switchAgentVerification` 两字段语义以统一入口为唯一事实源：**Cursor/Claude** 读配置根 `rules/fs-flow-spec-unified-entry.*`；**Codex** 读 `.codex/fs-rules/fs-flow-spec-unified-entry.md`（与上同源，`flow-spec init` 镜像）。本技能不复述。
- 本技能默认**不拆子**：无论 `subAgent` 真值，澄清流程全程在主会话进行（追问与用户对齐强依赖连续同会话，拆子必断上下文）。
- 校验口径为**落盘侧自验**，本技能不绑定交叉校验。

# 需求澄清

> 执行口径：澄清文档统一落盘到 `.flow-spec/req-docs/`。

**入参**：可选。PRD 全文、需求描述或文档路径（如 `.flow-spec/req-docs/xxx.md`）；不传则按当前对话内容澄清。后续回复可补需求条件。

**行为**：找出需求中的模糊表述、未定义概念、缺失信息、矛盾、与实现相关但未说明的点 → 分组、具体可答地反问 → 根据回答迭代追问，直到流程、边界、异常、关键概念无歧义。不替用户做业务假设，不清楚就问。

**结束**：当信息已足够清晰时，必须输出一份可直接落盘的「需求澄清文档」（Markdown）。文档至少包含：背景与目标、范围（包含/不包含）、关键流程、边界与异常、关键概念定义、验收标准、未决问题（如有）。建议保存到 `.flow-spec/req-docs/`。输出完文档后，再提示使用 `fs-req-tech` 生成技术方案，供后续代码实现。
