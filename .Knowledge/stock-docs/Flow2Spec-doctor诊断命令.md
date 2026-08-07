# Flow2Spec Doctor 诊断命令

## 定位

`flow2spec doctor` 是面向 Flow2Spec 使用者的只读项目体检入口，用于把分散的环境、初始化、协作和知识库检查汇总成一份可操作报告。首版不提供 `--fix`，不调用网络，也不修改任何项目文件。

## 命令契约

```bash
flow2spec doctor
flow2spec doctor --json
flow2spec doctor --help
```

- 普通输出逐项显示 `[PASS]`、`[WARN]`、`[FAIL]`，异常项附修复建议。
- `--json` 输出 `ok`、包信息、当前目录、汇总计数和检查明细，适合脚本或 CI 消费。
- 警告不阻塞，退出码为 `0`；存在错误时退出码为 `1`。
- 未知参数直接报错并返回 `1`。

## 检查范围

1. 当前 Node.js 是否满足 `package.json` 的 `engines.node`。
2. 项目根 `flow2spec.config.json` 是否存在且可解析。
3. 根 `AGENTS.md` 与 `.Knowledge/manifest-routing.json` 是否存在。
4. 已存在的 Agent 配置根是否完整：Codex 检查 `.codex/AGENTS.md`、`.codex/hooks.json`；Claude 检查 `.claude/settings.json`；Cursor 检查 `.cursor/hooks.json`。项目没有任何 Agent 配置根时只警告。
5. 复用 `resolveDeveloperContext` 输出实际 `developerId`、解析来源和 `TASK_ROOT`；无身份回退 legacy `.task/` 时警告。
6. 根 `.gitignore` 是否显式忽略 `.task/`。
7. 复用 knowledge engine 做严格知识图校验，并检查 topic revision 与 topic frontmatter 到 routing 元数据的漂移。

## 实现边界

- CLI 分发和参数校验位于 `cli.js`，诊断逻辑与文本格式化位于 `lib/doctor.js`。
- `lib/doctor.js` 允许测试注入 Node 版本、Git 身份与知识库检查，避免测试依赖开发机全局状态。
- doctor 只读取项目根已存在的文件；修复动作由用户根据建议显式执行。
- 旧 topic 缺 `revision` 属严格知识库错误，建议执行 `flow2spec kb build --fix-topics` 后再运行 `flow2spec kb check --strict`。
- 首版不检查 npm registry 或全局旧包 `@double-codeing/flow2spec`，保持诊断快速、离线、确定。

## 文档入口

- 中文：`docs/命令说明.md` 的 `flow2spec doctor` 章节
- English: `docs/en/commands-reference.md`, `flow2spec doctor`

