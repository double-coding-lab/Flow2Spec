---
id: kb-routing-summary
revision: 0
summary: "初筛召回 summary 字段的同步、校验与创作规范"
primary: feature
confidence: manual
---
# 路由初筛 summary 字段（初筛召回锚）

## 适用场景

路由初筛命中率、`taskToTopicRules[].summary` 字段语义、rule.summary 同步机制、路由 miss 排查、summary/includeAny 创作与校验问题。

## 机制

- `taskToTopicRules[].summary` 是初筛阶段的常驻语义锚；初筛证据 = `task` 名 + `summary` + topic id + 依赖 + metadata（`includeAny` 仅在命中后打开的 matcher 分片中）。
- **唯一手写源 = topic frontmatter `summary`**；manifest 侧由 `kb build` 经 `normalizeRoutingWithGraph` 机械同步：多 topic 规则按全角「；」拼接，topic 无 summary 时保留规则既有值不清空。
- 同步点位复用：`kb build` / `kb apply` / `kb status`（drift 检测）三点位走同一函数；手改 manifest 的 `rule.summary` 会被判 routing drift。

## 质量校验（kb check）

- **warning**（`--strict` 才影响结果）：summary 缺失；占位（`<topicId>（路由摘要）` / `routing summary` / TODO / TBD / 待补充 / 占位 / 与 topicId 相同）；超长（含 CJK 时 > 40 字符，纯英文 > 20 词）。
- **issue**（直接失败）：`rule.summary` 非字符串。
- CLI `kb check` 文本输出打印前 10 条 warning 明细。

## 创作与存量修复

- 写法规范（软 30 字 / 硬 40 字、职责 + 用户会问的核心名词、`includeAny` 单概念词优先、落盘前模拟问句自测）以 `f2s-topic-authoring`「初筛召回规范」为准，本 topic 不复述。
- 存量修复走 `f2s-kb-upgrade` 完整流程步骤 3a.7 / 3a.8：`kb build --fix-topics` 补占位头部 → `kb check --strict` 报 summary warning → agent 逐个 Read 正文补写语义摘要 → `kb build` 同步进 `rule.summary`。

## 边界

- `task` 字段保持稳定 id 语义（kb 引擎按 `task` 合并规则），不承载召回语义。
- 禁止手写 manifest 的 `rule.summary`，一律由 `kb build` 生成。
- verify 错命中闸门（命中正文未覆盖问句核心名词时并读次高候选）属统一入口规则条文，见 `rules/f2s-flow2spec-unified-entry`。

## 实现位置

- 引擎：`packages/core/lib/knowledgeEngine.js`（`deriveRoutingOverlayFromGraph.topicSummaries`、`normalizeRoutingWithGraph`、`validateKnowledgeGraph` 的 summary 校验）。
- CLI：`packages/cli/cli.js` kb check 的 warning 明细输出。
- 模板：Template 3.6.0 / projectRev 3 起，双语言 manifest 与 7 个 topic 均带定稿 summary。
