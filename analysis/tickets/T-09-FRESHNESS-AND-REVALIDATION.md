# T-09: Add Freshness and Stale Revalidation

## Goal

Reuse fresh cache entries, cheaply revalidate stale entries, and never overwrite good artifacts with transient failures.

## User Stories

- `US-05.1` fresh cache hit
- `US-05.2` stale revalidation unchanged
- `US-05.3` changed source refresh
- `US-05.4` unavailable source handling

## Depends On

- T-05
- T-08

## Target Files

- `src/lib/research/freshness.ts`
- `src/lib/research/revalidate.ts`
- cache state-machine tests

## Scope

- Implement tier windows:
  - `stable`: 180 days, 60 day grace
  - `standard`: 30 days, 14 day grace
  - `volatile`: 7 days, 5 day grace
- Allow `--ttl` to override tier fresh window.
- Compute freshness from `max(fetched_at, validated_at)`.
- On fresh hit, do not fetch.
- On stale hit, revalidate with ETag/Last-Modified when available.
- On unchanged source, update `validated_at`, not `fetched_at`.
- On changed source, fetch, extract, and archive superseded artifact.
- On unavailable source, preserve the old artifact.
- Implement `--allow-stale` behavior and exit-code mapping from T-00.

## Acceptance Criteria

- Fresh cache hit returns without network access.
- Stale unchanged response bumps `validated_at`.
- Changed response updates content hash and archives old artifact.
- Source unavailable within grace returns stale only according to policy.
- Source unavailable beyond grace fails without overwriting old artifact.
- JSON distinguishes hit, miss, revalidated, refreshed, stale, and unavailable states.

## Validation

```bash
pnpm test -- --run src/lib/research
pnpm test:contract
pnpm type-check
```
