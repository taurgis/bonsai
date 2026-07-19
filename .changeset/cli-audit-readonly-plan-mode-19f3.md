---
"@taurgis/bonsai": patch
---

Honor read-only/plan mode for derived search-index sidecar writes: `list` and `inspect` no longer create `.search-index.json` when `--read-only`/`--plan` or `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE` is active.
