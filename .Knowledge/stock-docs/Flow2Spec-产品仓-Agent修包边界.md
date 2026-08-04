# Flow2Spec 产品仓：Agent 修包边界

> **适用范围**：Flow2Spec **npm 包产品开发仓**。  
> **性质**：给人与 Agent 读的**仓库内约定**，写在 `.Knowledge/stock-docs/`；**不**写入 `templates/skills` / `templates/rules`，**不**随 `flow2spec init` 下发到业务项目。

---

## 为什么要这条

在本仓让 Agent「改某个 f2s 能力 / 规则 / CLI」时，若**同时**改 `.cursor/`、`.claude/`、`.codex/`，会与 `templates/`、`lib/` 的改动混在同一批 diff 里，**看不清能力真值到底改了什么**。

配置根内容是 **`flow2spec init` 从 `templates/` 生成的副本**，不是第二套真值源。

---

## Agent 在本仓修能力时必须遵守

1. **只改交付真值源**（按任务需要择子集）：
   - `templates/skills/`、`templates/rules/`、`templates/knowledge/`、`templates/hooks/`
   - `lib/`、`cli.js`
   - `docs/`（用户文档）
   - 本仓 `.Knowledge/`（产品说明、路由、stock-docs，与改包能力可并行）
2. **`templates/` 可下发约束**（会经 `init` 克隆到任意业务仓）：
   - 示例与说明须**中性**：勿写特定业务域（如具体交易/行业模块名）、勿写仅存在于本产品仓的 `docs/` 路径。
   - npm 安装示例用 `npx flow2spec` 或占位，勿写单一组织的 scoped 包名（各仓 `package.json` 的 `name` 由发布方维护）。
3. **禁止改配置根落盘目录**（除非用户**明确**要求「只动某配置根、且与 templates 无关」）：
   - `.cursor/rules/`、`.cursor/skills/`
   - `.claude/rules/`、`.claude/skills/`、`.claude/settings.json` 等
   - `.codex/skills/`、`.codex/topics/`、`.codex/AGENTS.md`
4. **需要 Cursor / Claude / Codex 本地立刻生效时**：在回复摘要中说明「请在本仓执行 `flow2spec init <agents…>`（或 `f2s-kb-upgrade`）」——由**人**触发 init，**禁止** Agent 用改配置根代替改 `templates/`。

---

## 业务用户项目不适用

业务仓库里的 `.cursor/`、`.claude/`、`.codex/` 由该项目的 `init` 维护；用户可在业务仓内正常改配置根。本条**仅约束产品开发仓**。

---

## 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-05-15 | 初版：明确「知识库约定、不改 templates、不修配置根」 |
