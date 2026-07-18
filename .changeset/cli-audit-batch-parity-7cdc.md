---
'@taurgis/bonsai': patch
---

Improve CLI recovery UX and contract gaps from the end-to-end audit: keep prior `status`/`inspect` hits when a later URL is invalid (parity with fetch), reject empty duration flags, reject whitespace-only `--topic` on multi-source import, report `PRUNE_PARTIAL_FAILURE` with a stable code, treat flag-only argv and URL-swallowing value flags as `MISSING_COMMAND`, relocate leading `--read-only`/`--plan` after the command (same pattern as `--json`), align `CACHE_MISS` messages across status/inspect, and avoid stopping a never-started fetch spinner.
