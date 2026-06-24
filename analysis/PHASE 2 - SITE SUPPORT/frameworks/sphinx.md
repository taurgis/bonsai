# Sphinx

## Sources

- Docs: https://www.sphinx-doc.org/en/master/
- Verified search index: https://www.sphinx-doc.org/en/master/searchindex.js
- Research CLI: static fetch, high confidence, detailed token estimate about 3319.

## Organization

Sphinx generates static documentation from reStructuredText or MyST Markdown and can build multiple output formats. It is common in Python, scientific, and infrastructure documentation.

The sampled page exposed a large, useful table of contents and project/version structure. Sphinx pages often include:

- `searchindex.js`.
- `objects.inv` for intersphinx inventories.
- Stable heading anchors.
- Versioned path prefixes such as `/en/master/`.
- Domain-specific generated API pages.

## Search

Verified. `searchindex.js` returned HTTP 200. It is JavaScript, not plain JSON, so support needs a parser that extracts the search index safely without evaluating arbitrary code.

## Markdown or Source Site

Not generically proven. Source may be reStructuredText or MyST in a repository, but source URL mapping varies by project and theme.

## Default Cache Verdict

Sufficient for many article and index pages. Needs section chunking for long references and a safe Sphinx search parser for discovery.

## Recommended Work

- Detect Sphinx from generator/theme markers and `searchindex.js`.
- Parse `searchindex.js` with a safe data extractor.
- Consider `objects.inv` support later for API symbol discovery.
- Add chunking for large generated API/reference pages.
