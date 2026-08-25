---
description: Karpathy-style coding behavior guidelines: clarify assumptions first, implement minimally, change only what is necessary, and execute against verifiable goals. Coexists with f2s-* rules; process hard constraints defer to f2s.
alwaysApply: true
---

# Karpathy-Style Coding Behavior Guidelines

> Runs **in parallel** with the project's Flow2Spec / `f2s-*` rules. If any item conflicts with a mandatory f2s step, **f2s and project conventions take precedence**.

Behavior conventions for reducing common "model writes code" mistakes.

**Tradeoff:** These guidelines favor **carefulness over pure speed**. For obviously tiny changes, such as a one-line typo, use judgment instead of applying every item rigidly.

## 1. Think Clearly Before Writing Code

**Do not assume, do not hide confusion, and put tradeoffs on the table.**

Before implementing:

- **State assumptions clearly**; ask when uncertain instead of guessing.
- **List multiple possible interpretations** when they exist; do not silently choose one and proceed.
- **Propose the simpler approach** when one exists; push back when pushback is warranted.
- **Stop when unclear**: name the confusion and ask the user for information.

## 2. Prefer Simplicity

**Solve the problem with the least code; do not add speculative extensions.**

- Do not add features beyond the request.
- Do not create abstractions for code used only once.
- Do not add unrequested "flexibility" or "configurability".
- Do not pile on error handling for scenarios that are nearly impossible.
- If you wrote 200 lines where 50 are enough, **rewrite it**.

Ask yourself: "Would a senior engineer consider this over-designed?" If yes, simplify.

## 3. Make Surgical Changes

**Change only what needs changing; clean up only what your change disturbed.**

When editing existing code:

- Do not casually "optimize" adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- **Match the existing code style**, even if your personal preference differs.
- If you notice dead code unrelated to the task, **you may mention it; do not delete it on your own**.

If your change creates orphaned references or variables:

- **Remove imports, variables, and functions that became unused because of this change**.
- **Do not** delete dead code that already existed unless the user asked for it.

Validation standard: **every changed line can be traced back to the user's explicit request**.

## 4. Execute Against Goals

**Define success criteria first, then iterate until they are verifiably met.**

Turn the task into verifiable goals, for example:

- "Add validation" -> "write an invalid-input test first, then change code until it passes"
- "Fix bug" -> "write a reproducing test first, then change code until it passes"
- "Refactor X" -> "the test suite passes before and after"

For multi-step tasks, a short plan can be written:

```
1. [Step] -> Verify: [check method]
2. [Step] -> Verify: [check method]
3. [Step] -> Verify: [check method]
```

The more concrete the success criteria, the easier it is to iterate independently; vague "just make it work" goals tend to cause repeated clarification.

---

**Signals that the guidelines are working:** fewer unrelated changes in diffs, less rework from over-design, and **clarifying questions appear before implementation** rather than after a wrong implementation.
