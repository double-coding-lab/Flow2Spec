[中文](../团队协作.md) | [English](./team-collaboration.md)

# Team Collaboration

Flow2Spec isolates task state by developer. Active tasks can travel with the code through Git for continuation on another computer, while confirmed team knowledge lives in `.Knowledge/`.

- `.task/` holds personal working state. Active tasks and `todo.json` can be committed; completed archives are ignored.
- `.Knowledge/` is team knowledge and is reviewed, committed, and pulled with the code.

`developerId`, `kb-delta.json`, and topic revisions make this boundary executable.

---

## 1. Three collaboration surfaces

| Content | Typical path | Visibility | Collaboration model |
| --- | --- | --- | --- |
| Personal task state | `.task/<developerId>/` | Members who pull the relevant commits | Resume by developerId; archive completed tasks locally |
| Project knowledge | `.Knowledge/` | Everyone who pulls the repository | Delta merge and Git review |
| Implementation and formal docs | Source code and `docs/` | Everyone who pulls the repository | Branches, PRs, and commits |

An active task can contain unverified assumptions, half-finished checklists, and user todos. Those details help the current session but are not team facts. `.Knowledge/` is different: the Agent uses it to decide business rules, implementation boundaries, and reading paths, so the team must share one version.

```text
.task/alice/active/...  --produces delta--\
                                           +--> plan/apply --> .Knowledge/ --> Git
.task/bob/active/...    --produces delta--/

personal process (isolated)                   team facts (shared)
```

The two deltas do not merge inside `.task/`. Each developer works only within their own task root; the results meet in the Git diff for `.Knowledge/`.

---

## 2. Task isolation and TASK_ROOT

The project root configuration controls collaboration mode:

```json
{
  "collaboration": {
    "enabled": true,
    "developerId": "alice"
  }
}
```

Alice receives `.task/alice/`; Bob receives `.task/bob/`. The `f2s-task` rule permits the Agent to read and write only the current `TASK_ROOT`. Scanning other developers' directories to find resumable work crosses that boundary.

### developerId resolution

Flow2Spec uses the first available value:

1. `collaboration.developerId`
2. The part before `@` in Git `user.email`
3. Git `user.name`
4. Legacy single-root `.task/` if none is available

An explicit id must normalize to lowercase `[a-z0-9-]`; an invalid explicit value fails because the user deliberately selected that identity. A non-ASCII Git-derived identity becomes a stable `dev-xxxxxxxx` hash id and produces a warning. A readable explicit id is preferable on shared machines.

### Legacy mode remains supported

The legacy layout is used when `collaboration.enabled` is false or no identity is available:

```text
.task/todo.json
.task/active/<task-name>/
.task/completed/<YYYYMMDD>-<task-name>/
```

Flow2Spec does not move old tasks automatically because it cannot infer ownership. A team should confirm the owner before moving those directories under `.task/<developerId>/`.

---

## 3. Knowledge changes as deltas

Raw Markdown diffs do not tell a merge engine why text changed. `kb-delta.json` restricts a change to explicit actions and carries the version that the author read:

```json
{
  "taskId": "add-payment-rule",
  "developerId": "alice",
  "baseRevisions": {
    "payment-rules": 3
  },
  "changes": [
    {
      "type": "appendBody",
      "targetTopic": "payment-rules",
      "summary": "Add refund timing",
      "content": "## Refund timing\n\nReturn funds through the original payment method within three business days."
    }
  ]
}
```

`flow2spec kb plan` compares `baseRevisions` with the current topic frontmatter:

- revision is still 3: the delta is mergeable;
- revision is now 4: stop and reread the current topic;
- the target is missing, or a new topic id is already occupied: report a conflict.

The lock is at topic granularity. Two changes to different sections of the same topic still conflict after the first apply. This is conservative by design: two individually reasonable paragraphs can still contradict each other as business rules.

### Allowed change types

| Type | Purpose |
| --- | --- |
| `appendBody` | Append to an existing topic body |
| `replaceBody` | Replace an existing topic body |
| `updateFrontmatter` | Update topic metadata |
| `createTopic` | Create a topic, optionally with a matcher and task route |

Legacy knowledge bases may lack topic revisions. Run `flow2spec kb build --fix-topics` once, inspect the frontmatter diff, then validate with `flow2spec kb check --strict` and commit the migration.

### Delta lifecycle

```text
skill forms a knowledge change
  -> writes kb-delta.json under the active task
  -> plan previews the merge
  -> apply writes topics and routing
  -> build/check validate the graph
  -> .Knowledge/ is committed with the implementation
  -> task is archived locally after its gates pass
```

`plan` does not write files. `apply` plans again immediately before writing, so a stale preview cannot force an outdated change onto disk. The delta stays with the task and can be committed for continuation; the `.Knowledge/` diff holds the confirmed result.

---

## 4. A normal collaboration cycle

Start by pulling team state and checking local knowledge health:

