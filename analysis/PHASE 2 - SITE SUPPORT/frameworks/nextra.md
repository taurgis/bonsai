# Nextra

## Sources

- Docs: https://nextra.site/docs
- Research CLI: static fetch, medium confidence, detailed token estimate about 296.
- Observed metadata: Next.js assets, Nextra classes, search UI, RSC payload with page map and `frontMatter.filePath` values such as `app/docs/page.mdx`.

## Organization

Nextra is a content-focused framework on top of Next.js. The sampled page is statically extractable, but the highest-value metadata is in the Next App Router payload:

- Page map entries.
- Route paths.
- Frontmatter title/description.
- Source `filePath` values.
- Timestamps.

## Search

Search UI is present, but the actual search index or query API was not proven in this task. Treat it as a signal until a fixture captures the search payload.

## Markdown or Source Site

Source MDX file paths are visible in the RSC payload, but they are not direct public raw URLs by themselves. A mapper must require repository context before trying to fetch source.

## Default Cache Verdict

Partial. Static article text is usable, but the generic cache discards the page map and file-path metadata that would make Nextra sites easy to crawl and source-map.

## Recommended Work

- Add a Next/RSC payload parser that can extract page maps and frontmatter without executing scripts.
- Detect Nextra-specific classes and metadata.
- Store page map entries as discovery metadata.
- Do not mark source Markdown as fetchable until repository mapping is proven.
