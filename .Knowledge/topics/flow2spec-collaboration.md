---
id: flow2spec-collaboration
revision: 0
summary: "任务状态本地隔离、共享知识 delta 合入与 revision 冲突处理"
dependsOn: [f2s-task]
primary: feature
confidence: manual
tags: [policy]
---
# Flow2Spec 团队协作

## 适用场景

用于回答 Flow2Spec 多人共用知识库、developerId 任务隔离、kb-delta 合入、topic revision 冲突与团队进度可见性。

## 协作边界

- `.task/<developerId>/` 保存个人 checklist、会话上下文与用户代办，默认不进 Git；Agent 只读写当前 `TASK_ROOT`。
- `.Knowledge/` 保存团队共享事实，随代码通过 Git / PR 评审。
- `collaboration.enabled` 只控制任务根是否按 developerId 分层，不关闭知识库协作。

## 知识合入

- 知识类技能把变更写入当前任务的 `kb-delta.json`，变更类型限于 `appendBody`、`replaceBody`、`updateFrontmatter`、`createTopic`。
- `flow2spec kb plan` 比较 `baseRevisions` 与磁盘 topic revision；匹配时可 apply，不匹配时停止并要求重读最新语义。
- revision 冲突在 plan/apply 阶段处理；文件出现 `<<<<<<<` 时才进入 Git 冲突与 `f2s-kb-merge` 流程。
- 旧 topic 首次接入 revision 流程时执行一次 `flow2spec kb build --fix-topics`，检查 diff 后用 `flow2spec kb check --strict` 验收。

## 团队观察面

团队进度以 PR、commit、`.Knowledge/` diff、`req-docs/` 与项目里程碑为准。`.task/` 是本地过程状态，不作为团队看板。

## 下钻入口

- 中文完整说明：`docs/团队协作.md`
- 英文完整说明：`docs/en/team-collaboration.md`
- CLI 参数与 delta schema：`docs/命令说明.md` / `docs/en/commands-reference.md`
- 任务根细则：`.Knowledge/topics/f2s-task.md`，执行真值见配置根 `rules/f2s-task.*`
