---
"@taurgis/bonsai": minor
---

Closes the biggest remaining gap from the [AXI](https://github.com/kunchenguid/axi) agent-experience
audit: **ambient context via session integrations**. `bonsai setup <agent>` (`claude-code` or
`codex`) installs (and idempotently repairs) a `SessionStart` hook that runs the new `bonsai
context` command at the start of every session, so an agent sees the cache's current state —
total entries, a freshness breakdown, and the most recently touched pages — before doing anything.
Project-scoped by default (shareable via version control); pass `--global` for a user-level,
machine-only install. OpenCode isn't supported yet: its plugin docs don't confirm a hook signature
for this, and `setup` says so rather than guessing.

Also closes the **content-truncation** follow-up: a `compressed` fetch's JSON envelope now includes
`detailedTokenEstimate` alongside `tokenEstimate`, so an agent can see exactly how much bigger
`--format detailed` would be without a second round trip. A human-mode tip only appears when
something was actually truncated.

Finally, documents (no behavior change) the one intentional AXI divergence: errors are already on
stdout under `--json`/`--toon`, but stay on stderr in human/text mode, following clig.dev's
stdout-is-data/stderr-is-diagnostics convention for interactive and piped terminal use.
