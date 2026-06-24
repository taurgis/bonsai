# Vite

## Sources

- Docs: https://vite.dev/guide/
- Observed edit link: https://github.com/vitejs/vite/edit/main/docs/guide/index.md
- Observed site data: `window.__VP_HASH_MAP__`, `window.__VP_SITE_DATA__`

## Organization

Vite uses VitePress. The site data exposes Guide, Config, Plugins, version links, releases, and sidebars. It also exposes version links for unreleased docs and old major docs.

## Search

Vite uses VitePress local search. The sampled `__VP_SITE_DATA__` contained `search.provider = local` and MiniSearch options. This should be implemented as a generic VitePress local-search connector by fetching the bundled search index rather than crawling the site.

## Markdown or Source Site

Yes. The sampled page exposes an edit link to `vitejs/vite/docs/guide/index.md`. VitePress edit-link patterns and the hash map should let the CLI resolve many docs pages to source Markdown.

## Default Cache Verdict

Sufficient for articles. Static fetch plus Readability returned high-confidence Markdown, including tables and code blocks.

Not sufficient for:

- Search across uncached pages.
- Version-aware docs selection.
- Direct Markdown source preference.

## Recommended Work

- Make Vite the first VitePress fixture because it uses local search while Vue uses Algolia.
- Preserve docs version in metadata, especially `main.vite.dev`, `v7.vite.dev`, and current `vite.dev`.

