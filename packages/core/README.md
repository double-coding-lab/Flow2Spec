# @double-coding/flow2spec-core

Flow2Spec 的程序化核心能力包，供 CLI 和原生开发工具插件共同使用。

普通用户通常不需要单独安装此包；安装 `@double-coding/flow2spec` 或 Flow2Spec 原生插件时会自动带上对应版本的 Core。

## 原生插件 API

```js
const { createFlow2Spec } = require("@double-coding/flow2spec-core");

const flow2spec = createFlow2Spec({ cwd: process.cwd() });
const skills = flow2spec.resources.skillCatalog({ host: "dsh", locale: "zh-CN" });
const entry = flow2spec.resources.unifiedEntry({
  host: "dsh",
  locale: "zh-CN",
  projectConfig: flow2spec.config.load(),
});
const update = await flow2spec.update.check();
```

- `resources.skillCatalog()` 返回带正文和关联规则资源的结构化 Skill 清单。Core 根据宿主适配规则与 Skill 路径，插件不需要重写其他客户端目录。
- `resources.unifiedEntry()` 返回宿主适配后的统一入口，可附带当前项目配置摘要。
- `update.check()` 复用 `.Knowledge/update-check.json` 的每日缓存与版本比较语义；网络不可用时返回 `unavailable`，不会阻断宿主。
- `capabilities.json` 的 `protocolVersion` 用于插件启动时执行能力兼容校验。

包通过 `index.d.ts` 导出完整公共契约类型。普通 CLI 用户继续使用 `npx @double-coding/flow2spec init`，无需直接调用这些 API。
