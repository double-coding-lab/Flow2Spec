---
description: Intent recognition: high-confidence operational intent automatically enters the corresponding f2s-* Skill, controlled by the intentRecognition switch
alwaysApply: true
---

# f2s Intent Routing

## Preflight

**Before applying this rule, read `flow2spec.config.json`:**

- `intentRecognition: true` -> continue with this rule
- `intentRecognition: false` or missing field -> **skip all logic in this rule** and do not make any automatic invocation

## Priority

1. An explicit user `$f2s-*` command has the highest priority; execute the explicit command.
2. If the user clearly says "only discuss / don't change yet / don't execute / evaluate first / discuss the plan first", do not auto-invoke any Skill.
3. If an `f2s-*` flow is already in progress, stay in the current flow; do not automatically switch to another flow unless the user explicitly says "stop the current flow and switch to X".
4. **Incomplete requirements block auto-entering write-phase skills**: If the user asks for code changes but the requirement is incomplete, prefer `f2s-req-clarify`; do not directly enter `f2s-kb-feat` / `f2s-kb-fix`. Likewise, if the user asks to "draft a design / generate technical design" while the requirement still has clear open questions, prefer `f2s-req-clarify`; **do not** directly enter `f2s-req-tech`. If the user asks to "break down tasks / implement" but the design has not been written to disk yet, prefer `f2s-req-tech`; **do not** directly enter `f2s-req-plan` / `implement-tech-design`.
5. **Process-orchestration skills do not auto-chain to the next skill within the same turn (one allowed single-hop exception)**: After `f2s-req-clarify` / `f2s-req-tech` / `f2s-req-plan` / `f2s-doc-*` writes its deliverable to disk, **this turn** by default outputs only a one-line "document ready + next-step pointer" hint and stops; **the next skill must be explicitly triggered by the user in a new turn** and routed by this rule. **The only same-turn single-hop allowed**: after `f2s-req-clarify` writes the clarification document to disk, it auto-chains directly to `f2s-req-tech` (see the completion section of `skills/f2s-req-clarify/SKILL.md`); no further hop is allowed. After `f2s-req-tech` writes to disk it must not auto-chain to `f2s-req-plan` / `implement-tech-design`.
6. If the user is only asking, comparing, evaluating, or requesting an explanation, do not invoke a Skill.
7. For low-confidence intent or conflicting multiple intents, briefly state the candidate routes and ask a clarifying question; do not invoke a Skill.

## Intent -> Skill Mapping

When the user input **clearly triggers** one of the following operational intents and does not violate the priority rules above, the Agent may directly enter the corresponding Skill without waiting for a second confirmation:

| Intent signal (examples; Chinese compatibility terms retained) | Skill to invoke |
|----------------|-----------|
| 需求澄清、PRD 澄清、帮我理清需求、澄清一下; requirement clarification, PRD clarification, help clarify requirements | `f2s-req-clarify` |
| 生成技术方案、出方案、技术设计; generate technical design, draft a plan, technical design | `f2s-req-tech` |
| 提交代码、git commit、帮我提交、快捷提交; commit code, git commit, help me commit, quick commit | `f2s-git-commit` |
| 新增能力、加功能、f2s-kb-feat; add capability, add feature, f2s-kb-feat | `f2s-kb-feat` |
| 修正实现规则、规则错了、f2s-kb-fix; fix implementation rule, the rule is wrong, f2s-kb-fix | `f2s-kb-fix` |
| 任务规划、创建任务; task planning, create task | `f2s-req-plan` |
| 知识库同步、全局同步、已实现能力同步; knowledge-base sync, global sync, sync implemented capability | `f2s-kb-sync` |
| 已有能力进知识库、多文件生成上下文; add existing capability to KB, generate context from multiple files | `f2s-kb-add` |
| 新增规则、口述规则、把这条记到知识库; add rule, spoken rule, record this in the KB | `f2s-kb-addRules` |
| 生成项目上下文、终稿生成上下文; generate project context, generate context from final draft | `f2s-kb-build` |
| 合并上下文冲突、解决知识库冲突; merge context conflict, resolve KB conflict | `f2s-kb-merge` |
| 知识库迁移、旧版迁移; knowledge-base migration, legacy migration | `f2s-kb-migrate` |
| 删除项目上下文; delete project context | `f2s-kb-rm` |
| 知识库模板升级、知识库升级、一键升级迁移; KB template upgrade, KB upgrade, one-click upgrade migration | `f2s-kb-upgrade` |
| 项目架构说明、架构初稿; project architecture description, architecture draft | `f2s-doc-arch` |
| 转成终稿模版、f2s-doc-final; convert to final-overview-template, f2s-doc-final | `f2s-doc-final` |
| 生成项目里程碑、里程碑; generate project milestones, milestones | `f2s-doc-milestone` |
| PDF 转 MD; PDF to MD | `f2s-doc-pdf` |

## Decision Boundary

**Invoke**: the user clearly initiates an operational intent with high confidence.

- "帮我做需求澄清" / "help me clarify requirements" -> invoke `f2s-req-clarify`
- "生成一份技术方案" / "generate a technical design" -> invoke `f2s-req-tech`
- "修复这个 bug，表现是 X，期望是 Y" / "fix this bug; behavior is X, expected Y" -> invoke `f2s-kb-fix`
- "新增这个配置开关，默认 false，影响范围是 X" / "add this config switch, default false, scope X" -> invoke `f2s-kb-feat`

**Do not invoke**: the user is asking or discussing rather than initiating an operation.

- "这个需求需要澄清吗？" / "does this requirement need clarification?" -> answer the question first
- "技术方案一般怎么写？" / "how is a technical design usually written?" -> answer the question first
- "f2s-req-tech 是干什么的？" / "what does f2s-req-tech do?" -> answer the question first
- "我们讨论一下这个能力怎么做" / "let's discuss how to build this capability" -> discuss first; do not enter implementation
- "我想加一个能力，但还没想清楚" / "I want to add a capability but haven't thought it through" -> clarify or ask back; do not enter feat

**Decision basis**: whether there is clear action semantics such as "help me do X", "execute X", or "start X". Pure questions, discussion, and evaluation do not trigger routing.

## Routing Notice

Before automatically entering a Skill, state the routing reason in one sentence:

```text
I will handle this with <Skill>: <one-sentence reason>.
```

For low confidence, only output the candidates and a clarifying question:

```text
This may be <Skill A> or <Skill B>; the current request is missing <key information>, so confirm first before entering a flow.
```

## Prohibited

- Automatically invoking any Skill when `intentRecognition` has not been read or is `false`
- Misclassifying question-style input as operational intent
- Automatically jumping to feat/fix/plan/tech before requirement clarification is complete
- Automatically jumping to `f2s-req-plan` / `implement-tech-design` before the technical design has been written to disk
- Auto-chaining to the next `f2s-*` skill within the **same turn** that a process-orchestration skill (`f2s-req-clarify` / `f2s-req-tech` / `f2s-req-plan` / `f2s-doc-*`) writes its deliverable (**only exception**: `f2s-req-clarify` → `f2s-req-tech` single hop; `f2s-req-tech` must not auto-chain further)
- Automatically switching to another Skill before the current flow is complete
