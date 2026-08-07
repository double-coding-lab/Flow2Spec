---
id: f2s-git-commit
revision: 0
summary: "f2s-git-commit（路由摘要）"
primary: policy
confidence: manual
---
# f2s-git-commit（路由摘要）

> 长文见配置根 **`skills/f2s-git-commit/SKILL.md`**；本仓模板源见 **`templates/skills/f2s-git-commit/SKILL.md`**。

## 作用

提交代码时统一执行 Git 提交流程：读取变更、检查冲突、按实际 diff 生成提交信息、精确 add 文件并执行 `git commit`。默认模式会检查知识库覆盖；快捷提交模式只跳过这一步。

## 适用场景 / 触发词

- 用户触发 `f2s-git-commit`、`git commit`、提交代码、帮我提交。
- 用户明确说“快捷提交”“快速提交”或 “quick commit”。
- 用户询问提交流程、知识库覆盖检查、`--no-verify`、`git add -A` 等提交流程约束。

## 核心规则

1. **默认模式**：步骤 2 必须检查知识库覆盖，从 `git diff HEAD` 与 untracked 文件推断能力模块，并对照 `.Knowledge/topics/` 与 `.Knowledge/stock-docs/`。
2. **快捷提交模式**：仅当用户本轮明确说“快捷提交”“快速提交”或 “quick commit” 时，跳过步骤 2 知识库覆盖检查。
3. 快捷提交不跳过变更读取、merge conflict 标记检查、提交信息首行展示、精确 `git add <文件列表>`、正常 `git commit` 和 git hooks。
4. 提交信息首行必须展示后再 commit，格式为 `<emoji> <type>[(scope)]: <简述>`。

## 禁止项

- 禁止因为快捷提交而使用 `git add -A` 或 `git add .`。
- 禁止因为快捷提交而使用 `--no-verify` 跳过 hooks。
- 禁止自动 push。
- 禁止为 commit 静默执行 `git pull` / `git pull --rebase`；涉及拉取必须先取得用户明确确认。

## 下一步

- 技能全文：`skills/f2s-git-commit/SKILL.md`
- 模板源：`templates/skills/f2s-git-commit/SKILL.md`
- 命令说明：`docs/命令说明.md`
