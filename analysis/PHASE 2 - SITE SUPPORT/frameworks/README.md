# ReadMe

## Sources

- Docs: https://docs.readme.com/main/docs/intro-to-readme
- Verified `llms.txt`: https://docs.readme.com/llms.txt
- Research CLI: static fetch, low confidence, detailed token estimate about 263.
- Observed metadata: ReadMe deployment/version meta tags, config JSON with `algoliaIndex`, `hub-me` search app/token/filter metadata, hidden AI-agent hint to `llms.txt`.

## Organization

ReadMe is a managed documentation and API reference platform. The sampled page is a React app with significant platform metadata and multiple docs/reference modules. It can include guides, changelog, discussions, API reference, OpenAPI registries, and API playgrounds.

## Search

Search metadata was visible and concrete:

- `algoliaIndex` in config JSON.
- `hub-me` JSON with search app, token, filters, and metadata.

This is more than a generic UI signal, but it still needs a fixture-backed connector and a mocked query response before shipping.

## Markdown or Source Site

`llms.txt` was verified. The page also tells AI agents that `llms.txt` includes Markdown-formatted pages and OpenAPI endpoints.

## Default Cache Verdict

Not sufficient. Static Readability produced a short, noisy page and missed platform structure. `llms.txt` should be preferred; fallback HTML needs ReadMe-specific cleanup and possibly rendered extraction for pages with dynamic sections.

## Recommended Work

- Detect ReadMe from `readme-*` meta tags and `hub-me` JSON.
- Prefer `llms.txt`.
- Add a guarded Algolia connector only after fixture coverage for app/token/filter handling.
- Extract OpenAPI registry metadata into artifact provenance when present.
