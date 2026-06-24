# Docusaurus

## Sources

- Docs: https://docusaurus.io/docs
- Research CLI: static fetch, high confidence, detailed token estimate about 3107.
- Observed metadata: `meta name=generator content="Docusaurus v3.10.1"`, `id=__docusaurus`, docs version metadata, `DocSearch` button, Algolia DSN preconnect.

## Organization

Docusaurus builds static HTML for each route and hydrates into a React SPA. The default docs plugin organizes content by docs versions, sidebars, categories, route ids, and MDX source files. The sampled Docusaurus docs page exposes a sidebar with versioned docs groups and article headings.

The page content itself is easy for Readability, but the framework data is richer than the article:

- Version metadata is visible in HTML meta tags.
- Sidebar entries are rendered as normal links.
- Search UI and DocSearch metadata are visible.
- The page is a static HTML route but becomes a SPA after hydration.

## Search

Search is not proven as a callable connector from the sampled page. The page has a DocSearch button and an Algolia DSN preconnect, but the app id, API key, index, and query payload must be fixture-proven before implementing an Algolia connector for Docusaurus sites.

## Markdown or Source Site

Docusaurus uses Markdown/MDX source files. The sampled page did not yield a direct edit URL in the captured evidence, so generic support should treat Docusaurus source mapping as a capability only when an edit link, route manifest, or repository config is observed.

## Default Cache Verdict

Sufficient for individual article text. Not sufficient for:

- Version-aware docs discovery.
- Sidebar/page-map extraction.
- Source MDX preference.
- Search connector setup.
- Code tab/admonition semantics.

## Recommended Work

- Detect Docusaurus from generator meta, `__docusaurus`, and Docusaurus class names.
- Capture `docusaurus_locale`, `docusaurus_version`, `docusaurus_tag`, and `docsearch:*` metadata.
- Extract sidebar links as a page map even before a search connector exists.
- Treat Algolia/DocSearch UI as `signal` until app id, key, and index are proven in fixtures.
