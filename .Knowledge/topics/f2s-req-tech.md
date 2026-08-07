---
id: f2s-req-tech
revision: 0
summary: "f2s-req-tech（路由摘要）"
primary: policy
confidence: inferred
---
# f2s-req-tech（路由摘要）

> 长文见配置根 **`skills/f2s-req-tech/SKILL.md`**；本仓模板源见 **`templates/skills/f2s-req-tech/SKILL.md`**。

## 作用

基于已澄清的需求和项目知识库，生成可直接用于实现的技术方案文档，落盘 `.Knowledge/req-docs/`。不限于后端，适用于后端、前端、全栈、移动端、脚本工具等任意场景。

## 适用场景 / 触发词

- 用户触发 `f2s-req-tech`、生成技术方案、技术方案文档。
- 用户完成 `f2s-req-clarify` 后请求出方案。
- 用户提供需求描述或 PRD 路径，要求生成后端技术方案、接口设计、数据模型等。

## 核心规则

1. **澄清前置门禁**：进入撰写前先判定需求是否已澄清；未澄清（有 3+ 未答关键问题 / 含"待定 / 大概 / 我打算"类模糊语，且**不是**从 `f2s-req-clarify` 衔接进入）则**先走 `f2s-req-clarify`**，由 clarify 落盘后自动衔接回本技能同轮继续，不打断用户。
2. **允许的单跳同轮衔接**：`f2s-req-clarify` 澄清文档落盘 → 自动衔接 `f2s-req-tech`（同轮直连）；本技能落盘后**不再**自动衔接 `f2s-req-plan` / `implement-tech-design`。
3. **先读模板**：执行前必须读取 `.Knowledge/template/技术方案模版.md` 作为结构参考。
4. **章节积木原则**：模板章节为可选积木，按需取用；不硬套，不为套模板强行生成无关章节。
5. **交付物与流程合一**：每个交付单元小节内同时写契约（输入/输出）与处理流程，禁止拆章重复。
6. **对齐项目约定**：读取 `.Knowledge/topics/` 和 `stock-docs/` 中相关约定，命名/结构/错误码与现有项目一致。
7. **拆子前置**：`subAgent=true` 时，主 agent 必须先产出「项目约定摘要」（< 80 行，含 6 类条款）方可拆子；未完成前置禁止拆子。
8. **落盘停步**：方案落盘后**只输出一行提示**"技术方案已就绪：`<路径>`；如需继续可用 `f2s-req-plan` / `implement-tech-design`"，然后**停止**；同一轮内不得再自动衔接下一 `f2s-*` 技能，不得追加 `f2s-kb-distill` 收口块（过程编排型技能落盘不触发 distill，见 `rules/f2s-kb-feedback-closing.*` 禁止段）。

## 输出

- 默认路径：`.Knowledge/req-docs/<方案名>_技术方案.md`
- 完成后提示可据此进行代码实现（衔接 `implement-tech-design`）。

## 禁止项

- 禁止未读 `.Knowledge/template/技术方案模版.md` 直接生成文档。
- 禁止在需求含明显未决问题 / 未澄清且非 clarify 衔接进入时直接撰写（应先走 `f2s-req-clarify` 由其自动衔接回本技能）。
- 禁止为套模板强行填写与需求无关的章节（如无消息队列时强行写消息队列章节）。
- 禁止拆章重复描述同一交付单元的流程。
- 禁止臆造与项目不符的约定；不确定时标注「待与项目约定确认」。
- 禁止方案落盘后在同一轮内自动衔接 `f2s-req-plan` / `implement-tech-design`（`f2s-req-clarify` → `f2s-req-tech` 是仅有的允许单跳，方案之后须新一轮触发）。
- 禁止在方案文档尾部或紧随其后追加 `f2s-kb-distill` 收口提示。

## 下一步

- 技能全文：`skills/f2s-req-tech/SKILL.md`
- 模板：`.Knowledge/template/技术方案模版.md`
- 前置澄清：`f2s-req-clarify`
- 实现：`implement-tech-design`（`rules/f2s-implement-tech-design.*`）
