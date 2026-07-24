---
"@taurgis/bonsai": minor
---

`list` and `search` now default `--limit` to 10 (previously 50 and 20 respectively), so an
unfiltered or broad call never floods an agent's context with more results than it actually asked
for. When a result is truncated, the envelope now also carries `summary.nextCommand` — a
ready-to-run invocation that reproduces every filter you passed with `--limit` raised to show
everything matched (capped at 100) — surfaced as a human-mode tip and in the `--json`/`--toon`
envelope alike, so raising the limit is a deliberate, copy-pasteable next step instead of a guess.

The bundled agent kit (`agents/skills/web-research`, the Salesforce research instructions, and both
docs-researcher subagents) now shows `--toon` in its `list`/`search` examples and documents this
default-limit/`nextCommand` behavior, and the subagents check the cache via `search --query` before
starting new research.
