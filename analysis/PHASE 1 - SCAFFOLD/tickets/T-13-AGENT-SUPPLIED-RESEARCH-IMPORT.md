# T-13: Add Agent-Supplied Research Import

## Goal

Let an agent store cleaned research Markdown in the same cache format when automatic URL extraction fails or produces poor main-content results.

## User Stories

- `US-04.7` import agent-supplied research
- `US-03.2` artifact write/read
- `US-06.1` JSON envelope

## Depends On

- T-10

## Command Shape

```bash
forward-nexus research import <url> \
  --stdin \
  --input-format detailed \
  --topic "React docs" \
  --tags react \
  --tier standard \
  --json
```

```bash
forward-nexus research import \
  --source-url https://example.com/docs/a \
  --source-url https://example.com/docs/b \
  --stdin \
  --input-format detailed \
  --topic "React docs synthesis" \
  --json
```

## Target Files

- `src/commands/research/import.ts`
- `src/lib/research/import.ts`
- existing artifact writer modules from T-03/T-04
- contract tests for import JSON and stdin behavior

## Scope

- Register `research import` through the plugin package's oclif command discovery and generated manifest.
- Support exactly one source mode:
  - positional `<url>` for single-source import
  - repeated `--source-url` for multi-source import
- Reuse the same URL normalization rules as `research <url>`.
- Use the same cache key as automatic research for single-source import.
- Use a research-note cache key for multi-source import: normalized topic plus sorted normalized source URLs.
- Read Markdown from stdin.
- Accept `--input-format detailed|compressed`, default `detailed`.
- Validate imported content is non-empty.
- Start with a `1 MiB` stdin size limit.
- Store a normal research artifact.
- Set `capture_method: agent_supplied`.
- Set `extraction_status: agent_supplied`.
- Set `supplied_at` to import time.
- Set `validated_at` to import time for freshness calculations.
- For multi-source import, set `artifact_type: research_note` and populate `source_urls`.
- Do not fetch source URLs.
- Return the standard JSON envelope.

## Out of Scope

- File import flag.
- Existing manual cache migration.
- CLI-generated multi-source synthesis.
- Trusting imported Markdown as instructions.

## Acceptance Criteria

- `research import <url> --stdin --json` stores a compatible artifact.
- The imported artifact can be returned later by `research <url> --json`.
- Import uses the same cache key as automatic research for the URL.
- Multi-source import stores a research-note artifact with every normalized source URL.
- Multi-source import requires `--topic`.
- Import does not call the fetcher.
- Empty stdin exits with usage error.
- Oversized stdin fails without corrupting an existing artifact.
- JSON `data.cache.status` distinguishes agent-supplied import from automatic extraction.

## Validation

```bash
pnpm test -- --run src/lib/research
pnpm test:contract
pnpm type-check
```
