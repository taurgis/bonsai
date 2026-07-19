---
applyTo: "**"
description: >
  When and how to run the read-only review subagents (Senior QA Engineer,
  Senior Code Reviewer, Business Analyst) and how to act on their leveled
  feedback (blocker/major/minor/nit).
---

# Review Subagents

Three read-only subagents review completed work from different angles. They
never change code: they return leveled findings, and **you** (the main agent)
act on them.

- **Senior QA Engineer** — exercises the feature end to end: happy path,
  edge cases, error paths, regressions, determinism.
- **Senior Code Reviewer** — reviews the diff for code quality: correctness
  risks, over-engineering, readability, consistency, tests.
- **Business Analyst** — checks the ticket, spec, or request against
  observable behavior from the user's perspective: goal coverage,
  discoverability, documentation.

## When to run them

Run them **after** development is functionally complete (after the ponytail
and thermo-nuclear review passes from the development instructions), and only
when they make sense for the change:

- **Feature work or behavior changes** (new command, changed output, new
  flag): run all three.
- **Bug fixes**: run Senior QA Engineer (does the fix hold, did anything
  regress) and Senior Code Reviewer. Add Business Analyst only when the bug
  report describes a user-facing goal.
- **Pure refactors** (no behavior change): run Senior Code Reviewer; QA only
  if test coverage of the refactored area is thin.
- **Docs, config, or one-line changes**: skip the subagents — a review pass
  that costs more than the change is not sensible.

Give each subagent the context it cannot infer: what the ticket/spec/request
asked for, which branch or diff to look at, and how to run the affected
feature.

## Acting on feedback

Each finding arrives at exactly one level. Handle them in this order:

| Level | Action |
| --- | --- |
| **blocker** | Fix immediately. The task is not done while a blocker is open. |
| **major** | Fix immediately, before finishing the task. |
| **minor** | Fix only if the fix is easy and low impact (small, local, no behavioral risk). Otherwise report it as a known finding and move on. |
| **nit** | Same rule as minor, and never let nits trigger rework of the change's structure. |

After fixing blockers or majors, re-run the subagent whose finding you fixed
to confirm the fix — a fix nobody re-tested is a guess. Minors and nits do
not require a re-run.

Disagreement is allowed: if a finding is wrong, say why in your summary
instead of applying it. Silently dropping a blocker or major is not allowed.

## Boundaries

- The subagents are read-only by design. Never ask them to apply their own
  suggestions, and never copy code from their reports without checking it
  against the actual codebase.
- Report the final state honestly in your summary: findings fixed, findings
  deferred (with level), findings rejected (with reason).
