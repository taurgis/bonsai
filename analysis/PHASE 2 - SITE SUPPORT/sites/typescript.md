# TypeScript

## Sources

- Docs: https://www.typescriptlang.org/docs/
- Public source repo: https://github.com/microsoft/TypeScript-Website

## Organization

The docs index points to popular handbook pages, TSConfig reference, playground, download, community, and code samples. The site is a custom/static documentation portal rather than a standard VitePress/Docusaurus site.

## Search

Search appears site-specific or generated, but this task did not verify a public index or query endpoint. A connector should be investigated after higher-value generic engines are implemented.

## Markdown or Source Site

Yes. The website source is public in `microsoft/TypeScript-Website`. Mapping from URL to source file should be implemented as a generated-static/source mapper.

## Default Cache Verdict

Partially sufficient. Static fetch returned the popular docs links, but also included customizer/footer noise and an embedded base64 Microsoft logo. The article body is usable, but the default cache should not store base64 image blobs in Markdown.

## Recommended Work

- Add cleanup for base64/data URI images.
- Strip customizer and footer regions before Readability or before Markdown output.
- Add source mapping for Handbook and TSConfig pages.
