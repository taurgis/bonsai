---
"@taurgis/bonsai": minor
---

Adds `--toon`, an opt-in alternative to `--json` that encodes the identical envelope as
[TOON](https://toonformat.dev/) (Token-Oriented Object Notation) instead of JSON — roughly 40%
fewer tokens on mixed-structure data, per the format's own published benchmarks. `--toon` and
`--json` are mutually exclusive: passing both fails fast with `CONFLICTING_OUTPUT_FLAGS` (exit 2)
rather than silently preferring one.

Also adds contextual "next step" tips to successful human-mode output on `fetch`, `status`,
`inspect`, and `prune` — mirroring the existing `Try this:` pattern already used on errors and
cache misses. A fresh `status` hit points at `inspect` for full metadata, a stale hit points at
re-fetching to revalidate, a successful `fetch` points at `inspect`, and a `prune --dry-run` with
matches points at `--yes`. Tips are suppressed under `--json`/`--toon` (the envelope's `data` is
self-describing) and never appear on stdout, so they never corrupt `bonsai <url> > out.md`-style
redirection.
