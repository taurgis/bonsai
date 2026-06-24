# T-08: Add Compressed Output and Token Estimates

## Goal

Return token-efficient compressed research output by default without adding tokenizer or Markdown AST dependencies.

## User Stories

- `US-04.3` compressed Markdown
- `US-04.5` token estimate
- `US-02.3` output format selection

## Depends On

- T-07

## Target Files

- `src/lib/research/compress.ts`
- `src/lib/research/token-estimate.ts`
- format selection tests

## Scope

- Default `--format` to `compressed`.
- Keep title, excerpt, headings, important paragraphs, API identifiers, warnings, version notes, and provenance.
- Remove images, repeated whitespace, social/share noise, and low-value links.
- Simplify Markdown links when URL detail is not needed.
- Estimate tokens with `ceil(character_count / 4)`.
- Store token estimates for available formats.

## Out of Scope

- Model-specific tokenizer.
- LLM-generated summary.
- Full Markdown AST processing.

## Acceptance Criteria

- Compressed output is shorter than detailed output on fixtures.
- Compressed output keeps warnings, code/API names, and version constraints.
- `--format compressed` and `--format detailed` derive from the same logical artifact.
- JSON output includes selected format and token estimate.
- Human mode returns only selected content to stdout.

## Validation

```bash
pnpm test -- --run src/lib/research
pnpm test:contract
pnpm type-check
```
