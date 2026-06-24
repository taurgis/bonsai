# T-01: Add Command Skeleton and Contract Tests

## Goal

Add a minimal plugin-provided `forward-nexus research` command that parses flags, follows the host command conventions, and returns fixture-backed output without doing network or cache work yet.

## User Stories

- `US-02.1` single URL research command
- `US-02.2` URL and flag validation
- `US-02.5` help output
- `US-06.1` JSON envelope
- `US-06.2` stdout/stderr discipline

## Depends On

- T-00

## Target Files

- plugin package `src/commands/research.ts`
- plugin package `src/lib/research/*`
- plugin package `test` or `tests` contract coverage, following the scaffolded convention
- `package.json` oclif command discovery config
- `oclif.manifest.json` generation script/output

## Implementation Notes

- Copy the host command shape from `src/commands/find.ts` where compatible.
- Extend a plugin-local base command that preserves the host JSON envelope, or import a deliberate host compatibility helper if one is created.
- Set `static id = 'research'`.
- Preserve the `forward-nexus` JSON envelope.
- Set `static stdoutIsPrimaryData = true` because human research content is pipeable stdout data.
- Do not add `research` to the host `src/commands/index.ts`.
- Use a plugin-local `jsonFlag()` equivalent or shared host helper, not raw oclif `enableJsonFlag`, unless that route is explicitly proven to produce the host envelope.
- Return the command payload from `execute()`; the base command wraps it in the JSON envelope.

## Scope

- Register `research` through the plugin package's oclif command discovery and generated manifest.
- Define positional `<url>`.
- Define flags:
  - `--topic`
  - repeated `--tags`
  - `--format compressed|detailed`, default `compressed`
  - `--tier stable|standard|volatile`, default `standard`
  - `--ttl`
  - `--max-age`
  - `--force`
  - `--dry-run`
  - `--allow-stale`
  - `--json`
- Return fixture/static placeholder data through the existing `forward-nexus` JSON envelope.
- Keep the command class thin and route behavior through plugin-local `src/lib/research`.

## Out of Scope

- URL safety rules beyond basic parse errors.
- Disk cache.
- Network fetch.
- Extraction.

## Acceptance Criteria

- `forward-nexus research --help` documents command usage, flags, freshness, and output formats.
- Missing URL exits as usage error.
- Invalid enum flags exit as usage error.
- `research <url> --json` emits exactly one envelope with `command: "research"`.
- JSON `data.command` is also `"research"`.
- Human mode writes returned content to stdout.
- Progress, warnings, and diagnostics do not pollute stdout.

## Validation

```bash
pnpm test:contract
pnpm type-check
```

Also manually run:

```bash
node bin/cli.mjs research --help
node bin/cli.mjs research https://nodejs.org/api/url.html --json
```
