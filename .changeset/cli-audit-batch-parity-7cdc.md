---
'@taurgis/bonsai': patch
---

Improve CLI recovery UX from the end-to-end audit, then collapse incidental complexity: shared CACHE_MISS copy and sparse `urlValidationErrorRow`, composed read overlays, argv `earlyExit` as the single owner of flag-only `MISSING_COMMAND` (including swallowed-URL tips — no dash-id branch in `command_not_found`), and prune partial-failure shaping in the envelope module.
