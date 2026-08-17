---
id: fallback-triage
revision: 0
summary: fallback-triage
primary: policy
confidence: manual
---
# fallback-triage

## Triggers

Enter this topic when any of the following is true:

- `taskToTopicRules` has no hit
- It is unclear which topic to route to (multiple candidates are close, keywords are generic, and no domain terms hit)
- The gap check fails (dependency topics or context documents are missing)

> **When entering this topic**: `manifest-routing.json` has already been read in this task line and is treated as a stable snapshot. Do not reread it; triage directly from the existing routing result.
>
> **This topic is for triage only. It is not final hit authority and must not directly implement business changes.**

---

## Triage Flow

### Step 1: Determine Whether Routing Hit

**A topic was hit, but context is insufficient**:

1. Read dependency topics in `topicDependencies`, and keep the next-highest candidate for supplemental validation
2. Name the missing document or topic section
3. Ask the user for the specific document path, then continue after it is supplied
4. **Do not perform threshold-free cross-matcher full search**

**No topic was hit**: proceed to step 2.

---

### Step 2: Ask the User to Confirm Domain Coverage

Do not let the Agent infer this on its own. Ask the user directly:

> The current task did not hit routing. Please confirm: **Has documentation for this domain already been added to the knowledge base?**
> - Yes -> routing terms may be missing; consider running `f2s-kb-build` / `f2s-kb-sync` to supplement routing, then retry
> - No -> the knowledge base currently has no coverage; choose either drilling into business source code or adding `req-docs` and then implementing from the spec
> - Unsure -> please check whether `.Knowledge/stock-docs/` contains related documents, then tell me

Follow the corresponding exit based on the user's answer. **Do not guess when there is no answer.**

---

## Exit Paths

| Triage conclusion | Next step |
|----------|--------|
| Topic was hit and context is filled | Jump to that topic and execute `match → expand → verify → act` |
| User confirms docs exist but routing terms are missing | Suggest running `f2s-kb-build` / `f2s-kb-sync` to supplement routing; pause this run or drill into source code |
| User confirms no KB coverage exists | Offer two paths: drill into source code / add `req-docs` and then implement |
| User is unsure and it still cannot be located | Stop execution, explain the reason, and wait for a clear instruction |

---

## Prohibitions

- Do not use this topic as final hit authority to directly implement changes
- Do not skip user confirmation and infer domain coverage yourself
- Do not perform cross-matcher full supplemental search when context is insufficient
