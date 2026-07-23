---
"@taurgis/bonsai": patch
---

Manual CLI audit fix:

- `fetch`/`import` now reject a `--topic` over 200 characters or a `--tags` value over 100 characters with `INVALID_METADATA_VALUE`, the same way an embedded line break is already rejected. Previously an unbounded value was accepted and stored verbatim, which made a single oversized topic/tag wrap a `list` heading line across dozens of terminal rows. `--help` for `fetch`/`import` now documents both caps.
