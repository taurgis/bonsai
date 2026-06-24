# T-25: Parse Local Docs Search Indexes

## Goal

Add generic connectors for static search indexes shipped with common documentation generators.

## Evidence

- MkDocs returned HTTP 200 for `/search/search_index.json`.
- Material for MkDocs returned HTTP 200 for `/search/search_index.json`.
- Sphinx returned HTTP 200 for `/searchindex.js`.
- Just the Docs returned HTTP 200 for `/assets/js/search-data.json`.

## Scope

- Add a `mkdocs-local` connector for JSON search indexes.
- Add a `sphinx-searchindex` connector that parses `searchindex.js` safely without evaluating arbitrary JavaScript.
- Add a `jekyll-json` connector for Just the Docs style `search-data.json`.
- Normalize search results into title, URL, section/anchor when available, snippet, provider, score, and source index URL.
- Route selected results through normal `research <url>` capture.

## Out of Scope

- Algolia DocSearch.
- Pagefind.
- Browser automation of search modals.

## Acceptance Criteria

- MkDocs and Material fixtures produce searchable URLs from `search_index.json`.
- Sphinx fixture produces searchable URLs from `searchindex.js` without `eval`.
- Just the Docs fixture produces searchable URLs from `search-data.json`.
- Malformed indexes return stable quality/search errors without corrupting the cache.
- Search result output distinguishes remote discovery results from local cache hits.

## Validation

```bash
pnpm test -- --run src/lib/research src/sites
pnpm type-check
```
