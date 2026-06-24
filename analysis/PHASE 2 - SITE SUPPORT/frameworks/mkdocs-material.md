# Material for MkDocs

## Sources

- Docs: https://squidfunk.github.io/mkdocs-material/
- Verified search index: https://squidfunk.github.io/mkdocs-material/search/search_index.json
- Research CLI: static fetch, low confidence on root page, detailed token estimate about 87.

## Organization

Material for MkDocs is a MkDocs theme widely used for product and project documentation. The sampled root page is a landing page, so Readability extracted only a short marketing section. That is not a framework failure; it is a page-type issue.

Material sites usually have:

- Markdown source content.
- Static HTML pages.
- A bundled local search index.
- Rich admonitions, tabs, annotations, and code blocks.

## Search

Verified. The local search index at `/search/search_index.json` returned HTTP 200. The connector should support both MkDocs core and Material variants.

## Markdown or Source Site

Likely, but the sampled root page did not prove a direct edit link in this task. Source mapping should be enabled only when edit links or repository config are visible.

## Default Cache Verdict

Not sufficient for landing pages. Likely sufficient for leaf articles, but the generic system should prefer the search index for discovery and apply Material-specific cleanup for tabs/admonitions.

## Recommended Work

- Reuse MkDocs detector/search support.
- Add Material markers and fixtures for `md-tabs`, admonitions, annotations, and code blocks.
- Treat short landing-page extractions as index artifacts, not full articles.
