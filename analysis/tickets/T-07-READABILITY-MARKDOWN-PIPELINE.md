# T-07: Extract Detailed Markdown

## Goal

Convert fetched static HTML into deterministic detailed Markdown.

## User Stories

- `US-04.2` detailed Markdown
- `US-07.3` unsafe HTML cleanup

## Depends On

- T-06

## Target Files

- `src/lib/research/extract.ts`
- `src/lib/research/markdown.ts`
- extraction fixture tests

## Scope

- Run Readability against the selected DOM implementation.
- Resolve relative links using the final source URL.
- Strip scripts, styles, event-handler attributes, and unsafe link schemes before Markdown conversion.
- Use Turndown for detailed Markdown in this ticket.
- Configure Turndown for ATX headings and fenced code blocks.
- Preserve useful headings, code blocks, lists, links, and tables where possible.
- Return extraction confidence and quality notes with the extracted result.

## Implementation Notes

- Start with plain Turndown.
- Do not add `turndown-plugin-gfm` in this ticket.
- If tables are poor, add one narrow custom table rule only after a failing fixture shows the problem.

## Out of Scope

- LLM-generated summaries.
- Browser-rendered pages.
- GFM plugin unless fixture tests prove plain Turndown loses important table content.

## Acceptance Criteria

- Detailed output preserves headings and code fences.
- Relative links resolve according to the documented policy.
- Page chrome does not dominate output.
- Scripts and styles are absent from stored and returned content.
- Non-readerable pages fail clearly without corrupting the cache.
- Non-readerable failures should include a short hint that a future `research import` path can store agent-cleaned Markdown.
- Low-confidence extraction is reported as metadata instead of silently looking successful.
- No GFM plugin is added unless a fixture proves it is required.

## Validation

```bash
pnpm test -- --run src/lib/research
pnpm type-check
```
