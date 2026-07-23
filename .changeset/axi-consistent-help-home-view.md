---
"@taurgis/bonsai": minor
---

Closes another gap from the [AXI](https://github.com/kunchenguid/axi) agent-experience audit
(following `--toon`/next-step tips and the content-first/aggregates follow-up): **consistent way to
get help**. Running `bonsai` with no arguments at all (the "home view") now prints a two-line
identity header — `bin: <path>` and `description: <one sentence>` — before the live list data, so
an agent orients on what it is looking at without a separate `--help` call. The header is
human-mode only, appears only on the true bare invocation (not on an explicit `bonsai list`), and
never appears under `--json`/`--toon`.
