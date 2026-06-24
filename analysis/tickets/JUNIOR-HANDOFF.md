# Junior Handoff Guide

Read this before starting any ticket in this folder.

## Implementation Repository

Implementation happens in:

```text
/Users/thomastheunen/Documents/Projects/forward-nexus-research
```

This repository is where the optional oclif plugin package should be scaffolded and implemented. The `forward-nexus` repo is the host CLI used for compatibility checks, optional plugin loading, and dogfooding; do not add `research` as a core command there.

## Existing Patterns to Copy

| Need | Copy from |
| --- | --- |
| Thin oclif command class | `src/commands/find.ts` |
| Host contract style | `src/commands/index.ts` and existing command metadata |
| JSON envelope behavior | `src/oclif/base-command.ts` and `src/oclif/runtime.ts` |
| Exit codes | `src/oclif/runtime.ts` `CLI_EXIT_CODE` |
| Usage errors | `src/oclif/raw-args.ts` and existing command usage guards |
| Temp-dir test helper | `tests/helpers/lock-fixtures.ts` `withTempDir` |
| JSON envelope test style | existing `tests/contract/*` and `src/lib/*/*.test.ts` JSON assertions |

Do not add the command to the host core registry. The plugin should expose the command through its own oclif package metadata and generated `oclif.manifest.json`.

Do not use oclif's native `enableJsonFlag` unless the host compatibility layer explicitly maps it to the Forward Nexus envelope. Forward Nexus uses `static jsonEnvelope = true` and returns command data from `execute()`; the plugin output must preserve that envelope for agent callers.

## Command Shape

The MVP command is:

```bash
forward-nexus research <url> \
  --topic "React docs" \
  --tags react --tags hooks \
  --format compressed \
  --tier standard \
  --ttl 30d \
  --json
```

Defaults:

- `--format compressed`
- `--tier standard`
- no `--ttl` unless supplied
- no `--max-age` unless supplied
- no browser rendering
- no authenticated/private-page support

Planned metadata commands:

```bash
forward-nexus research status <url> --json
forward-nexus research inspect <url> --json
forward-nexus research <url> --dry-run --json
forward-nexus research search "react suspense cache" --json
```

Future compatible fallback:

```bash
forward-nexus research import <url> --stdin --input-format detailed --json
```

```bash
forward-nexus research import \
  --source-url https://example.com/docs/a \
  --source-url https://example.com/docs/b \
  --stdin \
  --input-format detailed \
  --topic "Research synthesis" \
  --json
```

That command is not part of the MVP fetch pipeline. It exists so an agent can store cleaned Markdown in the same artifact format when automatic extraction fails or when the research is based on multiple URLs.

## JSON Envelope Example

Under `--json`, stdout must be exactly one JSON document:

```json
{
  "schemaVersion": 1,
  "command": "research",
  "ok": true,
  "exitCode": 0,
  "stdout": "",
  "stderr": "",
  "data": {
    "schemaVersion": 1,
    "command": "research",
    "cache": {
      "key": "sha256-...",
      "status": "hit",
      "freshness": "fresh",
      "path": "/absolute/path/to/artifact.md"
    },
    "format": "compressed",
    "tokenEstimate": 123,
    "content": "..."
  }
}
```

## Stream Rules

- Human research content goes to stdout.
- Human diagnostics, warnings, cache status, and progress go to stderr.
- `--json` writes only the envelope to stdout.
- Do not print logos, spinners, or progress to stdout in `--json`.

## Small-Code Rules

Keep these in repo code; do not add packages:

- TTL parser
- tier lookup
- URL normalization
- cache key hashing
- token estimate
- atomic temp-file write helper
- Markdown compression filters
- narrow frontmatter writer/reader

Allowed dependency candidates:

- `@mozilla/readability`
- `linkedom`, with `jsdom` only if fixtures fail
- `turndown`, only for detailed Markdown

## Validation Order

Run the narrow plugin-package test first, then the wider checks defined by the scaffolded package. For host dogfooding, link or install the plugin into `forward-nexus` and then run the host-style checks:

```bash
pnpm test -- --run src/lib/research
pnpm test:contract
pnpm type-check
pnpm docs:check
pnpm build
pnpm test
```

If `pnpm build` fails because license generation cannot reach the npm registry, treat that as an environment issue first.
