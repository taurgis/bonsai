---
"@taurgis/bonsai": patch
---

Manual CLI audit fixes:

- `fetch --force` no longer discards a previously curated `--topic`/`--tags` when the refetch omits them — it now carries the prior values forward, matching every other refresh path (natural revalidation already preserved them via `preserveUserMetadata`). An explicit `--topic`/`--tags` on the `--force` call still overrides the stored values as before.
- `--rendered` fetches no longer leak Chrome's process tree (zygote, gpu-process, renderer, crashpad) when the CLI is interrupted mid-fetch (SIGINT/SIGTERM) or even on ordinary completion. Chrome is now spawned as the leader of its own process group and the whole group is killed on cleanup, and a process-level signal handler guarantees cleanup runs before the CLI exits on a signal.
- A fetch that automatically falls back to browser-rendered capture (no `--rendered` flag; the static extraction was insufficient) now prints a one-line human-mode note (`Note: used browser-rendered capture (static content was insufficient).`), since launching Chrome is real added latency and a real dependency that was previously invisible outside `--json`. An explicit `--rendered` still says nothing extra, since the caller already knows.
