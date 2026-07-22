---
"@taurgis/bonsai": patch
---

Manual CLI audit fixes:

- `status`/`inspect`/`fetch`/`import` no longer archive (rename) a corrupt cache file on disk when `--read-only`/`--plan` or `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE` is active. Encountering a corrupt entry during a URL lookup still warns on stderr, but the rename is itself a filesystem write, which `status` in particular documents as never happening ("Check cache status without fetching or writing"). Without `--read-only`, the existing archive-and-recover behavior is unchanged.
- Multi-URL batch messages ("Cache miss for X and N other URLs", "...and N other URL failures") now read grammatically for exactly one extra row ("1 other URL"/"1 other URL failure") instead of always pluralizing ("1 other URLs").
