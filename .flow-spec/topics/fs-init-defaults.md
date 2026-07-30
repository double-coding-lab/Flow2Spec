# flow-spec-init-defaults（路由摘要）

## 作用

`flow-spec init` 写入项目根 `flow-spec.config.json` 时使用的默认值与字段语义；老项目缺字段时按本表补写。本主题只描述「生产侧」（init 写什么），不涉及「消费侧」（技能执行前如何 Read），后者见 `config-precheck`。

## 默认值的四处一致性

`flow-spec init` 的默认值与字段语义由 npm 包源码四处共同决定，四处必须保持一致：

| 落点 | 角色 | 路径 |
| --- | --- | --- |
| `DEFAULTS` 常量 | `loadFlowSpecConfig` 兜底值，缺字段时回填 | `lib/flowSpecConfig.js` |
| `CONFIG_FIELDS[].default` | init 交互问答按回车的默认值 | `lib/flowSpecConfig.js` |
| 包模板 `flow-spec.config.json` | 新项目首次落盘的整文件模板（按 `locale` 选择） | `templates/{zh-CN,en-US}/flow-spec.config.json` |
| `renderProjectConfigBlock()` | Codex `AGENTS.md` 中字段语义表的「init 默认」列 | `lib/codexAgentsAdapter.js` |

不一致的后果：

- `DEFAULTS` 与 `CONFIG_FIELDS[].default` 不一致 → 交互回车值与「缺字段时实际生效值」不一致，调试时令人困惑。
- `CONFIG_FIELDS[].default` 与模板不一致 → 同一字段在「首次 init」和「老项目补字段 init」两条路径下落盘值不同。
- 包源/模板与 `renderProjectConfigBlock` 不一致 → Codex `AGENTS.md` 表中宣称的「init 默认」与实际落盘值脱节，用户读文档与读 config 看到不同结论。

修改默认值时必须四处同步改；如需追加新字段，按 `CONFIG_FIELDS` 注释要求在该数组追加描述项即可，`cli.js` 会自动对缺失字段发起提问；同时也要在 `renderProjectConfigBlock` 表中追加一行（含「init 默认」列）。

## 字段语义与默认值（与包模板同源）

| 字段 | 类型 | 当前默认值 | 语义 |
| --- | --- | --- | --- |
| `locale` | `"zh-CN"` / `"en-US"` | `"zh-CN"` | 模板语言；决定首次落盘读哪份 `templates/<locale>/` |
| `subAgent` | boolean | `true` | 是否允许技能拆子 agent；`false` 时主 agent 全流程；详见 `fs-flow-spec-unified-entry` |
| `switchAgentVerification` | boolean | `true` | 切换 agent 校验；`true` 且技能正文绑定时启用交叉校验；旧键 `subAgentVerification` 仍兼容 |
| `intentRecognition` | boolean | `true` | 高置信操作意图是否按 `fs-intent-routing` 自动进入对应 `fs-*` 技能 |
| `changeTracking.feat` | boolean | `true` | `fs-kb-feat` 是否走 `.task/` 变更追踪 |
| `changeTracking.fix` | boolean | `false` | `fs-kb-fix` 是否走 `.task/` 变更追踪 |
| `changeTracking.implement` | boolean | `true` | `fs-implement-tech-design` 是否走 `.task/` 变更追踪 |
| `updateCheck.enabled` | boolean | `true` | 是否启用每日版本更新提示 |

「当前默认值」一栏以包模板 `templates/zh-CN/flow-spec.config.json` 为锚，作变更前先核对该文件。

### 默认值变更记录

- **2026-06**：`subAgent` / `switchAgentVerification` / `intentRecognition` 三项默认值由 `false` 翻面为 `true`。新项目 init 默认即开启子 agent 编排、交叉校验与意图识别自动分流。老项目（已写过这三项）不受影响；仅在升级时**仍缺该字段**的老项目会按新默认 `true` 补齐。`changeTracking.fix` 维持 `false`（显式排除翻面）。

## 旧值与字段兼容

`loadFlowSpecConfig` 在解析既有 `flow-spec.config.json` 时做了两类回退：

- **`changeTracking` 顶层布尔**：旧版本可能写 `changeTracking: true` / `false`，会展开为 `{ feat, fix, implement }` 三子项同值，便于一次性升级。
- **`subAgentVerification`（旧键）**：仍读为 `switchAgentVerification` 的值；**新落盘必须用 `switchAgentVerification`**，旧键不再写出。

## 老项目 init 升级路径

`flow-spec init` 在已有 `flow-spec.config.json` 时走 `getMissingConfigFields`：

1. 解析既有文件；非对象或解析失败 → 不打扰，仅做规则与目录骨架对齐。
2. 与 `CONFIG_FIELDS` 比对：
   - 已在文件中（含旧版顶层布尔的 `changeTracking`）→ 跳过，不重复询问、不覆盖用户值。
   - 缺失的字段 → 重新询问（默认值按 `CONFIG_FIELDS[].default`），用户确认后写入。
