# @double-coding/flow2spec-core

Flow2Spec 的程序化核心能力包，供 CLI 和原生开发工具插件共同使用。

普通用户通常不需要单独安装此包；安装 `@double-coding/flow2spec` 或 Flow2Spec 原生插件时会自动带上对应版本的 Core。

## 原生插件 API

```js
const { createFlow2Spec, getVersions } = require("@double-coding/flow2spec-core");

const flow2spec = createFlow2Spec({ cwd: process.cwd() });
const skills = flow2spec.resources.skillCatalog({ host: "dsh", locale: "zh-CN" });
const entry = flow2spec.resources.unifiedEntry({
  host: "dsh",
  locale: "zh-CN",
  projectConfig: flow2spec.config.load(),
});
const update = await flow2spec.update.check();
const versions = getVersions();
```

- `resources.skillCatalog()` 返回带正文和关联规则资源的结构化 Skill 清单。Core 根据宿主适配规则与 Skill 路径，插件不需要重写其他客户端目录。
- `resources.unifiedEntry()` 返回宿主适配后的统一入口，可附带当前项目配置摘要。
- `project.agents()` 返回可用于 `project.init()` 的客户端集成元数据；`config.supportedLocales()` 返回包内模板语言列表。
- `getVersions()` 返回独立的 Core、Template 与 Protocol Version。
- `update.check()` 复用 `.Knowledge/update-check.json` 的每日缓存，分别返回 Core 与 Template 更新状态；网络不可用时返回 `unavailable`，不会阻断宿主。
- `capabilities.json` 的 `protocolVersion` 用于插件启动时执行能力兼容校验。

包通过 `index.d.ts` 导出完整公共契约类型。普通 CLI 用户继续使用 `flow2spec init`（全局安装 `@double-coding/flow2spec` 后），无需直接调用这些 API。
