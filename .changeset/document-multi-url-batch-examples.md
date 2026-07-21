---
"@taurgis/bonsai": patch
---

Document multi-URL batch usage in `--help`: `fetch` (URL shorthand), `status`, and `inspect` all accept space-separated `URL...` and already return per-URL results with partial-failure handling, but no `--help` example demonstrated it — a reader would have to notice the `URL...` ellipsis in the USAGE line and infer oclif's convention. Each command's examples now include one multi-URL invocation.
