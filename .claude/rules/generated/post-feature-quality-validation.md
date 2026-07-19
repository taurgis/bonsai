<!-- GENERATED: forward-nexus ide-sync -->

Source: `.github/instructions/post-feature-quality-validation.instructions.md`

# Post-Feature Quality Validation

## Mandatory Follow-Up

- After implementing or updating a feature, invoke the **Senior Quality Engineer** agent before considering work complete.
- Run the smallest relevant automated checks for the affected surface first, then broaden when shared behavior changes.
- When the change is user-facing, validate outputs, error messages, and observable side effects.

## Minimum Expectations

- Test the feature's primary flow and relevant regressions.
- Validate failure paths and user-facing error messages when part of the feature.
- Report the commands, test files, and runtime surfaces exercised.
- Report findings, blockers, and untested coverage explicitly.

## When This Is Not Required

- Editorial documentation changes.
- Non-behavioral metadata/config edits that can't affect runtime behavior.
- When the user explicitly declines the validation step.
