---
description: Require Senior Code Reviewer after implementing or updating code
applyTo: "**"
metadata:
  version: 1.1.0
---

# Post-Feature Code Review

## Self-Review Gate — Run Before Any Reviewer Agent

When a change touches more than one file or more than one function, invoke the
`thermo-nuclear-code-quality-review` skill against the changed files and the functions and modules
connected to them, and fix every violation it surfaces. Do this before you invoke the Senior Code
Reviewer or the Senior Quality Engineer.

Actually invoking the skill is the requirement. Reasoning about the structure in your head, or
asserting that the change "looks clean", does not satisfy this gate — run the skill. It exists
because one skipped structural violation has cost a full re-review pass; running it up front is
cheaper than the loop it prevents.

Also run it — regardless of change size — when a touched file nears or exceeds 1000 lines, the diff
touches core abstractions, or the user asks for a deep audit. The skill checks the development
principles: abstraction quality, modularity, spaghetti/branching growth, file and function size, and
boundary cleanliness; prefer deleting complexity over rearranging it. Skip the gate only for the
cases in "When This Is Not Required" below.

## Mandatory Follow-Up

- Complete the **Self-Review Gate** above first. Only after a clean self-review pass may you invoke the reviewer agents.
- Invoke the **Senior Code Reviewer** agent before considering work complete.
- Run it in parallel with **Senior Quality Engineer** when the runtime supports parallel subagents; otherwise back-to-back.
- Keep the reviewer static-only: no execution, tests, builds, servers, browsers, or edits.

## What The Reviewer Must Cover

- Bugs, behavioral regressions, and missing focused coverage on the changed surface.
- Contract drift in APIs, interfaces, output format, or error behavior.
- Security: input validation, path handling, boundary checks.
- Release follow-through: missing changelog/docs when user-facing behavior changes.
- Governance accuracy: correct frontmatter, minimal tool scope, accurate links, consistency with local instructions.

## Required Inputs

- The reviewer must consult the relevant local instructions for the changed surface.
- The invoking agent must pass the exact changed files (or a concise diff) plus any user constraints on scope or follow-up.
- Every finding must cite the exact instruction, security concern, or verified bug behind it.

## Reporting Format

- Return these sections in order: `Findings`, `Instructions Consulted`, `Files Reviewed`, `Coverage Gaps`, `Verdict`.
- `Findings` comes first and states explicitly when none were found.
- Each finding: severity (`blocker`, `major`, `minor`, `nit`), file path, cited rule/concern, and a concrete fix.
- `Verdict` is one of `approve`, `approve with comments`, or `request changes`.

## Anti-Nitpick Guardrails

To prevent an infinite refactor loop between the top-level agent and the reviewer:

- Raise only findings citing a specific instruction, OWASP Top 10 concern, accessibility violation, or verified bug. Omit style preferences, speculative refactors, and "could be cleaner" — do not file them as `nit`.
- `nit` is reserved for cited rule violations with negligible impact, never taste-based suggestions.
- Stay within the current diff unless the change introduced or aggravated the issue.
- Do not re-open findings already addressed in a prior pass unless new evidence shows the fix is incomplete.
- The top-level agent acts automatically only on `blocker`/`major`; it surfaces `minor`/`nit` to the user and never loops the reviewer to chase them without explicit direction.
- Cap at two passes by default (initial + one follow-up after `blocker`/`major` fixes); more require user approval.

## When This Is Not Required

- Editorial documentation changes that touch no code or governance content.
- Non-behavioral metadata/config edits with no runtime, convention, or release impact.
- When the user explicitly declines the review step.
