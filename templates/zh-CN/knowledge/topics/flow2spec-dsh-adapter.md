---
id: flow2spec-dsh-adapter
revision: 0
summary: "DeepSeek Harness 项目级技能初始化与目录适配"
primary: feature
confidence: inferred
tags: [module]
---
# DeepSeek Harness 适配

用于 `flow2spec init dsh`、DeepSeek Harness 技能发现、`.dsh/skills`、`.dsh/topics` 和根 `AGENTS.md` 入口问题。

- 技能写入 `.dsh/skills/<skill-name>/SKILL.md`。
- 规则长文镜像到 `.dsh/topics/*.md`，并写入 `.dsh/AGENTS.md` 目录指针。
- 缺少根 `AGENTS.md` 时生成完整入口，已有入口不覆盖。
- 原生 Cordis 插件属于后续路线图事项。
