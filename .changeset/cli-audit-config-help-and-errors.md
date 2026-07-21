---
"@taurgis/bonsai": patch
---

Manual CLI audit fixes for the `config` command family:

- `bonsai config get/set/list/unset --help` now names each key's accepted values (`storage (global|project), summary (conservative|balanced|aggressive)`) instead of just the bare key names, so the values are discoverable without triggering an error first.
- The `--global`/`--local` mutual-exclusion error (`CONFLICTING_FLAGS`) now includes an actionable suggestion, matching every other `CONFLICTING_FLAGS` error in the CLI.
