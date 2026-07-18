---
'@taurgis/bonsai': patch
---

Document inspect/status parity fixes for agent-facing batch and JSON envelope behavior: multi-URL
`inspect` now preserves successful rows alongside cache misses or URL validation failures while
surfacing stable top-level `code`, `exitCode`, `data`, and suggestions in the same shape as
`status`.
