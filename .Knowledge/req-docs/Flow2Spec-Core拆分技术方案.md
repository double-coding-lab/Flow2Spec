# Flow2Spec Core 拆分技术方案

## 需求概述

Flow2Spec 当前以 `@double-coding/flow2spec` 单一 npm 包发布，CLI、初始化、知识库引擎、协作能力、诊断能力、客户端适配器与模板资源均位于同一包内。DeepSeek Harness 原生插件需要在 Harness 进程中直接调用 Flow2Spec 能力，不能依赖启动 CLI 子进程，也不能在插件仓库复制知识库算法、Skills 或模板。

本次改造目标：

- 在当前 Flow2Spec GitHub 仓库内新增 `@double-coding/flow2spec-core` npm 包。
- 保留 `@double-coding/flow2spec` 作为现有 CLI 与传统客户端项目级适配入口。
- 让 CLI 与后续 `@double-coding/flow2spec-plugin-dsh` 共同依赖 Core，复用同一套实现、协议与资源。
- 为项目初始化、知识路由、KB Engine、团队协作、Doctor、Skills/规则资产和能力发现提供稳定的程序化接口。
- 保持现有 CLI 命令、项目目录、配置文件与知识库协议向后兼容。

本次改造范围：

- 当前 Flow2Spec 仓库的 npm workspace、Core 包、CLI 包、测试、构建和发布流程。
- 现有 `lib/` 能力的归属调整与公共 API 封装。
- 供原生插件消费的能力清单、版本契约与资源访问接口。
- 现有 DSH 项目级适配继续保留，作为未安装原生插件时的兼容接入方式。

本次不包含：

- 不在当前仓库实现 Cordis Plugin、Harness Tools、Hooks、Service 或 Web UI。
- 不在 Core 中依赖 `@deepseek-ai/cordis` 或其他 Harness 专用包。
- 不改变 `.Knowledge/`、`.task/`、`flow2spec.config.json` 的项目级数据标准。
- 不在本次拆分中批量重写现有 Skills 的业务流程。
- 不自动发布 DSH 插件；插件在独立仓库规划和发布。

## 重点问题概述

### 单一实现来源

Core 是初始化、知识库操作、协作状态、诊断、路由资源与 Flow2Spec 资产的唯一实现来源。CLI 和原生插件只负责各自运行环境中的参数、交互、展示和生命周期集成。

### 兼容现有 CLI

现有用户继续使用：

```bash
npx @double-coding/flow2spec@latest init
flow2spec config
flow2spec doctor
flow2spec kb status
flow2spec kb check --strict
flow2spec kb plan <delta-file>
flow2spec kb apply <delta-file>
flow2spec kb build
```

命令名称、主要参数、退出码、默认目录和非破坏式初始化语义保持兼容。CLI 改为 Core 的薄适配层，不再承载业务逻辑。

### 插件进程安全

Core 被 Harness 进程加载时必须满足：

- 导入模块不会读取 `process.argv`。
- 导入模块不会调用 `process.exit()`。
- 核心操作不会直接执行交互式问答。
- 核心操作默认不向 stdout/stderr 输出内容。
- 写操作显式接收 `cwd`、参数和选项，并返回结构化结果。
- 可通过 `AbortSignal` 和进度回调接入宿主生命周期；当前同步操作至少在阶段边界检查取消状态。

### 模板与包路径

当前 `lib/init.js`、`lib/doctor.js` 和部分适配器通过相对路径读取仓库根 `package.json` 与 `templates/`。拆包后必须由 Core 内部的资源解析器统一定位自身包内资源，禁止依赖调用方的当前工作目录或 CLI 包目录。

### 完整能力同步

“插件包含 Flow2Spec 全部功能”通过 Core 能力清单和契约测试保证，不在插件仓库维护人工复制的功能列表。新增或变更 Core 能力时，能力清单与兼容性测试必须同步更新。

## 架构决策

### 仓库与 npm 包结构

当前仓库调整为 npm workspaces：

