---
paths:
  - ".github/workflows/**/*.yml"
  - ".github/workflows/**/*.yaml"
  - ".changeset/config.json"
  - "package.json"
  - "pnpm-lock.yaml"
  - ".github/agents/senior-release-manager.agent.md"
---

<!-- GENERATED: forward-nexus ide-sync -->

Source: `.github/instructions/release-management.instructions.md`

# Release Management Review Requirement

## Mandatory Subagent

- Run the **Senior Release Manager** subagent before creating, updating, reviewing, debugging, or deleting CI/CD workflows, Changesets config, npm publish automation, snapshot release scripts, or package/version metadata.
- Use its feedback to harden triggers, permissions, concurrency, Changesets PR behavior, registry auth, npm provenance, and release safety before finalizing.

## Scope

- GitHub Actions workflows under `.github/workflows/**`
- `.changeset/config.json`
- Root `package.json` / `pnpm-lock.yaml` when the change affects release scripts, versioning, publishing, package files, bins, engines, package-manager state, or repo metadata
- The `Senior Release Manager` agent definition itself

## Coordination

- Run **Official Docs Researcher** before/alongside it when the task depends on current GitHub Actions, Changesets, npm, pnpm, or package-metadata guidance.
- Run **Senior Quality Engineer** for the final validation pass after material release-automation changes.

## Guardrails

- Don't mix Changesets release-PR flow with commit-message- or tag-driven version bumps.
- Don't ignore `.changeset/*.md` in release workflow triggers.
- Keep one source of truth for version calculation and release notes.

## When not to Use

- Editorial documentation changes with no CI/CD or release impact.
- Product code changes unrelated to build, packaging, publishing, or automation.
