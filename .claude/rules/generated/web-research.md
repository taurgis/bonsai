<!-- GENERATED: forward-nexus ide-sync -->

Source: `.github/instructions/web-research.instructions.md`

# Web Research Requirement

## Mandatory Pre-Step

- Run the **Official Docs Researcher** subagent before creating, updating, refactoring, scaffolding, or deleting technical content.
- Use its findings to apply current official documentation and references in the change.
- The researcher keeps a freshness-tiered Bonsai cache (its data directory or project-local `.bonsai/research/`): it reuses fresh notes, cheaply revalidates stale ones, and re-fetches only on a miss. Re-running on a recent topic is cheap — invoke it rather than skipping research to "save" a fetch.

## When Not to Use

- No technical content is being modified (purely editorial changes).
- You already fetched and applied official docs **in the current task**. Training-data knowledge does not satisfy this — only docs fetched in the same task do.
- The request is too simple to warrant research (typo, lint fix not involving platform behavior).

## Examples

- ✅ Before editing instructions, prompts, agents, skills, workflows, or docs.
- ✅ Before auditing or refactoring source — reading source code does not replace checking current platform guidance.
- ✅ Include official source URLs when the change references platform behavior or standards.
- ❌ Don't modify technical content without running the subagent first, or treat cached/training knowledge as equivalent — official guidance evolves and must be verified per task.
