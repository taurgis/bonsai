# Docsy

## Sources

- Docs: https://docsy.dev/docs/
- Tested search endpoint: https://docsy.dev/index.json returned 404 after redirect to `www`.
- Research CLI: static fetch, high confidence, detailed token estimate about 961.

## Organization

Docsy is a Hugo theme for technical documentation sets. The sampled page is clean, static, and article-like. It describes Docsy as a theme for Hugo, with Markdown or HTML source files handled by Hugo.

## Search

The tested `/index.json` endpoint returned 404. Hugo/Docsy sites may implement search through different output formats or third-party integrations, so generic search support is not proven.

## Markdown or Source Site

Markdown source is likely for many Docsy sites, but no direct source mapping was proven in the sampled page.

## Default Cache Verdict

Sufficient for article pages. Not sufficient for discovery unless a sitemap, search index, or repo mapping is available.

## Recommended Work

- Detect Docsy/Hugo from footer/theme markers.
- Keep search support endpoint-driven rather than assuming `/index.json`.
- Use sitemaps and static links for discovery until a search index fixture exists.
