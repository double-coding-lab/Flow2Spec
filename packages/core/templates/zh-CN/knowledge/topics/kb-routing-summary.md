---
id: kb-routing-summary
revision: 2
summary: "初筛 summary 与 matcher 分片 4 字段(资格/否决门)语义"
primary: feature
confidence: manual
---
# 路由初筛 summary 字段与 matcher 4 字段

## 适用场景

路由初筛命中率、`taskToTopicRules[].summary` 字段语义、rule.summary 同步机制、路由 miss 排查、matcher 分片的 `includeAny` / `includeAll` / `excludeAny` / `excludeAll` 4 字段判定规则、summary/matcher 创作与校验问题。

## 机制

- `taskToTopicRules[].summary` 是初筛阶段的常驻语义锚；初筛证据 = `task` 名 + `summary` + topic id + 依赖 + metadata（`includeAny` 等词表仅在命中后打开的 matcher 分片中）。
- **唯一手写源 = topic frontmatter `summary`**；manifest 侧由 `kb build` 经 `normalizeRoutingWithGraph` 机械同步：多 topic 规则按全角「；」拼接，topic 无 summary 时保留规则既有值不清空。
- 同步点位复用：`kb build` / `kb apply` / `kb status`（drift 检测）三点位走同一函数；手改 manifest 的 `rule.summary` 会被判 routing drift。

## matcher 分片字段语义

matcher 分片(`.Knowledge/matchers/<id>.json`)有 4 个字段参与路由匹配,按「否决门(恒胜) → 资格门(OR ∪ AND)」两级判定:

- **资格门**(至少满足其一才进入候选):
  - `includeAny`:任一短语命中(OR)——最常用
  - `includeAll`:所有短语全部命中(AND)——表达组合词
- **否决门**(任一门命中则整条规则出局,**优先于 `task` 精确命中**):
  - `excludeAny`:任一短语命中(OR)
  - `excludeAll`:所有短语全部命中(AND)——半命中不否决

否决优先于 `task` 精确命中:排除词表达「此请求不属于该任务域」,语义上比精确命中更强。存量分片(仅有 `includeAny`)行为不变。

字段写作规范(何时用 AND / 什么时候上排除词 / 与 12 词阈值的关系)见 `rules/f2s-topic-authoring` 「matcher 分片字段语义」一节。实现:`packages/core/lib/routing.js:match()`;契约测试:`scripts/test-routing-semantics.js`。

### 4 字段填充机制(按需人写,引擎不生成)

- `includeAll` / `excludeAny` / `excludeAll` **无自动填充**——引擎只做透传:`normalizeDeltaMatcher` 在 `kb apply` 写盘时保留 delta 已带字段,`kb build` 不动 matcher 分片,`flow2spec init` 分发的默认分片模板也只有 `includeAny`。
- 赋值的**唯一路径**:用户遇到误路由 / AND 组合词需求 → Agent 依 `f2s-topic-authoring` §3 写作准则手写进对应 `matchers/<id>.json`(或用户直接手工编辑)。
- **无 skill 会主动生成这 3 个字段**——即便用户描述含"排除/避免命中"语义,也需 Agent 观察 + 判断 + 手写,不是自动流程。
- 定位:**逃生舱,不是默认装备**——大部分主题只用 `includeAny` 就够。

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

- 路由引擎:`packages/core/lib/routing.js`(`match` 函数的 4 字段判定 + 打分池合并 + `fallbackTopic` 兜底)。
- 知识引擎:`packages/core/lib/knowledgeEngine.js`(`deriveRoutingOverlayFromGraph.topicSummaries`、`normalizeRoutingWithGraph`、`validateKnowledgeGraph` 的 summary 校验、`normalizeDeltaMatcher` 的 4 字段归一化)。
- CLI:`packages/cli/cli.js` kb check 的 warning 明细输出。
- 契约测试:`scripts/test-routing-semantics.js`(10 组 seam 测试)。