3. 已有字段的取值**始终不被 init 覆盖**；用户手工改过的值（如把 `false` 改成 `true`）会被保留。

含义：升级 npm 包后新增的字段，会以「当前 `CONFIG_FIELDS` 默认值」补齐到老项目；如新版本默认值翻面（例如某字段由 `false` 改为 `true`），**只影响**升级时**仍缺该字段**的老项目，已写过该字段的项目不变。

### 跑 `fs-kb-upgrade` 时怎么让全局 flow-spec 保持最新

`fs-kb-upgrade` SKILL 的「步骤 -1」（先于一切）**先做前台探测再决定是否升级**：主 agent 顺序跑 `flow-spec --version` + `npm view @double-codeing/flow-spec version` + `command -v npx`，按 3 分支处理：

- **A. 已装且是 latest** → **完全跳过**升级；步骤 2 命令首选 `flow-spec init <agents...>`。
- **B. 已装但落后** → 派**独立子 agent** 后台跑 `npm i -g @double-codeing/flow-spec@latest`（fire-and-forget，不等待，不阻塞主流程）；步骤 2 命令用 `npx @double-codeing/flow-spec@latest init <agents...>` 保证本次拿到 latest 模板。
- **C. 未装 / latest 未知** → 同 B 处理；探测全部失败时可放弃步骤 -1，由 cli.js 兜底。

口径：

- **仅** B/C 时才派子 agent；派子**不受** `flow-spec.config.json.subAgent` 字段约束（全局 npm 装包不属业务拆分范畴）；
- 派子是 fire-and-forget，结果不进入 SKILL 结论摘要——失败也只是"下次再升一次"；
- 与 `cli.js` 内 `maybeAutoUpdateGlobalInstall()` 不冲突：前者是 SKILL 入口按需异步派工，后者是 `init` 收尾兜底；两次都成功就是 no-op。
- 用户自查用 `flow-spec --version`（当前全局版本）和 `flow-spec update`（CLI 内置自更新）。

## init 不动哪些目录

`flow-spec init` 仅对齐：

- 配置根（Claude `.claude/` / Cursor `.cursor/` / Codex `.codex/`）下的 **rules / skills / hooks 模板** 与 SessionStart / PreToolUse 钩子注册；
- 包级 **manifest 路由结构骨架**（`flow-spec init` 通过 `manifest-matchers.json` 作为种子合并 matcher 分片）；
- 项目根 `flow-spec.config.json` 的缺失字段；
- 项目侧 `.flow-spec/manifest-routing.json` 的 `pkgRev` 顶层字段（每次 init 覆盖；详见下节「manifest 中的两个版本字段」）。

`init` **不修改**业务知识库内容：

- `.flow-spec/stock-docs/`、`.flow-spec/req-docs/`
- `.flow-spec/topics/<topic>.md` 的路由摘要正文
- `.flow-spec/matchers/<id>.json` 的 `includeAny` 词条

这些由 `fs-kb-build` / `fs-kb-sync` / `fs-kb-add` / `fs-kb-feat` / `fs-kb-fix` 等 `fs-*` 技能维护。把 `flow-spec init` 当作「业务知识库已更新」是常见误判（见统一入口 2a）。

## manifest 中的两个版本字段

`.flow-spec/manifest-routing.json` 同时存在两个顶层整数字段，对应 `fs-kb-upgrade` 步骤 2c 的两侧：

| 字段 | 语义 | 写入方 |
| --- | --- | --- |
| `projectRev` | **本项目已基线对齐到的包模板修订号** | `fs-kb-upgrade` 完整流程末尾（3b）；首次 init 也按模板写入一次 |
| `pkgRev` | **本次 init 用的包模板修订号** | `flow-spec init`（每次都按当前包模板覆盖） |

人读对照：

- 两值**相等** → 主题层未变，`fs-kb-upgrade` 走快速路径
- `projectRev` 缺失 / `pkgRev` 大于 `projectRev` → 完整流程
- `pkgRev` 缺失 → 包模板自身未声明该字段，SKILL 走兜底完整流程

`fs-kb-upgrade` 步骤 2c 直接 `Read` 同一文件取这两个字段比对。

## 禁止项

- 禁止只改 `lib/flowSpecConfig.js` 的 `DEFAULTS` 或 `CONFIG_FIELDS`、不同步改 `templates/{locale}/flow-spec.config.json` 与 `lib/codexAgentsAdapter.js` 的 `renderProjectConfigBlock`（四处必须同步）。
- 禁止在新落盘中写出旧键 `subAgentVerification`。
- 禁止把 `init` 作为业务知识库同步的入口；新增 / 修改 stock-docs / topics / matchers 走 `fs-*` 技能。