```bash
git pull
flow2spec kb status
```

Knowledge-producing skills such as `f2s-kb-feat`, `f2s-kb-fix`, `f2s-kb-distill`, and `f2s-kb-sync` assemble evidence and write the delta. The CLI decides whether that delta can still merge into the current disk state.

Developers do not need to memorize every command. During `f2s-git-commit`, the Agent runs `check + status` and, when exactly one current delta is unambiguous and mergeable, continues through `plan -> apply -> build -> check`. Direct commands remain useful for diagnosis and CI:

```bash
flow2spec kb plan .task/alice/active/add_payment_rule/kb-delta.json
flow2spec kb apply .task/alice/active/add_payment_rule/kb-delta.json
flow2spec kb build
flow2spec kb check --strict
```

After apply, inspect the real `.Knowledge/` diff and commit it with the implementation. Include active tasks and `todo.json` when continuation on another computer is needed.

---

## 5. Two developers change the same topic

A revision is an optimistic disk lock, not a remote lock service. It cannot see a teammate's push until the branch is updated.

Suppose Alice and Bob both start from `payment-rules revision: 3`:

1. Alice applies first, advances the topic to revision 4, and pushes.
2. Bob pulls Alice's commit before applying his local delta.
3. Bob runs plan and receives `revision mismatch 3 -> 4`.
4. Bob reads revision 4 and decides whether the two rules should coexist, be rewritten, or replace one another.
5. Bob rewrites the change and its base revision. A successful apply advances the topic to revision 5.

Step 4 cannot be replaced by concatenating text. The conflict exists to force a semantic decision.

| Conflict | Appears when | Resolution |
| --- | --- | --- |
| Revision conflict | `kb plan/apply` | Pull, reread the latest topic, rewrite the delta |
| Git conflict | Merge/rebase produces conflict markers | Resolve as a Git conflict; knowledge context files can use `f2s-kb-merge` |

`f2s-kb-merge` does not update stale `baseRevisions`.

---

## 6. Team conventions worth agreeing on

- Give each developer a stable, readable `collaboration.developerId`, especially on shared machines.
- Pull before starting; keep a knowledge change and its implementation in the same PR or in traceable commits.
- Keep topics focused. Oversized topics enlarge both the routing surface and the revision conflict surface.
- Ignore `.task/completed/` and `.task/*/completed/`; active tasks can be committed, while `todo.json` remains a personal continuation index.
- Prefer delta-producing `f2s-kb-*` workflows for topic changes. Direct edits bypass revision preflight.
- Review the `.Knowledge/` diff before merging. “Mergeable” means structurally safe, not necessarily correct business wording.
- Keep the team on one Flow2Spec version so CLI schemas and templates agree.

---

## 7. How managers see progress

Committed active checklists provide task context. Formal team progress should come from durable commitments and outputs:

- PRs or draft PRs for current delivery and blockers;
- commits and `.Knowledge/` diffs for actual capability or rule changes;
- `.Knowledge/req-docs/` for approved work waiting for implementation;
- milestones for results spanning multiple commits;
- the team's issue tracker, board, or status reports for owners and deadlines.

Use `.task/active/` for resumable working state and the existing issue tracker for owners, deadlines, and blockers. Completed archives stay local. Archiving a previously committed active task produces deletions that should travel with the next commit.

---

## 8. Common questions

### If `.task/` can travel through Git, why keep developerId?

Shared workspaces, build machines, and devcontainers can host multiple identities. More importantly, `TASK_ROOT` gives the Agent an enforceable boundary for task continuation.

### Does switching computers restore active tasks?

Commit and push the active task and `todo.json`, then pull them on the other computer. Keep the same `collaboration.developerId` or Git identity resolution so the Agent resumes from the same `TASK_ROOT`.

### Does `collaboration.enabled: false` disable knowledge collaboration?

No. It only selects the `.task/` layout. Git still controls how `.Knowledge/` is shared.

### Can `kb status` see a teammate's uncommitted delta?

No. It scans only the current `TASK_ROOT/active/`. Use PRs, issues, or the team board for visible progress.

### Is a revision the same as a Git commit hash?

No. A revision is an integer version for one topic and detects stale delta baselines. A commit hash describes a repository commit and remains the team history source of truth.

### Why can Git still conflict after `kb plan` succeeds?

Plan checks only the local disk. It cannot see remote commits that have not been pulled.

### Can I edit `.Knowledge/topics/*.md` directly?

Git allows it, but it bypasses the delta schema and revision preflight. For an emergency manual repair, update the revision consistently, then run `flow2spec kb build` and `flow2spec kb check --strict` and review routing changes.

---

## Related Documents

- [Usage Guide](./usage-guide.md)
- [Commands Reference](./commands-reference.md)
- [Directory Conventions](./directory-conventions.md)
- [Architecture](./architecture.md)
- [Project Milestones](./milestones.md)
