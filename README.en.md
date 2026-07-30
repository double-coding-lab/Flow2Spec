# flow-spec — Let AI Always Know What You're Doing

> Cures the "amnesia" of Cursor / Claude Code — with one `init` command, AI
> remembers project context across sessions. No more re-explaining every time.
>
> 🌐 **[中文](./README.zh-CN.md)** · EN / 中

🎬 **[Live Demo](https://lands-1203.github.io/flow-spec/)** (13-slide HTML PPT, `←` `→` to navigate, `S` for presenter mode)

📖 **[flow-spec introduction](./docs/en/flow-spec-introduction.md)** · **[基础介绍（中文）](./docs/flow-spec基础介绍.md)** — long-form article: why flow-spec, knowledge graph vs project memory, with diagrams

🔧 **Quick start**:

```bash
npx @double-codeing/flow-spec@latest init
```

---

## Before / After

The exact same request, two conversations:

```
> Update the batch re-scoring of the review template library
```

**Without flow-spec**:

```
AI: Which module has this table?
AI: Is batchReScore sync or async?
AI: Is there a lock? What's the idempotency key?
AI: What's the response format? What's the error code?
AI: (Digging through 416 APIs, 796 files, 4.7 MB of source code…)
```

Repeated introductions · Repeated code searches · Repeated mistakes

**With flow-spec**:

```
[matcher hit] m-product-review-template-library
[loading deps] 4 topics · ~300 lines
AI: Known — fire-and-forget
     Redis lock smp:product-review:template-library:batch-rescore:lock (TTL 10 min)
     Max 100 items per batch · error code 101
AI: Starting implementation, 3 files affected.
```

4.7 MB → 300 lines · Pinpoint accuracy in seconds

---

## What flow-spec Does

**① Remembers project context across sessions**
`.flow-spec/` structured knowledge base: routing manifest (`manifest-routing.json`) + keyword indices (matchers) + topic shards (topics). AI only loads what's relevant — 4.7 MB of source code compressed to ~300 lines of precise context.

**② Routing manifest means AI doesn't dig through your repo**
Each task hits 1–4 topics, ~300 lines. Business constraints — Redis lock keys, error codes, batch limits — are all in the topics. AI doesn't have to guess from source code.

**③ fs-* skills update knowledge as you code**
`/fs-kb-feat` writes topics while writing features, `/fs-kb-fix` corrects topics while fixing bugs, `/fs-git-commit` checks topic coverage before committing. Changing code == updating knowledge. No separate "documentation maintenance."

**④ Full pipeline from requirements to code**
`/fs-req-clarify` asks questions until requirements are unambiguous. `/fs-req-tech` generates a ready-to-implement technical proposal into `req-docs/`. AI implements from the proposal — no relying on verbal agreements.

**⑤ Task checklists track progress across sessions**
When `changeTracking` is enabled, skills like `fs-kb-feat` / `fs-kb-fix` automatically create a `task.md` with checkboxes. Each step is checked off immediately to disk. New sessions auto-load the remaining checklist — no relying on memory. User-side todos (run SQL, set env vars, click approvals) go into `user-todos.md`, separate from AI steps.

**⑥ Document-driven: PDF / MD straight into the knowledge base**
`/fs-kb-add` aggregates source files into draft → final → topics. `/fs-doc-final` converts any PDF or MD into the canonical final-draft format. External docs and legacy proposals all become routable knowledge.

---

## Getting Started

**Minimum viable setup is an empty skeleton.**

```bash
npx @double-codeing/flow-spec@latest init
```

1 minute generates the directory structure + routing config. Empty, ready to use. **Next requirement hits whichever area → you document that area.** No upfront investment needed.

Real data from a production repo running for 3 months:

| Metric | Value |
|---|---|
| Public APIs | 416 |
| Source code | 796 files / 4.7 MB / ~100K lines |
| flow-spec per-task load | **≈ 300 lines** (99% noise removed) |

---

## Usage Flow

### Step 1: Initialize (one-time)

```bash
npx @double-codeing/flow-spec@latest init
```

Follow the prompts to completion — generates the `.flow-spec/` directory structure and routing config skeleton.

---

### Step 2: Build the flow-spec Base (one-time)

In your Agent tool (Cursor / Claude Code):

1. `/fs-doc-arch` — Scan your project architecture, generate an architecture draft, and follow the flow until topics are created

> This step is done once. You won't need to repeat it for daily development.

2. `/fs-kb-add <folder path>` — Import any feature modules that haven't been added yet

> Do this selectively before starting development when you notice a module's knowledge is missing from the knowledge base.

---

### Step 3: Daily Development (every feature or fix)

**Large features:**

```
/fs-req-clarify  one-line description or paste PRD    ← clarify requirements
/fs-req-tech                                       ← generate technical proposal
natural language: implement the proposal above         ← AI starts coding (task checklist auto-created when changeTracking is on)
(debug and verify)
/fs-kb-feat  add xxx capability                       ← if something's missing
/fs-kb-fix   fix xxx                                  ← if there's a bug
/fs-kb-sync                                           ← sync knowledge base
/fs-git-commit                                        ← check and commit
```

**Small changes / quick fixes:**

```
/fs-kb-feat  add xxx capability                       ← missing feature
/fs-kb-fix   fix xxx                                  ← bug fix
```

---

## Quick Command Reference

| Command | Purpose |
|---|---|
| `/fs-req-clarify` | Clarify requirements |
| `/fs-req-tech` | Generate technical proposal |
| `/fs-kb-feat` | Add a new capability |
| `/fs-kb-fix` | Fix a bug |
| `/fs-kb-sync` | Sync knowledge base |
| `/fs-git-commit` | Commit code; "quick commit" skips KB coverage check |
| `/fs-kb-add <path>` | Import API module into knowledge base |

For the full command list, see [Usage Guide](./docs/en/usage-guide.md) · [Commands Reference](./docs/en/commands-reference.md)

---

## When NOT to Use

- **One-off scripts** — throwaway code is faster with a few Markdown files for AI context
- **Solo small projects** — a single CLAUDE.md is enough; routing overhead > benefits
- **Team won't maintain .flow-spec/** — tools can't replace discipline

---

## Documentation

**Start here** — product narrative and diagrams:

- [flow-spec introduction](./docs/en/flow-spec-introduction.md) (EN)
- [flow-spec 基础介绍](./docs/flow-spec基础介绍.md) (中文)

**Hands-on guides**

### English
- [Usage Guide](./docs/en/usage-guide.md) — skill chains, config details
- [Commands Reference](./docs/en/commands-reference.md) — all fs-* command reference
- [Directory Conventions](./docs/en/directory-conventions.md)
- [Architecture & Principles](./docs/en/architecture.md)
- [Usage Scenarios](./docs/en/usage-scenarios.md)
- [Design Principles](./docs/en/design-principles.md)
- [Project Milestones](./docs/en/milestones.md)

### 中文
- [使用说明](./docs/使用说明.md)
- [命令说明](./docs/命令说明.md)
- [目录与路径约定](./docs/目录与路径约定.md)
- [体系与原理](./docs/体系与原理.md)
- [使用案例·模拟对话](./docs/使用案例-模拟对话.md)
- [设计说明](./docs/设计说明.md)
- [项目里程碑](./docs/项目里程碑.md)

## License

MIT. Copyright © 2026 兰涛
