# Node.js

## Sources

- Docs: https://nodejs.org/api/url.html
- Public source: https://github.com/nodejs/node/tree/main/doc/api

## Organization

Node API docs are long generated reference pages by module. The sampled `url.html` page contains module overview, classes, methods, stability markers, tables, and many anchors.

## Search

Node docs have built-in documentation navigation/search. Phase 2 should prefer source and section indexes over browser UI search for API modules.

## Markdown or Source Site

Yes. Node API docs are generated from Markdown under `doc/api/*.md` in the Node repository. URL mapping from `/api/url.html` to `doc/api/url.md` should be deterministic.

## Default Cache Verdict

Sufficient for raw page extraction, but not ergonomic. Static fetch plus Readability returned high-confidence Markdown, but the detailed token estimate was about 17.5k tokens for one page.

## Recommended Work

- Implement deterministic Node source Markdown mapping.
- Add section-level chunking by H2/H3 anchor.
- Preserve stability markers and parameter tables.
- Store child artifacts for classes and methods.

