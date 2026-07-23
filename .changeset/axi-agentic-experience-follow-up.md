---
"@taurgis/bonsai": minor
---

Closes four more gaps from an [AXI](https://github.com/kunchenguid/axi) agent-experience audit
(following `--toon` and next-step tips):

- **Content first**: running `bonsai` with no arguments at all now shows live cache data (the same
  as `bonsai list`) instead of oclif's default root help. `bonsai help`, `--help`, and `-h` are
  unaffected and remain the explicit path to the command reference.
- **Definitive empty states**: `list --json`/`--toon` now always includes a top-level `summary`
  object with an explicit `empty` boolean, so a zero-result `data: []` is never ambiguous.
- **Pre-computed aggregates**: that same `summary` object reports `total`, `shown`, `limit`,
  `truncated`, and a `byFreshness` breakdown (`fresh`/`stale_grace`/`stale_expired`) over every
  matched entry — a cache-wide count without a second round trip. This replaces the old
  conditionally-present `truncation` object.
- **Minimal default schema**: `list`'s default row is now the 4 fields an agent needs to judge
  relevance and act next (`sourceUrls`, `topic`, `freshness`, `tokenEstimate`) instead of all 12
  metadata fields. Pass `--full` to get every field (cache key, path, artifact type, tags, capture
  method, quality notes, timestamps) as before.
