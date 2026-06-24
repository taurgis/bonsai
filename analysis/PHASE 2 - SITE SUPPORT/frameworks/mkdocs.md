# MkDocs

## Sources

- Docs: https://www.mkdocs.org/
- Verified search index: https://www.mkdocs.org/search/search_index.json
- Observed edit link: https://github.com/mkdocs/mkdocs/blob/master/docs/index.md
- Research CLI: static fetch, medium confidence, detailed token estimate about 219.

## Organization

MkDocs builds static HTML from Markdown and a YAML configuration file. The sampled root page is short but clean. The HTML exposes:

- MkDocs footer with version/build metadata.
- Search modal markup.
- GitHub edit link.
- Normal static links for navigation.

## Search

Verified. MkDocs exposes a local JSON search index at `/search/search_index.json`. This is a high-value generic connector because it avoids remote API keys and can discover all indexed pages.

## Markdown or Source Site

Yes when edit links are enabled. The sampled page has a direct GitHub source link to `docs/index.md`.

## Default Cache Verdict

Sufficient for leaf article content. Not sufficient for page discovery because the public search index is better than crawling.

## Recommended Work

- Detect MkDocs from footer comments, MkDocs search modal ids, and `search/search_index.json`.
- Fetch and parse the local search index.
- Convert edit/blob links to raw Markdown when present.
