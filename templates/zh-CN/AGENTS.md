# flow-spec 项目入口

本文件由 `flow-spec init` 写入仓库根 **`./AGENTS.md`**，作为 Codex 读取的项目入口。**`./.codex/AGENTS.md`** 仅为指针。知识库根目录为 **`./.flow-spec/`**。

## 先做这两步

1. **本轮首次处理当前仓库相关问题时，先读 `./.flow-spec/manifest-routing.json`。**
2. **执行任何 `fs-*` 技能前，先 `Read("flow-spec.config.json")`。**

```text
必须执行：Read(".flow-spec/manifest-routing.json")
必须执行：Read("flow-spec.config.json")  ← 仅在进入 fs-* 技能前
```

禁止在未读 `flow-spec.config.json` 的情况下进入 `fs-*` 技能正文。

## 配置开关（以磁盘为准）

下表只说明字段语义与 `flow-spec init` 写入的默认值；配置真值仍以本轮 `Read("flow-spec.config.json")` 结果为准（用户可能手工改过）。

{{FLOW_SPEC_PROJECT_CONFIG}}

- `subAgent=true` 时，主 agent 必须在技能前段**显式判断一次**本次是否拆子，并说明原因；即使判断不拆，也必须输出不拆原因。`subAgent=false` 时不得拆子 agent。
- `intentRecognition=false` 或字段缺失时，禁止自动进入任何 skill；只能按用户显式触发或当前规则允许的高置信分流进入。

配置细表与补充规则见 **`./.codex/fs-rules/fs-config-check.md`**。

## KB 路由规则

- 机读事实源只认 **`./.flow-spec/manifest-routing.json`** 与其 `matcherPath` 指向的 **`./.flow-spec/matchers/*.json`**。
- 按 `match -> expand -> verify -> act` 执行：主命中后先展开 `topicDependencies`，再检查是否缺关键上下文。
- 仅在以下情况允许跨 matcher 全量补检索：无命中、主次候选过近、缺口检查失败、用户明确要求“全量检查/不要遗漏”。
- `fallbackTopic` 仅作低置信兜底，不能直接作为最终执行依据。

## 普通问答收口门禁

- 普通问答 / 排查 / 解释若需要下钻业务源码，先按 **`./.codex/fs-rules/fs-knowledge-preflight.md`** 执行首读与缺口说明。
- 只要本轮读取过业务源码，且最终答案引用了源码事实，发出答案前必须按 **`./.codex/fs-rules/fs-kb-feedback-closing.md`** 四 case 收口；答案末尾必须显式输出 **`知识库补充建议`** 或 **`知识库已覆盖`**，不得静默省略。
- 已进入 `fs-*` 技能、`implement-tech-design`、`fs-git-commit` 或其他已有后续流程时，不重复追加普通问答收口提示。

## 渐进式读取顺序

1. `./.flow-spec/manifest-routing.json`
2. 命中规则的 `./.flow-spec/matchers/<id>.json`
3. 相关 `./.flow-spec/topics/<topic>.md`
4. 仅在 topic 指向或上下文不足时再读 `./.flow-spec/index.md` / `stock-docs` / `req-docs`
5. 最后才下钻业务代码

禁止跳过 `manifest-routing.json` 直接全仓搜索。
禁止把 `./.flow-spec/stock-docs/` 作为“按方案实现代码”的直接输入。
同一任务线内不要反复全文读取 `manifest-routing.json`，除非用户明确说路由/知识已更新。

## 执行依据

- flow-spec 执行依据只认：
  - 仓库根 **`./AGENTS.md`**
  - **`./.codex/fs-rules/fs-*.md`**
  - **`./.codex/skills/`**
- **`.codex/AGENTS.md`** 仅为目录指针，不能替代根 `AGENTS.md`。

## Codex 规则镜像（按需打开）

这些文件由 `flow-spec init codex` 从规则模板镜像到 `.codex/fs-rules/`。它们不会自动全文加载；当前任务需要细则时再打开。

| 规则 | 路径 | 什么时候读 |
| --- | --- | --- |
| 统一入口 | `./.codex/fs-rules/fs-flow-spec-unified-entry.md` | 执行 `fs-*` 技能、判断 KB 路由 / 子 agent / 校验语义时 |
| 配置前置 | `./.codex/fs-rules/fs-config-check.md` | 核对 `flow-spec.config.json`、`subAgent`、`changeTracking` 细则时 |
| 普通问答首读门禁 | `./.codex/fs-rules/fs-knowledge-preflight.md` | 普通问答要下钻源码前 |
| 普通问答收口 | `./.codex/fs-rules/fs-kb-feedback-closing.md` | 普通问答读取源码后判断是否建议补知识库 |
| 意图识别 | `./.codex/fs-rules/fs-intent-routing.md` | 仅当 `intentRecognition=true`，需要判断是否自动进入 skill 时 |

`implement-tech-design`、`fs-doc-routing` 等长文按命中 topic 再打开，不必默认通读。

## Codex Hooks

`flow-spec init codex` 会写入 **`.codex/hooks.json`**。当前 flow-spec 在 Codex 侧只把 hooks 用于：

- `SessionStart` 配置摘要提醒：`.codex/hooks/fs-config-session.js`
- `SessionStart` 知识库版本检查：`.codex/hooks/fs-update-check.js`

这些 hook 只做提醒 / 检测，不替代 `Read("flow-spec.config.json")` 与 KB 路由门禁。

## flow-spec 技能

可用技能位于 **`./.codex/skills/`**。仅在用户显式触发或当前规则允许自动分流时进入对应 skill。

{{FLOW_SPEC_CODEX_SKILLS_SUMMARY}}
