# Phase 2 Site Support Tickets

These tickets extend the Phase 1 research plugin from a generic page cache into a documentation-aware research system.

## Sequence

| Ticket | Title | Depends on | Priority |
| --- | --- | --- | --- |
| [T-16](T-16-DOCS-ENGINE-DETECTION.md) | Detect docs engines and expose site capabilities | Phase 1 complete | P0 |
| [T-24](T-24-MACHINE-READABLE-DOCS-ARTIFACTS.md) | Prefer `llms.txt` and route Markdown when verified | T-16 | P0 |
| [T-25](T-25-STATIC-SEARCH-INDEX-CONNECTORS.md) | Parse local docs search indexes | T-16 | P0 |
| [T-29](T-29-DOCS-FRAMEWORK-FIXTURE-PACK.md) | Add representative fixtures for popular docs frameworks | T-16, T-24, T-25 | P0 |
| [T-17](T-17-CODE-BLOCK-FIDELITY.md) | Preserve highlighted code blocks and tabbed examples | T-16 | P0 |
| [T-18](T-18-AUTOMATIC-RENDERED-FALLBACK.md) | Automatically retry SPA docs with rendered extraction | T-16 | P0 |
| [T-19](T-19-SOURCE-MARKDOWN-MAPPING.md) | Prefer public Markdown/MDX source when available | T-16 | P1 |
| [T-20](T-20-REMOTE-DOCS-SEARCH.md) | Add remote docs search connectors | T-16, T-19 | P1 |
| [T-21](T-21-LANDING-PAGE-CLEANUP.md) | Clean landing pages, image grids, and UI chrome | T-17 | P1 |
| [T-22](T-22-SECTION-LEVEL-ARTIFACTS.md) | Split long API references into section artifacts | T-19 | P1 |
| [T-26](T-26-NEXT-RSC-DOCS-PAGE-MAPS.md) | Extract Next/RSC docs page maps and source hints | T-16, T-24 | P1 |
| [T-27](T-27-MANAGED-DOCS-PLATFORMS.md) | Support managed docs platforms through generic artifacts first | T-24, T-25 | P1 |
| [T-28](T-28-DOCSIFY-CLIENT-MARKDOWN.md) | Support client-rendered Markdown docs such as Docsify | T-18, T-19 | P1 |
| [T-23](T-23-SITE-MODULE-PACK.md) | Add focused modules for remaining high-value custom sites | T-16 through T-28 | P2 |

## Definition of Done

- New capabilities are represented in stable JSON output and artifact metadata.
- Generic docs-engine support is attempted before site-specific parsers.
- Site-specific modules include fixtures proving the generic path is insufficient.
- Every connector or mapper starts from saved representative HTML/source fixtures before live network tests.
- Each ticket separates `verified`, `signal`, and `unverified` claims in docs or tests when support is partial.
- Search results are used for discovery only; selected pages still flow through the normal cache artifact pipeline.
- Source Markdown/MDX is treated as untrusted input and sanitized before storage.
- `llms.txt`, generated `.md`, and search index artifacts are validated as same-site, text/data, non-error content before they are trusted.
- Existing `--json` stdout contract remains clean.

## Fixture Policy

For every Phase 2 parser/search/source change, commit a small deterministic fixture that captures the observed page shape. Do not depend only on current live pages in unit tests; live smoke tests can be separate and skippable.
