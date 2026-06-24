# Just the Docs

## Sources

- Docs: https://just-the-docs.com/
- Verified search data: https://just-the-docs.com/assets/js/search-data.json
- Research CLI: static fetch, high confidence, detailed token estimate about 3727.

## Organization

Just the Docs is a Jekyll theme for static documentation sites. The sampled root page is extractable but noisy because it includes a large contributor section and many avatar images.

## Search

Verified. The site exposes `assets/js/search-data.json`, which should be parsed as a local search index.

## Markdown or Source Site

The page links to GitHub source repositories and Jekyll source concepts, but a direct route-to-source mapping was not proven.

## Default Cache Verdict

Partial. It extracts content, but root pages may include contributor/avatar noise. Leaf pages should be cleaner.

## Recommended Work

- Detect Just the Docs from theme markers and `search-data.json`.
- Drop contributor/avatar grids and large repeated image sections.
- Parse `search-data.json` for discovery.
