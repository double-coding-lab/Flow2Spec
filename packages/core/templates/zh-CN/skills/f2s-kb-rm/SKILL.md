---
name: f2s-kb-rm
description: 删除某 stock-docs 文档对应的知识主题与索引映射；触发：删除项目上下文、f2s-kb-rm
---

> 执行口径：仅维护 `.Knowledge`，不改配置根 `rules/skills`。

## 编排（主 / 子 agent）

- 两字段（`subAgent` / `switchAgentVerification`）语义以统一入口为唯一事实源：**Cursor/Claude** 读配置根 `rules/f2s-flow2spec-unified-entry.*`；**Codex** 读 `.codex/topics/f2s-flow2spec-unified-entry.md`（与上同源，`flow2spec init` 镜像）。不在此复述。
- 默认主 agent 全流程执行（单点删除拆子收益低）。
- 拆子阈值：仅当 `subAgent=true` 且**批量删除一次 ≥ 5 主题**时，才拆子执行删除与清引用。
- 主必控：范围确认、`fallbackTopic` 重指。
- 写权硬约束：`manifest-routing.json` 与 `.Knowledge/index.md` 恒由主 agent 落盘。
- 验证：默认落盘侧自验；本 SKILL 不绑定交叉校验。

# 删除文档对应的项目上下文

## 输入

- 一个参数：`.Knowledge/stock-docs/<文件名>.md` 路径，或可匹配文件名片段。

## 执行步骤

1. 读取 `.Knowledge/index.md`，匹配目标文档相关主题。
2. 删除对应 `.Knowledge/topics/<topic>.md` 文件。
3. 从 `.Knowledge/index.md` 移除匹配项并写回。
4. 更新路由清单：
   - `.Knowledge/manifest-routing.json`：移除失效 `topicPaths`、`taskToTopicRules`、`topicDependencies`、`topicMetadata` 引用
   - 对应 `matchers/<matcherId>.json`：移除失效规则或 `includeAny` 词条（与已删 `task`/`matcherId` 对齐）
   - 若删除了 `fallbackTopic`，必须指定新的兜底主题
   - **创作侧准则**：本步会调整 `topicDependencies`（删除被依赖主题或孤儿边），须先 Read `rules/f2s-topic-authoring.*` 全文（**Cursor/Claude**：`rules/f2s-topic-authoring.mdc`；**Codex**：`.codex/topics/f2s-topic-authoring.md`），核对 DAG 与最小化约束后再落盘。

## 输出摘要（必须）

- 已删除的 topic 文件列表
- `.Knowledge/index.md` 删除的条目
- 路由清单调整的字段
- 未执行项（若有）

## 复杂场景示例

用户输入文件名片段「回调」，匹配到 2 个主题文档。

- 先列出两个候选并要求用户确认删除范围，避免误删。
- 删除后同步清理路由清单失效引用；若删到了 `fallbackTopic`，必须先指定新的兜底主题再落盘。
- 最终摘要中写清：删除了哪些 topic、保留了哪些 topic、为什么。

## 约束

- 匹配多义时先询问用户确认。
- 仅删除命中主题，不影响其它主题。
- `manifest-routing.json` 与 `.Knowledge/index.md` 恒由主 agent 落盘（写权硬约束）；范围确认与 `fallbackTopic` 重指不可下放给子 agent。

## 完成后自检

1. 被删 topic 是否仍被 `manifest` 引用（必须为否）。
2. `index` 是否仍存在失效主题路径（必须为否）。
3. `topicMetadata` 是否仍引用已删除 topic（必须为否）。
4. `fallbackTopic` 是否仍有效。
5. 未在低于拆子阈值（< 5 主题）时强行拆子；manifest / index 由主单点落盘。
