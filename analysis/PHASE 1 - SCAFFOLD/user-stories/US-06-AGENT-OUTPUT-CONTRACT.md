# US-06 Agent Output Contract

## Epic Goal

Agents can call the research command safely from scripts and parse the result deterministically.

## US-06.1 Emit Standard JSON Envelope

Priority: P0

As an AI coding agent, I want `forward-nexus research <url> --json` to emit the standard `forward-nexus` JSON envelope, so that I can parse it like every other automation-friendly command.

Acceptance criteria:

- Stdout contains exactly one JSON document.
- The envelope includes `schemaVersion`, `command`, `ok`, `exitCode`, `stdout`, `stderr`, and `data`.
- `command` is `research`.
- `stdout` in the envelope remains empty unless the target CLI contract changes.
- Command-specific payload lives under `data`.

## US-06.2 Keep Human Chrome Out of JSON

Priority: P0

As an AI coding agent, I want progress messages, warnings, and extraction diagnostics kept out of real stdout under `--json`, so that JSON parsing never fails on terminal output.

Acceptance criteria:

- Progress output is captured or suppressed under `--json`.
- ANSI color is stripped from captured envelope text.
- Failures still emit parseable JSON when the command is recognized.
- Contract tests cover both success and failure.

## US-06.3 Route Human Output Predictably

Priority: P1

As a shell user, I want extracted content to be pipeable, so that I can redirect it to a file or another command.

Acceptance criteria:

- In human mode, returned research content goes to stdout.
- Progress, cache status, warnings, and diagnostics go to stderr.
- `--quiet` does not suppress requested primary content.
- Usage errors go to stderr and exit `2`.

## US-06.4 Return Machine-Readable Cache Metadata

Priority: P1

As an AI coding agent, I want cache and freshness metadata in JSON output, so that I can decide whether to trust, cite, or refresh the result.

Acceptance criteria:

- JSON includes cache key, cache status, artifact path, freshness state, fetched timestamp, validated timestamp, and stale timestamp or equivalent.
- JSON includes source URL and normalized URL.
- JSON includes selected format and token estimate.
- JSON includes enough data to distinguish cache hit, miss, revalidated, refreshed, and unavailable states.

## US-06.5 Keep Error Messages Actionable

Priority: P1

As a CLI user, I want errors to explain what went wrong and what to try next, so that I can correct the command without reading source code.

Acceptance criteria:

- Invalid URL errors name the accepted URL schemes.
- Invalid `--format` errors list accepted values.
- Invalid TTL errors show accepted examples.
- Source unavailable errors distinguish network, timeout, size limit, and unreadable content where possible.
- JSON errors include the human diagnostic in the envelope `stderr`.

## US-06.6 Plan Without Side Effects

Priority: P2

As an AI coding agent, I want a dry-run mode, so that I can know whether the command would hit cache, fetch, revalidate, import, or write without mutating state.

Acceptance criteria:

- `--dry-run` performs validation and cache inspection.
- `--dry-run` does not write artifacts.
- `--dry-run` does not overwrite or archive existing artifacts.
- JSON output includes the planned action and reason.

## US-06.7 Inspect Cache Metadata

Priority: P2

As a developer or agent, I want metadata-only `status` and `inspect` commands, so that I can debug cache behavior without printing full research content.

Acceptance criteria:

- `research status <url> --json` reports cache/freshness/planned action without fetching.
- `research inspect <url> --json` reports stored metadata without full content.
- Both commands use the standard JSON envelope.
- Human output keeps metadata readable and does not pollute research content streams.
