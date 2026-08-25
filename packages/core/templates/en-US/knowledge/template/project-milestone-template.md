> **Primary convention**: the template is at `.Knowledge/template/project-milestone-template.md` (written by `flow2spec init`); generated outputs go to `.Knowledge/stock-docs/<scope-name>-milestones.md`.  
> **When executing `f2s-doc-milestone`**: structure follows this template; content comes only from **req-docs, git log, .task**, and knowledge-base topics. Do not invent content.  
> **Milestone phases**: Mx is **only** for feature/capability changes. Integration testing, testing, acceptance, or pure environment/operations work must **not** become standalone phases; engineering changes are merged into the corresponding feature phase.

# (Scope Name) Milestones

> **Scope**: (user-provided semantic scope; if unspecified, write "entire project")  
> **Updated**: `YYYY-MM-DD`

## Overview

| Phase | Time | Summary |
| --- | --- | --- |
| MN · (latest phase title) | YYYY-MM | (verifiable feature delivery summary; not integration testing/testing/acceptance) |
| … | … | … |
| M1 · (initial phase title) | YYYY-MM | … |

## MN · (Latest Phase Title)

- (Delivered feature items, one per line, verifiable)

## …

(Same structure as MN; each Mx row in the overview table must have a corresponding H2 heading; all in newest-first order.)

## M1 · (Initial Phase Title)

- (Delivered feature items, one per line, verifiable)

## Pending Confirmation

- (List functional/delivery gaps or inconsistencies from the four sources; write "None" if absent)
