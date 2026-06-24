# T-22: Split Long API References Into Section Artifacts

## Goal

Make long generated reference pages useful to agents by storing section-level child artifacts.

## Evidence

- Node `url.html` extracted successfully but produced about 17.5k detailed tokens.
- MDN and TypeScript reference pages can become large and mix multiple concepts on one URL.

## Scope

- Split detailed Markdown by heading hierarchy after extraction or source Markdown parsing.
- Store child artifacts keyed by parent cache key plus heading anchor.
- Record parent cache key, heading path, anchor, token estimate, and source URL.
- Let `research inspect` show child sections.
- Let `research search` rank section matches.
- Keep the whole-page artifact for provenance and revalidation.

## Out of Scope

- Changing cache keys for existing page-level artifacts.
- Building semantic summaries with an LLM.

## Acceptance Criteria

- Node `url.html` creates child sections for major H2/H3 headings.
- Child sections can be searched and inspected.
- Revalidating the parent updates or archives superseded child artifacts atomically.
- JSON output remains stable.

## Validation

```bash
pnpm test -- --run src/lib/research src/commands/research/search src/commands/research/inspect
pnpm type-check
```

