# VitePress

## Sources

- Docs: https://vitepress.dev/guide/what-is-vitepress
- Verified Markdown route: https://vitepress.dev/guide/what-is-vitepress.md
- Observed edit link: https://github.com/vuejs/vitepress/edit/main/docs/en/guide/what-is-vitepress.md
- Research CLI: static fetch, high confidence, detailed token estimate about 1471.

## Organization

VitePress is a static site generator that serves pre-rendered HTML on first load and hydrates into a Vue SPA for navigation. It is Markdown-first and exposes strong framework markers:

- `window.__VP_SITE_DATA__`
- `window.__VP_HASH_MAP__`
- VitePress nav/sidebar DOM
- Direct `.md` route hint in hidden LLM text on the sampled page
- GitHub edit link to the source Markdown file

## Search

VitePress supports both local search and Algolia DocSearch depending on site configuration. The framework docs page loads a `docsearch` chunk and presents a search UI. Earlier library samples proved VitePress variants with Algolia config (Vue) and local search config (Vite). Generic VitePress search support must inspect the site data per site rather than assuming one provider.

## Markdown or Source Site

Yes. The direct `.md` route was verified with HTTP 200. The edit link was also visible. For VitePress, route Markdown should usually beat Readability extraction because it preserves authoring structure and avoids theme chrome.

## Default Cache Verdict

Sufficient for article content. Not sufficient as the best strategy because source Markdown, page maps, and search config are available generically.

## Recommended Work

- Probe `currentRoute + ".md"` when VitePress is detected.
- Parse `__VP_SITE_DATA__` for nav, sidebar, editLink, and search provider.
- Parse `__VP_HASH_MAP__` for source/page inventory.
- Preserve language and version prefixes in generated page maps.