```text
Flow2Spec/
├── package.json                         # 私有 workspace 根、统一测试与发布脚本
├── packages/
│   ├── core/
│   │   ├── package.json                 # @double-coding/flow2spec-core
│   │   ├── index.js                     # 稳定公共入口
│   │   ├── lib/
│   │   │   ├── project/
│   │   │   ├── knowledge/
│   │   │   ├── collaboration/
│   │   │   ├── diagnostics/
│   │   │   ├── integrations/
│   │   │   └── resources/
│   │   ├── templates/
│   │   └── capabilities.json
│   └── cli/
│       ├── package.json                 # @double-coding/flow2spec
│       ├── cli.js                       # flow2spec bin
│       └── lib/
│           ├── commands/
│           ├── prompts/
│           └── formatters/
├── scripts/
├── tests/
├── docs/
├── website/
└── .Knowledge/
```

约束：

- Core 与 CLI 同仓维护、同一 PR 修改、同一 CI 验证。
- Core 和 CLI 首阶段采用相同版本号并在一次 Release 中依次发布。
- CLI 对 Core 使用精确版本依赖，避免 CLI 安装到不匹配的 Core。
- 插件使用经过验证的 Core 兼容范围，并在锁文件中锁定实际版本。
- workspace 根设为 `private: true`，防止误发布根包。

### 包职责

| 能力 | Core | CLI | DSH 插件仓库 |
| --- | --- | --- | --- |
| `.Knowledge` 协议与读写 | 负责 | 调用 | 调用 |
| 初始化与升级底层操作 | 负责 | 参数/问答适配 | Harness 操作/UI 适配 |
| 知识路由与依赖展开 | 负责 | 展示结果 | 运行时调用与门禁 |
| KB plan/apply/build/check/status | 负责 | 命令适配 | Tool/Service 适配 |
| developerId 与 TASK_ROOT | 负责 | 展示 | 会话状态集成 |
| Doctor 检查 | 负责 | 文本/JSON 格式化 | Harness 诊断视图 |
| Skills、规则与模板资产 | 负责 | 安装到配置根 | 原生注册或加载 |
| Cursor/Claude/Codex 项目适配 | 可复用适配器 | 触发 | 不负责 |
| DSH `.dsh/skills` 兼容适配 | 可复用适配器 | 触发 | 原生插件安装后不重复执行 |
| Cordis 生命周期与 Hooks | 不依赖 | 不负责 | 负责 |
| Harness Web UI | 不依赖 | 不负责 | 负责 |
| npm 自更新交互 | 不负责 | 负责 | 使用 DSH 插件升级机制 |

### 现有功能覆盖矩阵

拆包验收以当前 Flow2Spec 的实际能力为基线。每项能力必须明确归入 Core API、Core 资源或 CLI/宿主适配层，禁止在迁移时静默删除。

| 能力组 | 当前能力 | 拆分后归属 |
| --- | --- | --- |
| 项目生命周期 | `init`、配置补齐、locale、非破坏式模板对齐、`.gitignore`、版本字段 | Core `project` / `config` |
| CLI 管理 | `version`、`update`、全局包升级提示、TTY 问答 | CLI；版本信息由 Core 提供只读接口 |
| 诊断 | `doctor`、Node/配置/集成/协作/知识图检查 | Core `doctor`；CLI/插件负责展示 |
| KB Engine | `status`、`check`、`plan`、`apply`、`build`、`--strict`、`--fix-topics`、`--dry-run` | Core `knowledge` |
| 知识路由 | manifest、matcher、topic dependencies、fallback、`match -> expand -> verify -> act` | Core `routing` + Core 规则资源 |
| 团队协作 | developerId、TASK_ROOT、个人任务隔离、kb-delta、revision 冲突 | Core `collaboration` / `knowledge` + Skills |
| 客户端适配 | Cursor、Claude、Codex、DSH 项目级目录、入口、规则、Skills、Hooks | Core integrations/resources；CLI 触发 |
| 文档工作流 | `f2s-doc-arch`、`f2s-doc-final`、`f2s-doc-milestone`、`f2s-doc-pdf` | Core Skills/规则/模板资源；宿主 Agent 执行 |
| 需求工作流 | `f2s-req-clarify`、`f2s-req-tech`、`f2s-req-plan`、`implement-tech-design` | Core Skills/规则/模板资源；宿主 Agent 执行 |
| 知识维护 | `f2s-kb-add`、`f2s-kb-addRules`、`f2s-kb-build`、`f2s-kb-distill`、`f2s-kb-feat`、`f2s-kb-fix`、`f2s-kb-merge`、`f2s-kb-migrate`、`f2s-kb-rm`、`f2s-kb-sync`、`f2s-kb-upgrade` | Core Skills/规则资源调用 Core API |
| Git 收口 | `f2s-git-commit`、知识覆盖检查和提交口径 | Core Skill/规则资源；Git 操作由宿主执行 |
| 意图与编排 | intent recognition、subAgent、switchAgentVerification、changeTracking | Core 配置/规则/Skills；宿主提供 Agent 能力 |
| 版本检查 Hooks | SessionStart、PreToolUse、更新检测脚本 | Core Hook 资源与客户端适配；DSH 插件使用原生生命周期 |

