# Core 兼容依赖与独立更新

CLI 通过 caret 范围消费 Core（当前 `^3.8.2`）。Core 的兼容修复和模板更新可独立发布，CLI 调用新 API 时按需提高范围下限并发版。

## 用户路径

- 保留 CLI：`flow2spec update --core` 刷新兼容 Core，并验证实际加载版本。
- 更新 CLI：`flow2spec update --cli` 获取 latest CLI 及其兼容 Core。
- 模板更新后运行 `flow2spec init <agents...>`；按 `projectRev` / `pkgRev` 判断是否需要知识库升级。
- 已安装包与项目锁文件不会随发版静默变化。旧 CLI 的精确依赖需要一次 CLI 更新才能解除。

实现位于 `scripts/workspace-version.js`、`packages/cli/cli.js`；规则摘要见 [Core 包](../topics/flow2spec-core-package.md)，发布门禁见 [发布与部署](../../docs/发布与部署.md)。
