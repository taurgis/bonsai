# T-10: Harden End-to-End CLI Contract

## Goal

Prove the command behaves predictably for agents and humans across success and failure paths.

## User Stories

- `US-06.1` JSON envelope
- `US-06.2` JSON error envelope
- `US-06.3` stdout/stderr discipline
- `US-06.4` machine-readable cache metadata

## Depends On

- T-09

## Target Files

- plugin package contract tests
- command docs and examples
- any runtime integration glue needed for JSON envelope behavior

## Implementation Notes

- Copy the JSON-envelope expectations from existing contract tests.
- Verify against `src/oclif/runtime.ts` `buildJsonEnvelope`.
- Verify exit codes against `src/oclif/runtime.ts` `CLI_EXIT_CODE`.
- For command class behavior, compare with `src/commands/find.ts`.
- Keep those host references as compatibility fixtures; implementation code remains in this plugin package unless a separate host-integration ticket says otherwise.
- Do not assert exact absolute cache paths except that they live under the test data directory.

## Scope

- Test `research --help`.
- Test missing URL.
- Test invalid URL.
- Test unsafe URL.
- Test invalid `--format`.
- Test invalid `--ttl`.
- Test invalid `--max-age`.
- Test `--dry-run`.
- Test cache miss.
- Test fresh cache hit.
- Test stale unchanged revalidation.
- Test unavailable source with and without `--allow-stale`.
- Test human stdout/stderr routing.
- Test `--json` stdout is exactly one envelope.
- Test command-not-found suggestions are unaffected.

## Acceptance Criteria

- JSON success envelope has `schemaVersion`, `command`, `ok`, `exitCode`, `stdout`, `stderr`, and `data`.
- JSON error envelope follows existing `forward-nexus` error conventions.
- Human mode can be piped without diagnostics in stdout.
- All cache/freshness statuses are machine-readable.
- Dry-run output is machine-readable and does not write artifacts.
- The command does not leak progress UI into non-interactive stdout.

## Validation

```bash
pnpm test:contract
pnpm type-check
pnpm docs:check
pnpm build
```
