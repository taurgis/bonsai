# T-03: Write and Read Research Artifacts

## Goal

Store research results as transparent local artifacts under the oclif data directory.

## User Stories

- `US-03.2` artifact write/read
- `US-03.4` storage location
- `US-06.4` cache metadata in JSON

## Depends On

- T-02

## Target Files

- `src/lib/research/artifact.ts`
- `src/lib/research/storage.ts`
- `src/lib/research/schema.ts`
- tests for artifact serialization and paths

## Scope

- Use `this.config.dataDir` for durable artifacts.
- Store one logical artifact per normalized source.
- Include frontmatter fields from `analysis/pre-ticket/RESEARCH-CACHE-CONTRACT.md`.
- Emit both compressed and detailed sections when available.
- Use one Markdown artifact with a narrow YAML frontmatter subset. Do not add a YAML parser package.
- Parse only the frontmatter schema this command writes.
- Never use raw URL text as a path segment.

## Artifact Format

Use this exact section order:

```markdown
---
schema_version: 1
artifact_type: source
source_url: https://example.com/docs
source_urls:
  - https://example.com/docs
normalized_url: https://example.com/docs
cache_key: sha256-...
topic: React docs
tags:
  - react
format_available:
  - compressed
  - detailed
tier: standard
ttl:
fetched_at: 2026-06-24T00:00:00.000Z
validated_at: 2026-06-24T00:00:00.000Z
stale_after: 2026-07-24T00:00:00.000Z
capture_method: static_fetch
extraction_status: extracted
extraction_confidence: high
quality_notes:
  - readability extracted main article
supplied_at:
supplied_by:
content_hash: sha256-...
token_estimate:
  compressed: 123
  detailed: 456
status: active
---

## Summary

## Compressed

## Detailed

## Provenance
```

The frontmatter reader only needs to support strings, empty values, arrays of strings, and the nested `token_estimate` object shown above.

For future agent-supplied imports, the same artifact shape should use `capture_method: agent_supplied`, `extraction_status: agent_supplied`, and a populated `supplied_at`. Multi-source imports should use `artifact_type: research_note` and multiple `source_urls`.

`extraction_confidence` is a simple quality signal: `high`, `medium`, or `low`. `quality_notes` is an array of short diagnostics that explain low-confidence extraction, fallback behavior, or import context.

## Out of Scope

- Cache index.
- Atomic write conflict handling.
- Network fetch.
- Real extraction.

## Acceptance Criteria

- A fixture result can be written, read, and returned.
- Artifact metadata includes artifact type, source URL/source URLs, normalized URL when available, cache key, timestamps, tier/TTL, capture method, extraction status, extraction confidence, quality notes, content hash, status, and token estimates.
- The artifact path is under the configured data directory.
- The frontmatter reader can parse the exact artifact format above.
- A malformed artifact produces a clear diagnostic and does not crash the command.

## Validation

```bash
pnpm test -- --run src/lib/research
pnpm type-check
```
