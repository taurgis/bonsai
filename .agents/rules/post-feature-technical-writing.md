---
trigger: always_on
description: "Require Senior Technical Writer after changes that affect docs or user-facing guidance"
---

<!-- GENERATED: forward-nexus ide-sync -->

# Post-Feature Technical Writing

## Mandatory Follow-Up

- After implementing or updating a feature, invoke the **Senior Technical Writer** agent whenever the change affects a documentation or guidance surface, including docstrings, generated docs, READMEs, onboarding steps, examples, diagrams, CLI help text, or CLI status and error messages.
- If the writer is expected to edit documentation or user-facing copy, run **Senior Technical Writer** before the mandatory **Senior Code Reviewer** and **Senior Quality Engineer** pass so their audits cover the final documentation state.
- If the task only needs a documentation audit and no edits are expected, the writer may run in parallel with **Senior Code Reviewer** and **Senior Quality Engineer**.
- Require the writer to verify behavior against authoritative sources before documentation or governance-source edits, using the project's docs-research workflow when one exists.
- Instruct the writer to load the closest project conventions, use the `beginner-technical-writing` skill for audience-aware explanations, and keep source-adjacent reference text authoritative.

## Minimum Expectations

- Classify each changed artifact as `tutorial`, `how-to`, `reference`, or `explanation`, and choose a primary audience.
- Keep the project understandable for juniors and beginners without watering down technical accuracy for experienced contributors.
- Define domain-specific acronyms and assumptions on first use when the audience is broader than specialists.
- Sync documentation surfaces that can drift: source docstrings, generated docs, READMEs, command examples, CLI help output, and linked references.
- Prefer Mermaid for new or revised diagrams. Require `accTitle` and `accDescr`, and prefer text-based diagrams over screenshots when the goal is explaining structure or flow.
- Validate affected documentation with the smallest relevant commands, such as the project's doc-extraction or docs build command, CLI help checks, or any governance sync command for instructions, prompts, skills, and agents.
- Report which artifacts were updated, which were reviewed without change, and any remaining documentation debt or follow-up gaps.

## Reporting Format

- Require the writer to return these sections in order: `Findings`, `Audience and Artifact Map`, `Files Updated or Reviewed`, `Validation`, `Coverage Gaps`, `Verdict`.
- `Findings` must come first and explicitly state when no documentation drift, clarity issues, or missing surfaces were found.
- `Audience and Artifact Map` must list each touched or reviewed surface, its documentation role, and its primary audience.
- `Validation` must include the exact commands, rendering checks, or output checks used to confirm the documentation.
- `Verdict` must be one of `complete`, `complete with follow-ups`, or `blocked`.

## Guardrails

- Do not invent APIs, commands, file paths, screenshots, or behavior that the implementation does not support.
- Do not duplicate long reference content across multiple surfaces when one source of truth can be updated and linked.
- Do not force broad README rewrites for narrow implementation changes.
- Do not introduce non-Mermaid diagrams by default when Mermaid can explain the same concept.
- If the implementation leaves behavior ambiguous, surface the ambiguity instead of masking it with soft language.

## When This Is Not Required

- Purely internal refactors with no user-visible behavior, workflow, API contract, documentation contract, or message changes.
- Non-behavioral metadata edits that cannot affect onboarding, instructions, generated docs, or user-facing copy.
- Cases where the user explicitly declines the follow-up documentation pass.