Skills 属于 Flow2Spec 的核心产品能力，但它们是宿主 Agent 执行的工作流资产，不应被错误改写为纯 JavaScript 函数。Core 同时提供资源发现、版本、校验和与所需底层 API，CLI 和插件负责在各自宿主中加载并执行这些工作流。

## Core 公共契约

### 公共入口

Core 使用 CommonJS 并兼容 Node.js >= 16，公共入口只暴露经过承诺的 API：

```js
const {
  createFlow2Spec,
  getCapabilities,
  Flow2SpecError,
} = require("@double-coding/flow2spec-core");

const flow2spec = createFlow2Spec({
  cwd,
  signal,
  onProgress(event) {},
});
```

`createFlow2Spec()` 返回按领域组织的门面：

```js
flow2spec.project
flow2spec.config
flow2spec.routing
flow2spec.knowledge
flow2spec.collaboration
flow2spec.doctor
flow2spec.resources
```

Core 内部文件不作为公共契约。CLI、插件和外部调用方不得继续使用 `require(".../lib/<file>")` 深路径导入。

### 通用调用上下文

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `cwd` | `string` | 必填，目标项目绝对路径 |
| `signal` | `AbortSignal?` | 宿主取消信号 |
| `onProgress` | `(event) => void` | 可选进度通知，不承载业务返回值 |
| `locale` | `zh-CN \| en-US` | 可按单次操作覆盖项目默认语言 |

进度事件使用稳定结构：

```js
{
  operation: "project.init",
  phase: "write-templates",
  status: "start" | "complete" | "skip",
  detail: {}
}
```

### 错误契约

Core 统一抛出 `Flow2SpecError`：

```js
{
  name: "Flow2SpecError",
  code: "F2S_KNOWLEDGE_CONFLICT",
  message: "...",
  details: {},
  recoverable: true
}
```

首批稳定错误类型：

| 错误码 | 说明 | 调用方处理 |
| --- | --- | --- |
| `F2S_INVALID_ARGUMENT` | 参数或调用契约错误 | CLI 返回 1；插件展示配置错误 |
| `F2S_CONFIG_INVALID` | 项目配置无法解析 | 提示修复配置，不自动覆盖 |
| `F2S_NOT_INITIALIZED` | 项目未初始化 | 引导调用 `project.init` |
| `F2S_KNOWLEDGE_INVALID` | 知识图严格校验失败 | 展示 issues/warnings |
| `F2S_KNOWLEDGE_CONFLICT` | revision 或 delta 冲突 | 停止 apply，要求重读 |
| `F2S_OPERATION_ABORTED` | 宿主取消操作 | CLI/插件安静结束当前操作 |
| `F2S_RESOURCE_MISSING` | 包内模板或资产缺失 | 阻止写入并报告包完整性错误 |

Core 不把 CLI 退出码写入错误对象；退出码由 CLI 命令适配器决定。

## 交付单元

### Core 项目初始化

公共契约：

```js
await flow2spec.project.init({
  integrations: ["cursor", "claude", "codex", "dsh"],
  mode: "project-adapter" | "native-host",
  resetKnowledge: false,
  configValues: {},
  locale: "zh-CN",
});
```

处理规则：

- `project-adapter` 保持当前 `flow2spec init <agent...>` 行为，写入对应配置根、Skills、规则、入口与 Hooks。
- `native-host` 只初始化共享项目层：`.Knowledge/`、`flow2spec.config.json`、`.gitignore`、路由结构、模板快照和版本字段。
- `native-host` 不写 `.dsh/skills`、`.dsh/topics` 或 DSH 入口；这些由原生插件注册。
- 已有配置与业务知识继续采用非破坏式补齐，只有明确 `resetKnowledge` 时覆盖模板承载部分。
- 返回 `changedFiles`、`skippedFiles`、`warnings`、`projectConfig`、`routingUpgrade` 和资源版本。

