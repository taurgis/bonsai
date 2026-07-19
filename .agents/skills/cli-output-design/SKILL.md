---
name: cli-output-design
description: >
  Design well-structured CLI output: stdout/stderr routing, exit codes, TTY
  detection, color rules, progress indicators, JSON mode, and deterministic
  output. Use when deciding how a CLI command formats and routes its output,
  when adding machine-readable output, or when output must be stable for
  scripts and agents. Applies to any Node.js or oclif-based CLI, including
  Bonsai.
license: MIT
metadata:
  version: '1.0.0'
  sources:
    - https://clig.dev/
    - https://github.com/lirantal/nodejs-cli-apps-best-practices
    - https://oclif.io/docs/json
---

# CLI Output Design

Output is the CLI's user interface — for humans reading a terminal and for
scripts and agents parsing a pipe. Design for both at once by routing and
detecting, not by compromising either.

## Streams

- stdout carries the primary output — the thing the command exists to
  produce. If the user pipes the command into another program, stdout is
  what they mean to pipe.
- stderr carries everything else: progress, warnings, errors, debug lines,
  update hints. Piped output must never be polluted by messaging.
- In oclif commands use `this.log()` for stdout and `this.warn()`/
  `this.error()`/`ux` helpers for stderr — never bare `console.log` (it
  bypasses `--json` suppression).

## Exit codes

- 0 means success; anything non-zero means failure. Every failure path sets
  a non-zero code — a printed error with exit 0 silently breaks scripts.
- Distinct codes for distinct failure classes are useful when a caller can
  act on the difference (e.g. "not found" vs "network error"); document any
  code beyond 0/1.

## Human output vs machine output

- Detect whether stdout is a TTY (`process.stdout.isTTY`). Interactive
  niceties — color, spinners, progress bars, tables — are for TTYs only;
  when piped, emit plain, line-oriented text.
- Provide `--json` on any command whose output an agent or script may
  consume. JSON mode outputs one machine-readable document on stdout and
  suppresses all human messaging.
- Honor color conventions: disable color when not a TTY, when `NO_COLOR` or
  `TERM=dumb` is set, or when the user passes `--no-color`. Color is
  emphasis, never the only carrier of meaning.

## Determinism

- Same input and same cache state produce byte-identical output. Agents
  diff and reuse Bonsai output, so incidental variation is a bug, not a
  cosmetic issue.
- Common sources of accidental nondeterminism: timestamps, unordered map
  iteration, filesystem enumeration order, randomized IDs, locale-dependent
  formatting. Sort explicitly, format explicitly.
- Progress and status belong on stderr precisely so determinism only has to
  hold for stdout.

## Progress and long operations

- Print something within ~100ms so the user knows the tool is alive.
- For long operations on a TTY, show a spinner or progress indicator on
  stderr; when not a TTY, print occasional plain status lines instead.
- On completion, state what happened ("Cached 3 pages, skipped 1 fresh
  entry"), not just "Done".

## Saying (just) enough

- Too little output and the user wonders if the tool hung; too much and the
  signal drowns. Default to concise; put detail behind `--verbose` and
  debugging behind a `DEBUG` environment variable.
- Errors state what went wrong and what to do next ("Try this:"), on
  stderr, with a non-zero exit — all three, every time.
