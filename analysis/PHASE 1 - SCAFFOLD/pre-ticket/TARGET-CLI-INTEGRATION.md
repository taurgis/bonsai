# Target CLI Integration

The target CLI lives at:

```text
/Users/thomastheunen/Documents/Projects/forward-nexus
```

This document records the current integration constraints that matter for building the research plugin in this repository and loading it into the `forward-nexus` host CLI.

## Current Package Facts

From the target `package.json`:

- package: `forward-nexus`
- version at inspection time: `2.0.0`
- runtime: ESM
- Node engine: `>=22`
- package manager: `pnpm@10.17.1`
- test runner: Vitest
- build: `obuild`
- oclif dependency: `@oclif/core` `^4.11.4`
- published bin: `forward-nexus`

## oclif Shape

`forward-nexus` is already an oclif v4 CLI. It does not use ordinary directory command discovery.

Important config:

```json
{
  "oclif": {
    "bin": "forward-nexus",
    "dirname": "forward-nexus",
    "commands": {
      "strategy": "explicit",
      "target": "./dist/cli.mjs",
      "identifier": "COMMANDS"
    },
    "helpClass": {
      "target": "./dist/cli.mjs",
      "identifier": "HelpClass"
    },
    "topicSeparator": " ",
    "hooks": {
      "prerun": {
        "target": "./dist/cli.mjs",
        "identifier": "prerunHook"
      },
      "command_not_found": {
        "target": "./dist/cli.mjs",
        "identifier": "commandNotFoundHook"
      }
    }
  }
}
```

The command registry is a `COMMANDS` export in `src/commands/index.ts`. That matters for comparison and compatibility, but the research command should not be added there because this project is an optional plugin, not a core command change.

## Delivery Decision: Optional Plugin Developed Here

The research capability is an optional oclif plugin package developed in this repository. The existing CLI is already oclif-based, but it is not currently a general user-installable plugin host.

The target repo's `analysis/EXTENSIBILITY.md` explicitly defers `@oclif/plugin-plugins`. It also notes that full plugin-host readiness would require a plugin loading decision, package config changes, and renewed security review.

Implication for this project:

- Implementation tickets target this repository's plugin package source files.
- The host repo is used for compatibility checks, optional plugin-host enablement, documentation, and dogfooding only.
- Enabling user-installed plugins in `forward-nexus` is a separate integration/security decision from implementing the research plugin.
- Do not register `research` as a core command in `src/commands/index.ts`.

Recommended first ticket candidate:

```text
Scaffold the optional research plugin package in this repository and define the host-linking path for dogfooding.
```

Do not create fetch/cache implementation tickets that require changes inside the host CLI before plugin package scaffolding and host-linking expectations are recorded.

## Existing Command Pattern

Current commands follow this pattern:

- `src/commands/<name>.ts` is a thin oclif shell.
- `src/lib/<domain>/` holds business logic.
- Shared flags live in `src/oclif/flags.ts`.
- Shared command lifecycle and output handling live in `src/oclif/base-command.ts`.
- JSON envelope handling lives in `src/oclif/runtime.ts`.
- Human rendering is separated from computation.

Research should mirror the same separation of concerns inside this repository's plugin package:

```text
src/commands/research.ts
src/lib/research/
  cache-key.ts
  cache-store.ts
  freshness.ts
  fetch.ts
  extract.ts
  markdown.ts
  compress.ts
  schema.ts
  render.ts
```

## JSON Contract

The target CLI does not use oclif's default `enableJsonFlag` behavior for most commands. It uses a project-specific envelope:

```json
{
  "schemaVersion": 1,
  "command": "research",
  "ok": true,
  "exitCode": 0,
  "stdout": "",
  "stderr": "",
  "data": {}
}
```

Research tickets should preserve that shape even though the command is provided by a plugin. Command-specific data belongs under `data`.

Recommended `data` shape:

```json
{
  "schemaVersion": 1,
  "cache": {
    "key": "sha256-...",
    "status": "hit",
    "freshness": "fresh",
    "path": "/absolute/path/to/artifact.md"
  },
  "source": {
    "url": "https://example.com/docs",
    "normalizedUrl": "https://example.com/docs",
    "validatedAt": "2026-06-24T00:00:00.000Z"
  },
  "format": "compressed",
  "tokenEstimate": 1234,
  "content": "# Extracted Markdown"
}
```

Allowed cache status values should be decided before ticketing. Suggested:

- `hit`
- `miss`
- `stale-revalidated`
- `stale-refetched`
- `stale-served-with-warning`
- `unavailable`

## Exit-Code Expectations

Use the target CLI's existing meanings:

- `0`: success
- `1`: well-formed request failed at runtime
- `2`: usage error
- `4`: conflict
- `5`: partial success

Suggested mapping for research:

| Situation | Exit |
| --- | --- |
| Fresh cache hit | 0 |
| Miss fetched and stored | 0 |
| Stale entry revalidated unchanged | 0 |
| Source changed and was refreshed | 0 |
| Source unavailable but stale entry is within grace and explicitly served | 0 or 5, decide before ticketing |
| Source unavailable and no usable cache exists | 1 |
| Invalid URL, invalid `--format`, invalid `--ttl`, unsupported scheme | 2 |
| Cache write conflict or unsafe path resolution | 4 |

## Output and Streams

The existing CLI treats `--json` as the sole stdout document. Research must do the same.

Human mode should decide whether content is primary stdout data or a narrative command transcript. Because research returns extracted content that users may pipe, the recommended split is:

- extracted Markdown/content to stdout
- progress, cache status, warnings, and diagnostics to stderr
- JSON envelope only to stdout under `--json`

If the command follows the existing read-only command style, mark its command class as primary-data stdout.

## Storage Location

Use oclif's runtime directories:

- `this.config.dataDir` for durable research artifacts
- `this.config.cacheDir` for temporary HTTP/cache validator metadata if separated from artifacts
- `this.config.configDir` for user preferences only

Do not write production research artifacts to the repository. Tests may use isolated temp HOME/CWD directories.

## Tests to Mirror

The host repo has:

- `tests/contract/json-contract.test.ts`
- `tests/contract/exit-codes.test.ts`
- `tests/contract/flags-parsing.test.ts`
- `tests/contract/help.test.ts`
- `tests/contract/ansi-and-logo.test.ts`
- co-located `src/**/*.test.ts` unit tests

Research work should add both in this repository, plus host-level dogfood checks where needed:

- unit tests for cache keys, freshness, TTL parsing, extraction, compression, and schema
- contract tests for command help, JSON shape, stdout/stderr routing, exit codes, and non-interactive behavior

## References

- Target architecture: `/Users/thomastheunen/Documents/Projects/forward-nexus/AGENTS.md`
- Target contract: `/Users/thomastheunen/Documents/Projects/forward-nexus/analysis/CONTRACT.md`
- Target extensibility decision: `/Users/thomastheunen/Documents/Projects/forward-nexus/analysis/EXTENSIBILITY.md`
- oclif configuration docs: https://oclif.io/docs/configuring_your_cli/
- oclif plugin docs: https://oclif.io/docs/plugins/
- oclif command discovery docs: https://oclif.io/docs/command_discovery_strategies/
- oclif hooks docs: https://oclif.io/docs/hooks/
- oclif JSON docs: https://oclif.io/docs/json/