迁移来源：现有 `lib/init.js`、`lib/agents.js`、各客户端适配器和 `templates/`。

### 配置与项目状态

公共契约：

```js
flow2spec.config.load();
flow2spec.config.getMissingFields();
flow2spec.collaboration.resolveDeveloper();
flow2spec.project.inspect();
```

处理规则：

- 保留旧版 `changeTracking` 布尔值和 `subAgentVerification` 兼容解析。
- 默认值继续以代码、双语模板和生成说明四处一致为门禁。
- `resolveDeveloper()` 保持 config -> git -> legacy 的解析顺序。
- `project.inspect()` 只读返回初始化状态、现有集成、知识库版本和资源版本。

迁移来源：`lib/flow2specConfig.js`、`lib/developerId.js`。

### 知识路由

公共契约：

```js
const result = flow2spec.routing.match({
  request: "<用户请求>",
  task: "<可选稳定任务名>",
});

flow2spec.routing.expand(result);
flow2spec.routing.verify(result, { requiredContext: [] });
flow2spec.routing.loadContext(result, { maxFiles, maxLines });
```

返回内容至少包含：

- 主候选与次候选。
- 命中的 task rule、matcher、关键词和置信度依据。
- 展开后的 `topicDependencies`。
- 缺失 topic、matcher、文档或必要上下文。
- `fallbackTopic` 是否仅作为低置信兜底。
- 建议读取的文件列表，不直接把整个仓库内容注入宿主。

匹配规则必须确定化并提供测试夹具：稳定 task 映射优先，其次 matcher phrase 命中；无法确定时返回低置信结果，由宿主模型执行澄清，不在 Core 中伪造语义理解。

### Knowledge Engine

公共契约：

```js
flow2spec.knowledge.status();
flow2spec.knowledge.check({ strict: true });
flow2spec.knowledge.plan({ deltaFile });
flow2spec.knowledge.apply({ deltaFile, dryRun: false });
flow2spec.knowledge.build({ fixTopics: false, dryRun: false });
```

处理规则：

- 保留现有 topic frontmatter、revision、delta schema 和 routing drift 语义。
- `apply` 写入前必须复用 `plan` 的 revision 校验。
- 所有写操作返回精确变更文件，不打印日志。
- Core 继续提供低层文档解析函数，但只在明确的高级导出下暴露，避免插件直接拼接 Markdown。

迁移来源：`lib/knowledgeEngine.js`。

### Skills、规则与模板资源

公共契约：

```js
flow2spec.resources.listSkills();
flow2spec.resources.getSkill("f2s-kb-sync", { locale: "zh-CN" });
flow2spec.resources.listRules();
flow2spec.resources.getTemplate("knowledge/template/技术方案模版.md");
flow2spec.resources.getManifestSeed();
```

处理规则：

- Skills、规则、Hooks、知识模板和双语资源随 Core 包发布。
- CLI 的客户端适配器从 Core 资源接口读取，不自行维护副本。
- DSH 插件通过资源接口注册或调用完整 Skills，不复制模板到插件仓库作为第二真值源。
- 资源接口返回内容、校验和、locale、资源修订号和来源路径标识。
- 包内资源路径只由 Core 资源解析器处理。

### Doctor

公共契约：

```js
const report = await flow2spec.doctor.run({
  strictKnowledge: true,
  integrations: "detected",
});
```

处理规则：

- Doctor 保持只读、离线和确定性。
- Core 返回结构化报告，不负责 `[PASS]`、`[WARN]`、`[FAIL]` 文本格式。
- CLI 保持现有人读格式和 `--json` 格式。
- 插件可以增加 Harness 专属检查，但不能修改 Core 通用报告含义。

迁移来源：`lib/doctor.js`。

### 能力清单

`packages/core/capabilities.json` 为客户端能力对齐的机读契约：

