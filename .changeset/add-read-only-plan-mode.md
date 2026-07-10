---
"@taurgis/bonsai": minor
---

Add a global `--read-only` flag (alias `--plan`), also honored via the `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE` environment variables, that blocks every command's filesystem writes and deletes (cache persistence, config writes, `prune` deletions) while still allowing network fetches to run. This lets agent harnesses that enter a read-only "plan mode" keep using Bonsai for research without it writing to disk: set the env var once per session and every invocation honors it automatically.
