# T-20: Add Remote Docs Search Connectors

## Goal

Let agents discover uncached documentation pages through each site's public search/index mechanism, then cache selected results through the normal research pipeline.

## Evidence

- Vue exposes Algolia DocSearch config in VitePress site data.
- Vite exposes VitePress local search with MiniSearch options.
- Astro/Starlight exposes `data-pagefind-body` and search components.
- Tailwind exposes an Algolia DSN preconnect and search UI.
- Existing local cache search only finds previously cached artifacts.

## Scope

- Add generic connectors for:
  - Algolia DocSearch.
  - VitePress local MiniSearch.
  - Pagefind where a public index is present.
  - Docusaurus local/search metadata where available.
- Extend `research search` or add a site-aware search mode that can search remote docs before cache hits.
- Return title, URL, snippet, provider, score, and provenance.
- Route selected result URLs back through `research <url>`.

## Out of Scope

- Authenticated search APIs.
- Crawling a full site as a substitute for search indexes.
- Storing remote search result snippets as source artifacts.

## Acceptance Criteria

- Vue remote search returns official Vue docs URLs with Algolia provenance.
- Vite remote search returns Vite docs URLs from the local VitePress index.
- Tailwind, React, Next.js, Prisma, Svelte, NestJS, TanStack, Angular, TypeScript, and Express remain unsupported by remote search until endpoint/index fixtures prove the connector.
- A visible search UI or CDN/preconnect hostname is recorded as a signal, not as supported search.
- Search output is deterministic and JSON-safe.
- Remote search failures degrade to local cache search with a stable warning.

## Validation

```bash
pnpm test -- --run src/sites src/commands/research/search
pnpm type-check
```