```json
{
  "schema": "flow2spec.capabilities.v1",
  "protocolVersion": 1,
  "capabilities": [
    { "id": "project.init", "api": "project.init", "since": "3.3.0" },
    { "id": "routing.match", "api": "routing.match", "since": "3.3.0" },
    { "id": "knowledge.check", "api": "knowledge.check", "since": "3.3.0" },
    { "id": "knowledge.plan", "api": "knowledge.plan", "since": "3.3.0" },
    { "id": "knowledge.apply", "api": "knowledge.apply", "since": "3.3.0" },
    { "id": "collaboration.resolve", "api": "collaboration.resolveDeveloper", "since": "3.3.0" },
    { "id": "doctor.run", "api": "doctor.run", "since": "3.3.0" },
    { "id": "resources.skills", "api": "resources.listSkills", "since": "3.3.0" }
  ]
}
```

规则：

- 新增、删除或改变稳定能力时必须更新能力清单。
- Core CI 校验清单中的 API 实际存在。
- CLI CI 校验需要命令映射的能力均已映射。
- DSH 插件 CI 读取清单并维护 `implemented`、`native`、`notApplicable` 三态覆盖结果。
- `notApplicable` 必须写明原因，禁止用它掩盖未实现功能。

### CLI 薄适配层

CLI 只保留：

- `process.argv` 解析。
- TTY 交互问答。
- 人读与 JSON 输出格式化。
- Core 错误到退出码的映射。
- npm registry 查询、全局更新和版本提示。

CLI 不再直接读取或写入 `.Knowledge`，不再直接拼装 delta，不再直接解析包内模板。

`@double-coding/flow2spec` 的 `bin.flow2spec`、README 安装命令和现有 npm 包名保持不变。

## 版本与发布

### 版本策略

- Core 与 CLI 首阶段锁步版本，例如 `3.3.0` 与 `3.3.0`。
- CLI 使用精确依赖：`"@double-coding/flow2spec-core": "3.3.0"`。
- 插件使用经过测试的兼容范围，例如 `^3.3.0`，并提交 lockfile。
- `protocolVersion` 独立于 npm 版本；项目知识协议发生不兼容变化时递增。
- 仅新增 Core API 且 CLI 行为兼容时可发布 minor；修改现有 CLI 契约、公共 API 或协议时按 breaking change 管理。

### 发布顺序

1. 运行 workspace 全量测试和 pack 安装测试。
2. 发布 `@double-coding/flow2spec-core@<version>`。
3. 验证 registry 可安装并执行公共入口 smoke test。
4. 发布依赖该精确版本的 `@double-coding/flow2spec@<version>`。
5. 创建统一 Git tag 和 GitHub Release。

发布脚本不得再假设仓库根 `package.json` 就是唯一待发布包。Tag 仍以统一产品版本生成，发布日志同时列出 Core 与 CLI 包。

## 迁移顺序

### 阶段一：建立契约与 workspace

- 建立 `packages/core`、`packages/cli` 和 workspace 根。
- 添加公共 API、错误类型、能力清单 schema 与空门面。
- 建立 packed-package smoke test，验证 Core 可独立导入且无控制台输出、无进程退出。

### 阶段二：迁移纯 Core 模块

- 迁移 `knowledgeEngine`、`flow2specConfig`、`developerId`、`doctor`。
- 保留现有返回结构，并通过兼容测试锁定行为。
- 将 Doctor 文本格式化移动到 CLI。

### 阶段三：迁移初始化与资源

- 将模板移入 Core 包。
- 增加资源解析器，移除对仓库根相对路径的依赖。
- 拆分共享项目初始化与客户端配置根安装。
- 保留 DSH 项目级适配兼容模式。

### 阶段四：增加知识路由 API

- 实现 task rule、matcher、依赖展开和缺口检查的确定性 API。
- 以当前 `manifest-routing.json` 和 matcher schema 建立测试夹具。
- 保持 `fallbackTopic` 只作为低置信兜底。

### 阶段五：CLI 切换到 Core

- 每个 CLI 子命令逐一改为调用 Core。
- 删除 CLI 中重复的知识库和初始化逻辑。
- 对照旧版本执行输出、退出码和文件树回归测试。

### 阶段六：发布链与插件对接门禁

- 调整版本、Tag、npm pack 和发布脚本。
- 发布 prerelease 验证两个 npm 包的安装关系。
- 输出插件仓库可消费的 API 文档、能力清单和兼容矩阵模板。

