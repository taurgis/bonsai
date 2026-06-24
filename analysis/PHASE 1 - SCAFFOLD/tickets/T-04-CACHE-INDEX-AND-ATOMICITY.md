# T-04: Add Scan-Based Lookup and Atomic Writes

## Goal

Make cache lookup correct with the smallest storage layer: scan artifacts first, write atomically, and defer an index until scanning is proven too slow.

## User Stories

- `US-03.3` rebuild lookup state from artifacts
- `US-03.5` archive superseded artifacts
- `US-07.4` storage safety

## Depends On

- T-03

## Target Files

- `src/lib/research/storage.ts`
- artifact scan and atomicity tests

## Scope

- Write artifacts through temp file plus rename.
- Look up artifacts by scanning the research artifact directory and reading frontmatter.
- Skip or archive corrupt artifacts with clear diagnostics.
- Preserve the previous valid artifact if a write fails before rename.
- Archive superseded artifacts rather than deleting them.
- Add an index only in a later ticket if scanning becomes measurably slow.

## Out of Scope

- Cache index.
- Full cross-process lock package.
- Garbage collection policies.

## Acceptance Criteria

- Fresh lookup can find an artifact by scanning frontmatter.
- Multiple artifacts for the same cache key choose the active artifact with the newest `validated_at`.
- Corrupt artifacts are skipped with diagnostics and do not break unrelated cache hits.
- Interrupted temp writes are ignored.
- Existing valid artifacts are not destroyed by failed writes.

## Validation

```bash
pnpm test -- --run src/lib/research
pnpm type-check
```

Add a focused test that simulates two writes to the same cache key. If temp-file plus rename is insufficient, add a small per-key lock file in repo code; do not add a locking package unless this test proves it is necessary.
