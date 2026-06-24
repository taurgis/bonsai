# T-15: Add Keyword Cache Search

## Goal

Let agents find existing cached research by keywords before starting URL-based research.

## User Stories

- `US-03.6` search cached research by keywords
- `US-06.1` JSON envelope
- `US-06.4` machine-readable cache metadata

## Depends On

- T-14

## Command Shape

```bash
forward-nexus research search "react suspense cache" \
  --limit 10 \
  --json
```

## Target Files

- `src/commands/research/search.ts`
- `src/lib/research/search.ts`
- scan/search tests under `src/lib/research`
- contract tests for `research search --json`

## Scope

- Register `research search` through the plugin package's oclif command discovery and generated manifest.
- Search local cached artifacts only.
- Do not fetch URLs.
- Do not call an external search engine.
- Do not mutate cache state.
- Start with scan-based matching, no index.
- Match query terms against:
  - topic
  - tags
  - source URLs
  - summary
  - compressed content
  - artifact type
- Add `--topic`.
- Add repeated `--tags`.
- Add `--artifact-type source|research_note`.
- Add `--limit`, default `10`, max `50`.
- Add `--include-stale`; default excludes beyond-grace artifacts.
- Return short snippets, not full content.

## Scoring

Keep scoring simple:

- topic/tag exact match beats body match
- more matched query terms beats fewer matched terms
- fresh artifacts beat stale artifacts
- shorter snippets beat dumping whole sections

Do not add fuzzy search, embeddings, or a search index in this ticket.

## Out of Scope

- Internet search.
- Official source discovery.
- Embeddings.
- Search index.
- Ranking powered by an LLM.

## Acceptance Criteria

- `research search <query> --json` emits the standard envelope.
- Empty query exits with usage error.
- Results include cache key, artifact path, artifact type, source URLs, topic, tags, freshness, capture method, token estimates, and snippet.
- Search does not fetch or write.
- Search returns an empty result set with exit `0` when no cached artifact matches.
- Human output is metadata/snippets only and does not print full research content.

## Validation

```bash
pnpm test -- --run src/lib/research
pnpm test:contract
pnpm type-check
```
