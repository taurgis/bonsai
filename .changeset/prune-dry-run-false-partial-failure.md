---
"@taurgis/bonsai": patch
---

Fix `prune --dry-run --json` falsely reporting `PRUNE_PARTIAL_FAILURE`.

`prune --dry-run` never deletes anything, so `prunedCount` is always `0` by design. The JSON envelope enrichment compared `prunedCount` against `candidateCount` without checking `dryRun`, so any dry-run preview with one or more matching candidates reported `ok: false`, `exitCode: 1`, and a fabricated "Failed to delete N cache entries" error — even though the actual process exit code was `0` and nothing was touched. Dry-run previews now always report a clean success envelope.