每个阶段必须保持 `main` 可测试；不使用一次性“大搬家”提交跨越全部阶段。

## 异常处理与兼容策略

| 场景 | 处理策略 |
| --- | --- |
| Core 资源缺失 | 初始化前失败，不写入部分项目文件 |
| CLI 与 Core 版本不一致 | CLI 启动时报告包不匹配并停止写操作 |
| 插件请求未知能力 | 返回能力不存在，插件不得静默降级为自实现 |
| 老项目缺新增配置 | 沿用当前缺字段补齐机制，不覆盖已有值 |
| 旧 topic 缺 revision | 保持 `kb build --fix-topics` 迁移路径 |
| delta revision 冲突 | plan/apply 停止，返回结构化冲突信息 |
| 原生插件未安装 | `flow2spec init dsh` 项目级适配继续可用 |
| 原生插件已安装 | 插件使用 `native-host` 初始化，不重复写 `.dsh` 兼容产物 |
| Core 操作被取消 | 抛出 `F2S_OPERATION_ABORTED`，已完成的原子文件写入保留并在结果中报告 |

## 测试与验收

### Core 单元测试

- 所有现有 knowledge engine、developerId、config 和 Doctor 用例迁移后继续通过。
- Core 导入不读取 argv、不退出进程、不产生 stdout/stderr。
- 每个写操作在临时目录验证变更文件与非目标文件。
- 中英文资源目录和技能清单保持一致。
- 能力清单中的每个 API 都可解析并调用。

### CLI 兼容测试

- `--help`、`version`、`config`、`doctor`、`kb`、`init` 命令回归。
- 人读与 JSON 输出字段保持兼容。
- PASS/WARN/FAIL 对应退出码保持兼容。
- `npx @double-coding/flow2spec init` 仍创建预期目录和配置根。
- `init dsh` 兼容用例继续通过。

### 包测试

- 对 Core 与 CLI 分别执行 `npm pack --dry-run`。
- 在空临时目录安装两个 tgz，禁止依赖仓库内未打包文件。
- 只安装 CLI 时能够自动安装 Core 并执行全部命令。
- 只安装 Core 时能够通过公共 API 初始化临时项目。
- 包内不包含 `.task/`、配置根产物或开发期临时文件。

### 行为等价测试

同一测试夹具分别通过旧版行为快照和新 Core/CLI 执行，比较：

- 初始化后的文件树和关键文件内容。
- 配置缺省值与旧键兼容结果。
- knowledge status/check/plan/apply/build 结果。
- Doctor 结构化报告。
- developerId 和 TASK_ROOT 解析。

允许差异必须在迁移记录中列明，不能以“重构”为由接受未解释差异。

### 完成标准

- `@double-coding/flow2spec-core` 可独立打包、安装和调用。
- `@double-coding/flow2spec` 所有命令通过 Core 执行。
- 当前 Flow2Spec 自动化测试全部迁移并通过。
- DSH 项目级适配未回归。
- 能力清单覆盖初始化、路由、KB Engine、协作、Doctor 和资源访问。
- 文档说明普通用户无需单独安装 Core。
- Core 不含 Harness 运行时依赖。
- 插件仓库无需复制 Core 算法、Skills、规则或模板即可开始开发。

## 风险与取舍

### workspace 改造影响发布脚本

当前版本与 Tag 脚本只读取仓库根 `package.json`。改造时必须先补多包 pack/release 测试，再调整正式发布流程，避免只发布其中一个包。

### 模板移动造成路径回归

初始化代码存在基于 `__dirname` 和仓库根的模板路径假设。迁移采用资源解析器并通过 tgz 安装测试验证，不能只在源码仓库内运行测试。

### 公共 API 过早固化

首个 Core 版本只承诺门面 API、错误契约和能力清单。底层 Markdown 解析、文件帮助函数保持内部实现，减少未来兼容负担。

### 路由能力与模型语义边界

Core 负责确定性的 task/matcher 匹配、依赖展开和缺口报告；自然语言歧义和低置信澄清由宿主 Agent 完成。Core 不内置模型调用，不绑定模型供应商。

### 双入口并存

原生插件发布后，`init dsh` 仍作为项目级兼容入口保留一段迁移周期。文档必须明确两种方式的适用场景，Doctor 应能检测重复接入并给出非破坏性建议。
