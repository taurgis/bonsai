---
name: changeset-release-writing
description: 'Write user-facing Changesets summaries and release notes for the single published forward-nexus package. Use when creating or rewriting `.changeset/*.md` files or reviewing release PR changelog copy.'
---

# Changeset Release Writing

Use this skill when creating or rewriting a file under `.changeset`, or when reviewing release PR copy generated from pending changesets.

## Repo Release Model

- Published package: `forward-nexus`
- Versioning and changelog source of truth: `.changeset/*.md`
- Release automation: Changesets release PR and publish workflow

## When to Use

- A task changes CLI behavior users will notice.
- A changeset file exists but reads like maintainer notes instead of user-facing release notes.
- You need to decide whether a package-facing change deserves a patch or minor bump.

## When Not to Use

- CI-only, release-automation-only, or repo-maintenance-only changes with no published package impact.
- Formatting-only, test-only, or internal refactors with no consumer-visible behavior change.

## Writing Rules

- Write for package consumers, not maintainers.
- Lead with visible outcome first.
- Explain what changed and why it matters.
- Keep internal implementation detail out of the summary unless it affects upgrades.
- Use `patch` for fixes and small UX improvements.
- Use `minor` for additive CLI features, new flags, or new supported workflows.

## Example

```md
---
"forward-nexus": patch
---

Improve `forward-nexus add` error output for invalid repository sources so failed installs explain how to correct the input.
```

## Checklist

- Bump level matches user impact.
- Summary is user-facing and action-oriented.
- One coherent release story per changeset.
- Avoid vague words like `cleanup` or `refactor` unless paired with user impact.