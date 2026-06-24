# T-27: Support Managed Docs Platforms Through Generic Artifacts First

## Goal

Support GitBook, Mintlify, ReadMe, and Redocly-style managed docs without hard-coding brittle page parsers unless generic `llms.txt`, Markdown, search index, and cleanup paths fail.

## Evidence

- GitBook exposed `llms.txt` and per-page Markdown.
- Mintlify exposed scoped `/docs/llms.txt`, generator metadata, and a hidden agent-docs index hint.
- ReadMe exposed `llms.txt`, ReadMe-specific metadata, Algolia app/token/filter metadata, and OpenAPI registry metadata.
- Redocly static extraction was usable, but `/docs/llms.txt` returned 404 at the tested path.

## Scope

- Add managed-platform detection metadata.
- Prefer `llms.txt` and Markdown routes when verified.
- Add fallback cleanup for platform image proxies, decorative assets, marketing cards, CSS dumps, and soft 404 pages.
- Preserve API/OpenAPI registry metadata when visible.
- Document unsupported or unverified provider capabilities explicitly.

## Out of Scope

- Authenticated APIs.
- Private docs workspaces.
- Search connector implementation for every managed platform.

## Acceptance Criteria

- GitBook fixture uses Markdown route over HTML when linked.
- Mintlify fixture stores scoped `llms.txt` and avoids treating decorative landing pages as full articles.
- ReadMe fixture stores `llms.txt` and records Algolia/OpenAPI metadata as capability evidence.
- Redocly fixture records `llms.txt` as unsupported for the tested path.
- Platform-specific cleanup removes repeated cover/decorative images from fallback Markdown.

## Validation

```bash
pnpm test -- --run src/lib/research src/sites
pnpm type-check
```
