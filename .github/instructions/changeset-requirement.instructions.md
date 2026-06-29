---
description: 'Require Changesets for release-visible changes to the published forward-nexus package'
applyTo: 'src/**/*.ts,tests/**/*.ts,bin/**,README.md,package.json'
---

# Changeset Requirement

## Mandatory Follow-Up

- When a task changes user-visible CLI behavior, install behavior, lockfile behavior, published assets, package metadata, or package-facing documentation, create or update a file under `.changeset` before finishing.
- If the change belongs to an existing pending release note, update that pending changeset instead of creating a second omnibus entry.
- For substantive release note writing, consult the `changeset-release-writing` skill.

## When This Is Required

- CLI command, alias, flag, prompt, stdout, stderr, or exit behavior changes
- Skill discovery, install, update, sync, remove, or lockfile behavior changes that affect users
- Published package metadata changes involving `bin`, `files`, `engines`, install behavior, or release scripts
- README changes that document new or changed published behavior

## When This Is Not Required

- formatting-only, whitespace-only, or comment-only changes
- tests-only, fixtures-only, snapshots-only, or generated-doc-only changes
- internal refactors with no consumer-visible behavior change
- CI-only or release-automation-only changes that do not change published package behavior

If release-neutral work still needs explicit acknowledgement for Changesets tooling or branch policy, use `pnpm exec changeset add --empty`.

## Verification

- Run `pnpm changeset:status` and confirm `forward-nexus` appears when a new changeset was added.