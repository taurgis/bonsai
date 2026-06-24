# T-14: Add Status, Inspect, Dry-Run, and Max-Age

## Goal

Give agents and developers a cheap way to understand cache state before fetching, writing, or trusting content.

## User Stories

- `US-03.4` locate cached research
- `US-05.1` fresh cache hit
- `US-06.4` machine-readable cache metadata
- `US-06.6` dry-run planning

## Depends On

- T-10

## Command Shapes

```bash
forward-nexus research status <url> --json
forward-nexus research inspect <url> --json
forward-nexus research <url> --dry-run --json
forward-nexus research <url> --max-age 7d --json
```

## Target Files

- `src/commands/research/status.ts`
- `src/commands/research/inspect.ts`
- `src/commands/research.ts`
- `src/lib/research/status.ts`
- `src/lib/research/inspect.ts`
- contract tests for status, inspect, dry-run, and max-age

## Scope

- Add `research status <url>`.
- Add `research inspect <url>`.
- Add `--dry-run` to `research <url>`.
- Add `--max-age <duration>` to `research <url>`.
- `status` reports what would happen now: hit, miss, stale, unavailable, would fetch, would revalidate, or would return cached content.
- `inspect` reports stored metadata only: artifact path, source URLs, capture method, extraction confidence, quality notes, freshness fields, token estimates, and status.
- `--dry-run` reports the planned action without writing artifacts.
- `--max-age` is a read-time freshness guard and must not mutate stored TTL/tier fields.

## Out of Scope

- Full artifact content rendering in `inspect`.
- Cache listing.
- Cache pruning.
- Full-text search.

## Acceptance Criteria

- `status` does not fetch or write.
- `inspect` does not print full research content.
- `--dry-run` does not write artifacts.
- `--max-age` rejects or refreshes content older than the requested duration without changing stored policy.
- JSON output uses the standard Forward Nexus envelope.
- Human output keeps metadata readable and diagnostics out of content stdout.

## Validation

```bash
pnpm test -- --run src/lib/research
pnpm test:contract
pnpm type-check
```
